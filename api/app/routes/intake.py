import os
import random
import string
from datetime import datetime, timezone
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr

from app.db import get_db, SessionLocal
from app.models import Client, Trip, IntakeResponse as IntakeResponseModel
from app.schemas import IntakeCreate, IntakeResponse
from app.services.email import send_intake_confirmation
from app.services.ai import intake_chat_turn, generate_itinerary, analyse_intake, format_transcript
from app.limiter import limiter
from app.routes.auth import create_magic_token

router = APIRouter(prefix="/intake", tags=["intake"])


# ─── Helpers ─────────────────────────────────────────────────────────────────

def generate_reference_code(length: int = 8) -> str:
    chars = string.ascii_uppercase + string.digits
    return "".join(random.choices(chars, k=length))


def get_or_create_client(db: Session, email: str, name: str) -> Client:
    client = db.query(Client).filter(Client.email == email).first()
    if client:
        if client.name != name:
            client.name = name
            db.commit()
        return client
    ref_code = generate_reference_code()
    while db.query(Client).filter(Client.reference_code == ref_code).first():
        ref_code = generate_reference_code()
    client = Client(email=email, name=name, reference_code=ref_code)
    db.add(client)
    db.commit()
    db.refresh(client)
    return client


# ─── Intake chat ─────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str   # "user" or "assistant"
    content: str


class IntakeChatRequest(BaseModel):
    messages: list[ChatMessage]
    seed_data: dict   # destination, origin_city, start_date, end_date, budget_range, travellers_count


class IntakeChatResponse(BaseModel):
    message: str
    complete: bool
    suggestions: list[str] = []


@router.post("/chat", response_model=IntakeChatResponse)
@limiter.limit("60/hour")
def intake_chat(request: Request, body: IntakeChatRequest):
    try:
        msg_dicts = [{"role": m.role, "content": m.content} for m in body.messages]
        text, complete, suggestions = intake_chat_turn(msg_dicts, body.seed_data)
        return IntakeChatResponse(message=text, complete=complete, suggestions=suggestions)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Intake submit ────────────────────────────────────────────────────────────

class IntakeCreateExtended(IntakeCreate):
    conversation_transcript: str = ""
    seed_data: dict = {}


def _run_generation(trip_id, conversation_transcript: str, seed_data: dict = None):
    """Background task: run Analyser then Generator, then email the client when ready."""
    from app.models import Trip, Client
    from app.services.email import send_itinerary_ready
    import logging
    log = logging.getLogger(__name__)

    db = SessionLocal()
    try:
        # ── Agent 2: Analyser ────────────────────────────────────────────────
        client_profile = None
        if conversation_transcript and seed_data:
            try:
                client_profile = analyse_intake(conversation_transcript, seed_data)
                log.info("Analyser produced ClientProfile for trip %s", trip_id)
            except Exception as ae:
                log.warning("Analyser failed for trip %s, falling back to transcript: %s", trip_id, ae)

        # ── Agent 3: Generator ───────────────────────────────────────────────
        itinerary = generate_itinerary(
            db,
            trip_id,
            conversation_transcript=conversation_transcript if not client_profile else "",
            client_profile=client_profile,
        )
        # Update trip title with the AI-generated title from the itinerary JSON
        trip = db.query(Trip).filter(Trip.id == trip_id).first()
        if trip and itinerary:
            ai_title = getattr(itinerary, 'itinerary_json', {}).get('trip_title', '').strip()
            if ai_title:
                trip.title = ai_title
                db.commit()
                log.info("Updated trip %s title to AI-generated: '%s'", trip_id, ai_title)

        # Send "ready" email with a fresh magic link deep-linked to the trip
        if trip:
            client = db.query(Client).filter(Client.id == trip.client_id).first()
            if client:
                try:
                    from app.routes.auth import create_magic_token
                    import os
                    magic_token = create_magic_token(db, client.id)
                    portal_url = os.getenv("PORTAL_URL", "http://localhost:5173")
                    magic_link = f"{portal_url}/magic/{magic_token}?next=/portal/trips/{trip_id}"
                except Exception:
                    magic_link = None
                send_itinerary_ready(
                    to=client.email,
                    client_name=client.name,
                    trip_title=trip.title,
                    trip_id=str(trip_id),
                    magic_link=magic_link,
                )
    except Exception as e:
        log.error("Background generation failed for trip %s: %s", trip_id, e)
        trip = db.query(Trip).filter(Trip.id == trip_id).first()
        if trip:
            trip.status = "GENERATING"
            trip.updated_at = datetime.now(timezone.utc)
            db.commit()
    finally:
        db.close()


@router.post("", response_model=IntakeResponse)
@limiter.limit("10/hour")
def create_intake(
    request: Request,
    payload: IntakeCreateExtended,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    client = get_or_create_client(db, str(payload.client_email), payload.client_name)

    trip = Trip(
        client_id=client.id,
        title=payload.trip_title,
        origin_city=payload.origin_city,
        start_date=payload.start_date,
        end_date=payload.end_date,
        budget_range=payload.budget_range,
        pace=payload.pace,
        status="GENERATING",
        updated_at=datetime.now(timezone.utc),
    )
    db.add(trip)
    db.flush()

    intake_response = IntakeResponseModel(
        trip_id=trip.id,
        travellers_count=payload.travellers_count,
        interests=payload.interests,
        constraints=payload.constraints,
        accommodation_style=payload.accommodation_style,
        must_dos=payload.must_dos,
        must_avoid=payload.must_avoid,
        notes=payload.notes,
        raw_json=payload.model_dump(mode="json"),
    )
    db.add(intake_response)
    db.commit()
    db.refresh(trip)

    # Fire-and-forget: Analyser → Generator pipeline
    seed = payload.seed_data or {
        "destination": payload.trip_title,
        "origin_city": payload.origin_city,
        "start_date": str(payload.start_date),
        "end_date": str(payload.end_date),
        "budget_range": payload.budget_range,
        "travellers_count": payload.travellers_count,
    }
    background_tasks.add_task(_run_generation, trip.id, payload.conversation_transcript, seed)

    # Send confirmation email with magic link
    magic_token = create_magic_token(db, client.id)
    portal_url = os.getenv("PORTAL_URL", "http://localhost:5173")
    magic_link = f"{portal_url}/magic/{magic_token}"
    send_intake_confirmation(
        to=client.email,
        client_name=client.name,
        reference_code=client.reference_code,
        trip_title=trip.title,
        magic_link=magic_link,
    )

    return IntakeResponse(
        email=client.email,
        trip_id=trip.id,
        message=(
            f"Your itinerary is being generated and will be ready shortly. "
            f"We've sent a login link to {client.email}."
        ),
    )
