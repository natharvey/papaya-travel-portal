import uuid
import base64
import json
import logging
import threading
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session, joinedload
from jose import jwt, JWTError
import os

import httpx
from openai import OpenAI

from app.db import get_db
from app.models import Trip, Client, Itinerary, Message, Flight, Stay, IntakeResponse
from app.schemas import (
    TripDetail, AdminTripListItem, TripUpdate, MessageCreate, MessageOut,
    ItineraryOut, RegenerateRequest, FlightCreate, FlightOut, StayCreate, StayOut,
)
from app.services.ai import generate_itinerary
from app.services.s3 import upload_document, list_documents, delete_document, get_download_url
from app.services.email import send_itinerary_for_review, send_new_message_to_client
from app.services.places import enrich_stay
from app.db import SessionLocal

router = APIRouter(prefix="/admin", tags=["admin"])
security = HTTPBearer()

JWT_SECRET = os.getenv("JWT_SECRET", "change-me-in-production")
ALGORITHM = "HS256"

VALID_STATUSES = {"GENERATING", "ACTIVE", "COMPLETED"}


def require_admin(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    if payload.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return payload


@router.get("/trips", response_model=list[AdminTripListItem])
def list_trips(
    trip_status: Optional[str] = Query(None, alias="status"),
    _admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    q = db.query(Trip).options(joinedload(Trip.client), joinedload(Trip.messages)).order_by(Trip.created_at.desc())
    if trip_status:
        q = q.filter(Trip.status == trip_status.upper())
    trips = q.all()
    result = []
    for t in trips:
        unread = sum(1 for m in t.messages if m.sender_type == "CLIENT" and not m.is_read)
        item = AdminTripListItem(
            id=t.id,
            title=t.title,
            origin_city=t.origin_city,
            start_date=t.start_date,
            end_date=t.end_date,
            budget_range=t.budget_range,
            pace=t.pace,
            status=t.status,
            created_at=t.created_at,
            updated_at=t.updated_at,
            client_name=t.client.name,
            client_email=t.client.email,
            unread_count=unread,
        )
        result.append(item)
    return result


@router.get("/trips/{trip_id}", response_model=TripDetail)
def get_trip(
    trip_id: uuid.UUID,
    _admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    trip = (
        db.query(Trip)
        .filter(Trip.id == trip_id)
        .options(
            joinedload(Trip.client),
            joinedload(Trip.intake_response),
            joinedload(Trip.itineraries),
            joinedload(Trip.messages),
            joinedload(Trip.flights),
            joinedload(Trip.stays),
        )
        .first()
    )
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return TripDetail.model_validate(trip)


@router.patch("/trips/{trip_id}", response_model=TripDetail)
def update_trip(
    trip_id: uuid.UUID,
    payload: TripUpdate,
    _admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    trip = (
        db.query(Trip)
        .filter(Trip.id == trip_id)
        .options(
            joinedload(Trip.client),
            joinedload(Trip.intake_response),
            joinedload(Trip.itineraries),
            joinedload(Trip.messages),
            joinedload(Trip.flights),
        )
        .first()
    )
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if payload.status is not None:
        new_status = payload.status.upper()
        if new_status not in VALID_STATUSES:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of {VALID_STATUSES}")
        trip.status = new_status
    if payload.title is not None:
        trip.title = payload.title
    if payload.admin_notes is not None:
        trip.admin_notes = payload.admin_notes
    from datetime import datetime
    trip.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(trip)
    return TripDetail.model_validate(trip)


log = logging.getLogger(__name__)


def _run_admin_generation(trip_id: uuid.UUID, additional_instructions: str = "") -> None:
    """Background thread: generate itinerary for a trip, update status when done."""
    from app.db import SessionLocal
    db = SessionLocal()
    try:
        generate_itinerary(db, trip_id=trip_id, additional_instructions=additional_instructions)
    except Exception as e:
        log.error("Admin generation failed for trip %s: %s", trip_id, e)
        trip = db.query(Trip).filter(Trip.id == trip_id).first()
        if trip:
            trip.status = "GENERATING"
            trip.updated_at = datetime.now(timezone.utc)
            db.commit()
    finally:
        db.close()


@router.post("/trips/{trip_id}/generate-itinerary")
def generate_itinerary_endpoint(
    trip_id: uuid.UUID,
    _admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    trip.status = "GENERATING"
    trip.updated_at = datetime.now(timezone.utc)
    db.commit()
    threading.Thread(target=_run_admin_generation, args=(trip_id,), daemon=True).start()
    return {"status": "generating"}


@router.post("/trips/{trip_id}/regenerate-itinerary")
def regenerate_itinerary_endpoint(
    trip_id: uuid.UUID,
    payload: RegenerateRequest,
    _admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    trip.status = "GENERATING"
    trip.updated_at = datetime.now(timezone.utc)
    db.commit()
    threading.Thread(
        target=_run_admin_generation,
        args=(trip_id, payload.instructions),
        daemon=True,
    ).start()
    return {"status": "generating"}


@router.get("/trips/{trip_id}/messages", response_model=list[MessageOut])
def get_messages(
    trip_id: uuid.UUID,
    _admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    messages = (
        db.query(Message)
        .filter(Message.trip_id == trip_id)
        .order_by(Message.created_at.asc())
        .all()
    )
    return [MessageOut.model_validate(m) for m in messages]


@router.post("/trips/{trip_id}/messages/read")
def mark_messages_read(
    trip_id: uuid.UUID,
    _admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Mark all CLIENT messages on this trip as read."""
    db.query(Message).filter(
        Message.trip_id == trip_id,
        Message.sender_type == "CLIENT",
        Message.is_read == False,  # noqa: E712
    ).update({"is_read": True})
    db.commit()
    return {"ok": True}


@router.post("/trips/{trip_id}/messages", response_model=MessageOut)
def send_message(
    trip_id: uuid.UUID,
    payload: MessageCreate,
    _admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    trip = db.query(Trip).options(joinedload(Trip.client)).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    msg = Message(
        trip_id=trip_id,
        sender_type="ADMIN",
        body=payload.body,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    send_new_message_to_client(
        to=trip.client.email,
        client_name=trip.client.name,
        trip_title=trip.title,
        trip_id=str(trip_id),
        message_body=payload.body,
    )
    return MessageOut.model_validate(msg)


# ─── Flights ─────────────────────────────────────────────────────────────────

@router.get("/flights/lookup")
def lookup_flight(
    flight_number: str = Query(...),
    date: str = Query(...),  # YYYY-MM-DD
    _admin=Depends(require_admin),
):
    """Look up a flight via AeroDataBox and return pre-filled form data."""
    api_key = os.getenv("AERODATABOX_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=503, detail="Flight lookup not configured — set AERODATABOX_API_KEY")

    url = f"https://aerodatabox.p.rapidapi.com/flights/number/{flight_number}/{date}"
    headers = {
        "x-rapidapi-key": api_key,
        "x-rapidapi-host": "aerodatabox.p.rapidapi.com",
    }

    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(url, headers=headers)
    except httpx.RequestError:
        raise HTTPException(status_code=503, detail="Flight lookup service unavailable")

    if resp.status_code == 404:
        raise HTTPException(status_code=404, detail="Flight not found for that number and date")
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Flight lookup failed (status {resp.status_code})")

    data = resp.json()
    if not data:
        raise HTTPException(status_code=404, detail="No flight data returned")

    flight = data[0] if isinstance(data, list) else data

    def parse_local_time(t: str) -> str:
        """Convert '2024-03-29 17:00+11:00' → 'YYYY-MM-DDTHH:MM' for datetime-local inputs."""
        if not t:
            return ""
        t = t.strip().replace(" ", "T")
        for i in range(len(t) - 1, 9, -1):
            if t[i] in ("+", "-"):
                t = t[:i]
                break
        if t.endswith("Z"):
            t = t[:-1]
        return t[:16]

    dep = flight.get("departure") or {}
    arr = flight.get("arrival") or {}

    return {
        "flight_number": (flight.get("number") or flight_number).replace(" ", ""),
        "airline": (flight.get("airline") or {}).get("name", ""),
        "departure_airport": (dep.get("airport") or {}).get("iata", ""),
        "arrival_airport": (arr.get("airport") or {}).get("iata", ""),
        "departure_time": parse_local_time(dep.get("scheduledTimeLocal") or dep.get("scheduledTimeUtc", "")),
        "arrival_time": parse_local_time(arr.get("scheduledTimeLocal") or arr.get("scheduledTimeUtc", "")),
        "terminal_departure": dep.get("terminal") or "",
        "terminal_arrival": arr.get("terminal") or "",
    }


FLIGHT_PARSE_PROMPT = """Extract all flights from this booking confirmation screenshot. There may be one or multiple flight legs.
Return a JSON array where each element has these exact keys:
flight_number, airline, departure_airport (IATA code), arrival_airport (IATA code),
departure_time (YYYY-MM-DDTHH:MM format), arrival_time (YYYY-MM-DDTHH:MM format),
terminal_departure, terminal_arrival, booking_ref.
Use empty string for any field you cannot find. Order flights by departure_time ascending.
Only return the JSON array, no other text."""

STAY_PARSE_PROMPT = """Extract hotel/accommodation booking details from this screenshot. Return a JSON object with these exact keys:
name (hotel/property name), address, check_in (YYYY-MM-DDTHH:MM format, use T14:00 if only date given),
check_out (YYYY-MM-DDTHH:MM format, use T11:00 if only date given), confirmation_number, notes.
Use empty string for any field you cannot find. Only return the JSON object, no other text."""


@router.post("/parse-screenshot")
async def parse_screenshot(
    _admin=Depends(require_admin),
    file: UploadFile = File(...),
    type: str = Form(...),
):
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY is not configured")

    if type not in ("flight", "stay"):
        raise HTTPException(status_code=400, detail="type must be 'flight' or 'stay'")

    contents = await file.read()
    b64 = base64.b64encode(contents).decode()
    mime = file.content_type or "image/png"
    prompt = FLIGHT_PARSE_PROMPT if type == "flight" else STAY_PARSE_PROMPT

    client = OpenAI(api_key=api_key)
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{
            "role": "user",
            "content": [
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}},
            ],
        }],
        max_tokens=500,
    )

    raw = response.choices[0].message.content or ""
    # Strip markdown code fences if present
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

    try:
        data = json.loads(raw)
    except Exception:
        raise HTTPException(status_code=422, detail=f"Could not parse GPT response: {raw}")

    # Normalise flight response to always be a list
    if type == "flight" and isinstance(data, dict):
        data = [data]

    return data


@router.get("/trips/{trip_id}/flights", response_model=list[FlightOut])
def list_flights(
    trip_id: uuid.UUID,
    _admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    flights = db.query(Flight).filter(Flight.trip_id == trip_id).order_by(Flight.leg_order).all()
    return [FlightOut.model_validate(f) for f in flights]


@router.post("/trips/{trip_id}/flights", response_model=FlightOut, status_code=201)
def add_flight(
    trip_id: uuid.UUID,
    payload: FlightCreate,
    _admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    flight = Flight(trip_id=trip_id, **payload.model_dump())
    db.add(flight)
    db.commit()
    db.refresh(flight)
    return FlightOut.model_validate(flight)


@router.patch("/trips/{trip_id}/flights/{flight_id}", response_model=FlightOut)
def update_flight(
    trip_id: uuid.UUID,
    flight_id: uuid.UUID,
    payload: FlightCreate,
    _admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    flight = db.query(Flight).filter(Flight.id == flight_id, Flight.trip_id == trip_id).first()
    if not flight:
        raise HTTPException(status_code=404, detail="Flight not found")
    for field, value in payload.model_dump().items():
        setattr(flight, field, value)
    db.commit()
    db.refresh(flight)
    return FlightOut.model_validate(flight)


@router.delete("/trips/{trip_id}/flights/{flight_id}", status_code=204)
def delete_flight(
    trip_id: uuid.UUID,
    flight_id: uuid.UUID,
    _admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    flight = db.query(Flight).filter(Flight.id == flight_id, Flight.trip_id == trip_id).first()
    if not flight:
        raise HTTPException(status_code=404, detail="Flight not found")
    db.delete(flight)
    db.commit()


# ─── Stays ───────────────────────────────────────────────────────────────────

@router.get("/trips/{trip_id}/stays", response_model=list[StayOut])
def list_stays(
    trip_id: uuid.UUID,
    _admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    stays = db.query(Stay).filter(Stay.trip_id == trip_id).order_by(Stay.stay_order).all()
    return [StayOut.model_validate(s) for s in stays]


def _enrich_stay_background(stay_id: uuid.UUID) -> None:
    db = SessionLocal()
    try:
        stay = db.query(Stay).filter(Stay.id == stay_id).first()
        if stay:
            enrich_stay(stay, db)
    finally:
        db.close()


@router.post("/trips/{trip_id}/stays", response_model=StayOut, status_code=201)
def add_stay(
    trip_id: uuid.UUID,
    payload: StayCreate,
    _admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    stay = Stay(trip_id=trip_id, **payload.model_dump())
    db.add(stay)
    db.commit()
    db.refresh(stay)
    threading.Thread(target=_enrich_stay_background, args=(stay.id,), daemon=True).start()
    return StayOut.model_validate(stay)


@router.patch("/trips/{trip_id}/stays/{stay_id}", response_model=StayOut)
def update_stay(
    trip_id: uuid.UUID,
    stay_id: uuid.UUID,
    payload: StayCreate,
    _admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    stay = db.query(Stay).filter(Stay.id == stay_id, Stay.trip_id == trip_id).first()
    if not stay:
        raise HTTPException(status_code=404, detail="Stay not found")
    for field, value in payload.model_dump().items():
        setattr(stay, field, value)
    db.commit()
    db.refresh(stay)
    threading.Thread(target=_enrich_stay_background, args=(stay.id,), daemon=True).start()
    return StayOut.model_validate(stay)


@router.delete("/trips/{trip_id}/stays/{stay_id}", status_code=204)
def delete_stay(
    trip_id: uuid.UUID,
    stay_id: uuid.UUID,
    _admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    stay = db.query(Stay).filter(Stay.id == stay_id, Stay.trip_id == trip_id).first()
    if not stay:
        raise HTTPException(status_code=404, detail="Stay not found")
    db.delete(stay)
    db.commit()


# ─── Documents ───────────────────────────────────────────────────────────────

@router.get("/trips/{trip_id}/documents")
def admin_list_documents(
    trip_id: uuid.UUID,
    _admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return list_documents(str(trip_id))


@router.post("/trips/{trip_id}/documents", status_code=201)
async def admin_upload_document(
    trip_id: uuid.UUID,
    file: UploadFile = File(...),
    _admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large — maximum 10MB")
    key = upload_document(str(trip_id), file.filename or "upload", contents, file.content_type or "application/octet-stream", "admin")
    return {"key": key}


@router.get("/trips/{trip_id}/documents/download-url")
def admin_download_url(
    trip_id: uuid.UUID,
    key: str = Query(...),
    _admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if not key.startswith(f"trips/{trip_id}/"):
        raise HTTPException(status_code=403, detail="Access denied")
    return {"url": get_download_url(key)}


@router.delete("/trips/{trip_id}", status_code=204)
def admin_delete_trip(
    trip_id: uuid.UUID,
    _admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Delete a trip and all its associated data."""
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    db.query(Message).filter(Message.trip_id == trip_id).delete()
    db.query(Flight).filter(Flight.trip_id == trip_id).delete()
    db.query(Stay).filter(Stay.trip_id == trip_id).delete()
    db.query(Itinerary).filter(Itinerary.trip_id == trip_id).delete()
    db.query(IntakeResponse).filter(IntakeResponse.trip_id == trip_id).delete()
    db.delete(trip)
    db.commit()


@router.delete("/trips/{trip_id}/documents", status_code=204)
def admin_delete_document(
    trip_id: uuid.UUID,
    key: str = Query(...),
    _admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if not key.startswith(f"trips/{trip_id}/"):
        raise HTTPException(status_code=403, detail="Access denied")
    delete_document(key)


# ─── Data cleanup (one-shot, remove after use) ────────────────────────────────

@router.delete("/cleanup-test-clients", status_code=200)
def cleanup_test_clients(
    keep_email: str = Query(..., description="Email address to keep"),
    _admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Delete all clients (and their trips/data) except the specified email."""
    clients_to_delete = db.query(Client).filter(Client.email != keep_email).all()
    deleted_clients = []

    for client in clients_to_delete:
        trips = db.query(Trip).filter(Trip.client_id == client.id).all()
        for trip in trips:
            db.query(Message).filter(Message.trip_id == trip.id).delete()
            db.query(Flight).filter(Flight.trip_id == trip.id).delete()
            db.query(Stay).filter(Stay.trip_id == trip.id).delete()
            db.query(Itinerary).filter(Itinerary.trip_id == trip.id).delete()
            from app.models import IntakeResponse, LoginToken
            db.query(IntakeResponse).filter(IntakeResponse.trip_id == trip.id).delete()
            db.delete(trip)
        from app.models import LoginToken
        db.query(LoginToken).filter(LoginToken.client_id == client.id).delete()
        deleted_clients.append(client.email)
        db.delete(client)

    db.commit()
    return {
        "kept": keep_email,
        "deleted_clients": deleted_clients,
        "count": len(deleted_clients),
    }
