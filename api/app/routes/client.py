import uuid
import re
import threading
import logging
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status

logger = logging.getLogger(__name__)
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session, joinedload
from jose import jwt, JWTError
import os
import base64
import httpx
import anthropic as anthropic_sdk

from app.db import get_db
from app.models import Client, Trip, Itinerary, Message, Flight, Stay
from app.schemas import (
    TripWithLatestItinerary, TripDetail, MessageCreate, MessageOut, ItineraryOut, FlightOut, StayOut
)
from app.services.email import send_trip_confirmed_client, send_trip_confirmed_admin, send_changes_requested_admin, send_new_message_to_admin
from app.services.s3 import upload_document, list_documents, delete_document, get_download_url
from app.services.ai import chat_with_itinerary, edit_block, generate_accommodation_suggestions, generate_flight_suggestions, extract_client_memory, generate_itinerary
from pydantic import BaseModel as PydanticBaseModel

router = APIRouter(prefix="/client", tags=["client"])
security = HTTPBearer()

JWT_SECRET = os.getenv("JWT_SECRET", "change-me-in-production")
ALGORITHM = "HS256"


def get_current_client(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> Client:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    if payload.get("role") != "client":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a client token")

    client_id = payload.get("sub")
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Client not found")
    return client


@router.get("/me")
def get_me(client: Client = Depends(get_current_client)):
    return {"id": str(client.id), "name": client.name, "email": client.email, "reference_code": client.reference_code}


@router.get("/trips", response_model=list[TripWithLatestItinerary])
def list_trips(
    client: Client = Depends(get_current_client),
    db: Session = Depends(get_db),
):
    trips = (
        db.query(Trip)
        .filter(Trip.client_id == client.id)
        .options(joinedload(Trip.itineraries))
        .order_by(Trip.created_at.desc())
        .all()
    )
    result = []
    for trip in trips:
        latest = None
        if trip.itineraries:
            latest_model = max(trip.itineraries, key=lambda i: i.version)
            latest = ItineraryOut.model_validate(latest_model)
        tw = TripWithLatestItinerary.model_validate(trip)
        tw.latest_itinerary = latest
        result.append(tw)
    return result


@router.get("/trips/{trip_id}", response_model=TripDetail)
def get_trip(
    trip_id: uuid.UUID,
    client: Client = Depends(get_current_client),
    db: Session = Depends(get_db),
):
    trip = (
        db.query(Trip)
        .filter(Trip.id == trip_id, Trip.client_id == client.id)
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




@router.get("/trips/{trip_id}/messages", response_model=list[MessageOut])
def get_messages(
    trip_id: uuid.UUID,
    client: Client = Depends(get_current_client),
    db: Session = Depends(get_db),
):
    trip = db.query(Trip).filter(Trip.id == trip_id, Trip.client_id == client.id).first()
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
    client: Client = Depends(get_current_client),
    db: Session = Depends(get_db),
):
    """Mark all ADMIN messages on this trip as read for the client."""
    trip = db.query(Trip).filter(Trip.id == trip_id, Trip.client_id == client.id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    db.query(Message).filter(
        Message.trip_id == trip_id,
        Message.sender_type == "ADMIN",
        Message.is_read == False,  # noqa: E712
    ).update({"is_read": True})
    db.commit()
    return {"ok": True}


@router.post("/trips/{trip_id}/messages", response_model=MessageOut)
def send_message(
    trip_id: uuid.UUID,
    payload: MessageCreate,
    client: Client = Depends(get_current_client),
    db: Session = Depends(get_db),
):
    trip = db.query(Trip).filter(Trip.id == trip_id, Trip.client_id == client.id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    msg = Message(
        trip_id=trip_id,
        sender_type="CLIENT",
        body=payload.body,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    send_new_message_to_admin(
        client_name=client.name,
        client_email=client.email,
        trip_title=trip.title,
        trip_id=str(trip_id),
        message_body=payload.body,
    )
    return MessageOut.model_validate(msg)


# ─── AI Chat refinement ──────────────────────────────────────────────────────

class TripChatMessage(PydanticBaseModel):
    role: str
    content: str

class TripChatRequest(PydanticBaseModel):
    messages: list[TripChatMessage]

class TripChatResponse(PydanticBaseModel):
    message: str
    itinerary_updated: bool
    new_itinerary: Optional[ItineraryOut] = None


@router.post("/trips/{trip_id}/chat", response_model=TripChatResponse)
def trip_chat(
    trip_id: uuid.UUID,
    payload: TripChatRequest,
    client: Client = Depends(get_current_client),
    db: Session = Depends(get_db),
):
    trip = (
        db.query(Trip)
        .filter(Trip.id == trip_id, Trip.client_id == client.id)
        .options(joinedload(Trip.itineraries), joinedload(Trip.intake_response))
        .first()
    )
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    latest = max(trip.itineraries, key=lambda i: i.version) if trip.itineraries else None
    if not latest:
        raise HTTPException(status_code=400, detail="No itinerary to chat about yet.")

    intake = trip.intake_response
    trip_context = (
        f"Trip: {trip.title}\n"
        f"Dates: {trip.start_date} to {trip.end_date}\n"
        f"Origin: {trip.origin_city}\n"
        f"Budget: {trip.budget_range}\n"
        f"Travellers: {intake.travellers_count if intake else 'unknown'}"
    )

    msg_dicts = [{"role": m.role, "content": m.content} for m in payload.messages]

    try:
        reply, updated_json, regen_requested = chat_with_itinerary(
            msg_dicts, latest.itinerary_json, trip_context,
            client_memory=client.maya_memory,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Full regeneration requested — kick off in background
    if regen_requested:
        def _regen():
            from app.db import SessionLocal
            _db = SessionLocal()
            try:
                generate_itinerary(_db, trip_id=trip_id)
            except Exception as exc:
                logger.warning("Background regen failed: %s", exc)
            finally:
                _db.close()
        threading.Thread(target=_regen, daemon=True).start()
        return TripChatResponse(message=reply, itinerary_updated=False, new_itinerary=None)

    new_itinerary_out = None
    if updated_json:
        from app.services.ai import render_itinerary_markdown
        next_version = latest.version + 1
        new_it = Itinerary(
            trip_id=trip_id,
            itinerary_json=updated_json,
            rendered_md=render_itinerary_markdown(updated_json),
            version=next_version,
            created_at=datetime.utcnow(),
        )
        db.add(new_it)
        db.commit()
        db.refresh(new_it)
        new_itinerary_out = ItineraryOut.model_validate(new_it)

    # Update client memory in background after each conversation turn
    def _update_memory():
        from app.db import SessionLocal
        _db = SessionLocal()
        try:
            _client = _db.query(Client).filter(Client.id == client.id).first()
            if _client:
                _client.maya_memory = extract_client_memory(_client.maya_memory, msg_dicts + [{"role": "assistant", "content": reply}])
                _db.commit()
        except Exception as exc:
            logger.warning("Memory update failed: %s", exc)
        finally:
            _db.close()
    threading.Thread(target=_update_memory, daemon=True).start()

    return TripChatResponse(
        message=reply,
        itinerary_updated=updated_json is not None,
        new_itinerary=new_itinerary_out,
    )


# ─── Block edit ──────────────────────────────────────────────────────────────

class BlockEditRequest(PydanticBaseModel):
    day_number: int
    period: str  # Morning / Afternoon / Evening
    block_title: str
    instruction: str

class BlockEditResponse(PydanticBaseModel):
    message: str
    itinerary_updated: bool
    new_itinerary: Optional[ItineraryOut] = None


@router.post("/trips/{trip_id}/edit-block", response_model=BlockEditResponse)
def edit_itinerary_block(
    trip_id: uuid.UUID,
    payload: BlockEditRequest,
    client: Client = Depends(get_current_client),
    db: Session = Depends(get_db),
):
    trip = (
        db.query(Trip)
        .filter(Trip.id == trip_id, Trip.client_id == client.id)
        .options(joinedload(Trip.itineraries), joinedload(Trip.intake_response))
        .first()
    )
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    latest = max(trip.itineraries, key=lambda i: i.version) if trip.itineraries else None
    if not latest:
        raise HTTPException(status_code=400, detail="No itinerary to edit yet.")

    intake = trip.intake_response
    trip_context = (
        f"Trip: {trip.title}, {trip.origin_city} → destination, "
        f"{trip.start_date} to {trip.end_date}, budget {trip.budget_range}, "
        f"{intake.travellers_count if intake else 2} travellers"
    )

    try:
        message, updated_days = edit_block(
            itinerary_json=latest.itinerary_json,
            day_number=payload.day_number,
            period=payload.period,
            block_title=payload.block_title,
            instruction=payload.instruction,
            trip_context=trip_context,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    if not updated_days:
        return BlockEditResponse(message=message, itinerary_updated=False)

    # Merge updated days into existing itinerary JSON
    from app.services.ai import render_itinerary_markdown
    updated_json = dict(latest.itinerary_json)
    updated_map = {d["day_number"]: d for d in updated_days}
    updated_json["day_plans"] = [
        updated_map.get(d["day_number"], d) for d in updated_json.get("day_plans", [])
    ]

    next_version = latest.version + 1
    new_it = Itinerary(
        trip_id=trip_id,
        itinerary_json=updated_json,
        rendered_md=render_itinerary_markdown(updated_json),
        version=next_version,
        created_at=datetime.utcnow(),
    )
    db.add(new_it)
    db.commit()
    db.refresh(new_it)

    return BlockEditResponse(
        message=message,
        itinerary_updated=True,
        new_itinerary=ItineraryOut.model_validate(new_it),
    )


# ─── Accommodation suggestions ────────────────────────────────────────────────

@router.post("/trips/{trip_id}/accommodation-suggestions")
def get_accommodation_suggestions(
    trip_id: uuid.UUID,
    client: Client = Depends(get_current_client),
    db: Session = Depends(get_db),
):
    trip = (
        db.query(Trip)
        .filter(Trip.id == trip_id, Trip.client_id == client.id)
        .options(joinedload(Trip.itineraries), joinedload(Trip.intake_response))
        .first()
    )
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    intake = trip.intake_response
    latest = max(trip.itineraries, key=lambda i: i.version) if trip.itineraries else None
    destinations = [d["name"] for d in (latest.itinerary_json.get("destinations", []) if latest else [])]
    if not destinations:
        destinations = [trip.title]

    profile = f"{intake.travellers_count} traveller(s), {intake.accommodation_style}" if intake else "2 travellers"

    try:
        suggestions = generate_accommodation_suggestions(
            trip_title=trip.title,
            origin_city=trip.origin_city,
            budget_range=trip.budget_range,
            accommodation_style=intake.accommodation_style if intake else "Mid-range Hotel",
            traveller_profile=profile,
            destinations=destinations,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {"suggestions": suggestions}


# ─── Flight suggestions ───────────────────────────────────────────────────────

@router.post("/trips/{trip_id}/flight-suggestions")
def get_flight_suggestions(
    trip_id: uuid.UUID,
    client: Client = Depends(get_current_client),
    db: Session = Depends(get_db),
):
    trip = (
        db.query(Trip)
        .filter(Trip.id == trip_id, Trip.client_id == client.id)
        .options(joinedload(Trip.itineraries), joinedload(Trip.intake_response))
        .first()
    )
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    intake = trip.intake_response
    latest = max(trip.itineraries, key=lambda i: i.version) if trip.itineraries else None
    destinations = [d["name"] for d in (latest.itinerary_json.get("destinations", []) if latest else [])]

    try:
        suggestions = generate_flight_suggestions(
            origin_city=trip.origin_city,
            trip_title=trip.title,
            start_date=str(trip.start_date),
            end_date=str(trip.end_date),
            budget_range=trip.budget_range,
            travellers_count=intake.travellers_count if intake else 2,
            destinations=destinations,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {"suggestions": suggestions}


# ─── Documents ───────────────────────────────────────────────────────────────

@router.get("/trips/{trip_id}/documents")
def client_list_documents(
    trip_id: uuid.UUID,
    client: Client = Depends(get_current_client),
    db: Session = Depends(get_db),
):
    trip = db.query(Trip).filter(Trip.id == trip_id, Trip.client_id == client.id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return list_documents(str(trip_id))


@router.post("/trips/{trip_id}/documents", status_code=201)
async def client_upload_document(
    trip_id: uuid.UUID,
    file: UploadFile = File(...),
    client: Client = Depends(get_current_client),
    db: Session = Depends(get_db),
):
    trip = db.query(Trip).filter(Trip.id == trip_id, Trip.client_id == client.id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large — maximum 10MB")
    key = upload_document(str(trip_id), file.filename or "upload", contents, file.content_type or "application/octet-stream", "client")
    return {"key": key}


@router.get("/trips/{trip_id}/documents/download-url")
def client_download_url(
    trip_id: uuid.UUID,
    key: str = Query(...),
    client: Client = Depends(get_current_client),
    db: Session = Depends(get_db),
):
    trip = db.query(Trip).filter(Trip.id == trip_id, Trip.client_id == client.id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if not key.startswith(f"trips/{trip_id}/"):
        raise HTTPException(status_code=403, detail="Access denied")
    return {"url": get_download_url(key)}


@router.patch("/trips/{trip_id}/title", status_code=200)
def client_update_trip_title(
    trip_id: uuid.UUID,
    payload: dict,
    client: Client = Depends(get_current_client),
    db: Session = Depends(get_db),
):
    trip = db.query(Trip).filter(Trip.id == trip_id, Trip.client_id == client.id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    title = (payload.get("title") or "").strip()
    if not title:
        raise HTTPException(status_code=422, detail="Title cannot be empty")
    trip.title = title
    db.commit()
    return {"title": trip.title}


@router.delete("/trips/{trip_id}", status_code=204)
def client_delete_trip(
    trip_id: uuid.UUID,
    client: Client = Depends(get_current_client),
    db: Session = Depends(get_db),
):
    trip = db.query(Trip).filter(Trip.id == trip_id, Trip.client_id == client.id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    db.delete(trip)
    db.commit()


@router.delete("/trips/{trip_id}/documents", status_code=204)
def client_delete_document(
    trip_id: uuid.UUID,
    key: str = Query(...),
    client: Client = Depends(get_current_client),
    db: Session = Depends(get_db),
):
    trip = db.query(Trip).filter(Trip.id == trip_id, Trip.client_id == client.id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if not key.startswith(f"trips/{trip_id}/client/"):
        raise HTTPException(status_code=403, detail="You can only delete your own documents")
    delete_document(key)


# ─── Flight lookup ────────────────────────────────────────────────────────────

@router.get("/flights/lookup")
def client_lookup_flight(
    flight_number: str = Query(...),
    date: str = Query(...),  # YYYY-MM-DD
    _client=Depends(get_current_client),
):
    """Look up a flight via AeroDataBox. Available to authenticated clients."""
    api_key = os.getenv("AERODATABOX_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=503, detail="Flight lookup not configured")

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


PLACES_API_KEY = os.getenv("GOOGLE_PLACES_API_KEY", "")
PLACES_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"
UNSPLASH_ACCESS_KEY = os.getenv("UNSPLASH_ACCESS_KEY", "")


_SCENE_TAGS = frozenset({"mountain", "city", "coast", "nature", "architecture", "beach", "countryside", "lake", "desert", "other"})


def _verify_hero_photo(url: str, destination: str) -> tuple[bool, str]:
    """Use Claude Haiku vision to verify a destination hero photo.
    Returns (accepted, scene_tag) where scene_tag is one of the _SCENE_TAGS values.
    Accepts: wide scenic photos in full colour with no prominent people.
    Rejects: B&W, desaturated, crowded, generic, or unrelated images."""
    anthropic_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not anthropic_key:
        return True, "other"  # no key → skip gate
    try:
        img_resp = httpx.get(url, timeout=8, follow_redirects=True)
        img_resp.raise_for_status()
        content_type = img_resp.headers.get("content-type", "image/jpeg").split(";")[0].strip()
        if content_type not in ("image/jpeg", "image/png", "image/gif", "image/webp"):
            content_type = "image/jpeg"
        b64 = base64.standard_b64encode(img_resp.content).decode()

        client = anthropic_sdk.Anthropic(api_key=anthropic_key)
        resp = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=10,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {"type": "base64", "media_type": content_type, "data": b64},
                    },
                    {
                        "type": "text",
                        "text": (
                            f"This photo will be used as a full-width hero image for a trip to {destination}. "
                            "Reply with exactly two words: YES or NO, then a scene tag. "
                            "Say YES only if ALL true: (1) scenic landscape/skyline/coast/mountain/landmark/architecture, "
                            "(2) NO people prominently visible, (3) full-colour — NOT black-and-white or desaturated, "
                            f"(4) represents {destination} or its environment. "
                            "Say NO for: crowds, markets, street scenes, people, B&W/grayscale, generic unrelated images. "
                            "Scene tags — pick one: mountain, city, coast, nature, architecture, beach, countryside, lake, desert, other. "
                            "Examples: 'YES city' or 'NO mountain'. Two words only."
                        ),
                    },
                ],
            }],
        )
        raw = resp.content[0].text.strip().lower()
        parts = raw.split()
        accepted = bool(parts) and parts[0] == "yes"
        tag = parts[1] if len(parts) > 1 and parts[1] in _SCENE_TAGS else "other"
        return accepted, tag
    except Exception as exc:
        logger.warning("Hero photo verify failed for %s: %s", url, exc)
        return False, "other"


def _unsplash_hero_results(destination: str, n: int = 8) -> list[dict]:
    """Fetch Unsplash results for a destination, filtered to wide-landscape only."""
    if not UNSPLASH_ACCESS_KEY:
        return []
    try:
        resp = httpx.get(
            "https://api.unsplash.com/search/photos",
            params={
                "query": f"{destination} landscape scenery",
                "per_page": n,
                "orientation": "landscape",
                "content_filter": "high",
                "order_by": "relevant",
            },
            headers={"Authorization": f"Client-ID {UNSPLASH_ACCESS_KEY}"},
            timeout=8,
        )
        resp.raise_for_status()
        results = resp.json().get("results", [])
        # Keep only genuinely wide photos (≥ 1.5:1 ratio)
        results = [p for p in results if p.get("height", 1) > 0 and p.get("width", 0) / p.get("height", 1) >= 1.5]
        # Sort widest-ratio first, then by resolution as tiebreaker
        results.sort(key=lambda p: (p.get("width", 0) / max(p.get("height", 1), 1), p.get("width", 0) * p.get("height", 0)), reverse=True)
        return results
    except Exception:
        return []


def _places_fallback_url(destination: str) -> str | None:
    """Return a Google Places photo URL for a destination, or None."""
    if not PLACES_API_KEY:
        return None
    try:
        resp = httpx.post(
            PLACES_SEARCH_URL,
            json={"textQuery": f"{destination} landmark scenic", "maxResultCount": 1},
            headers={
                "Content-Type": "application/json",
                "X-Goog-Api-Key": PLACES_API_KEY,
                "X-Goog-FieldMask": "places.id,places.photos",
            },
            timeout=8,
        )
        resp.raise_for_status()
        place = (resp.json().get("places") or [None])[0]
        if place:
            photo_ref = (place.get("photos") or [{}])[0].get("name")
            if photo_ref:
                return f"https://places.googleapis.com/v1/{photo_ref}/media?maxWidthPx=4800&maxHeightPx=2700&key={PLACES_API_KEY}"
    except Exception:
        pass
    return None


def fetch_destination_photo_url(destination: str) -> dict:
    """Shared helper: return a high-quality wide-landscape hero photo URL for a single destination."""
    for photo in _unsplash_hero_results(destination):
        url = photo.get("urls", {}).get("full") or photo.get("urls", {}).get("regular")
        if not url:
            continue
        accepted, _ = _verify_hero_photo(url, destination)
        if accepted:
            logger.info("Hero photo verified for '%s': %s", destination, url)
            return {"photo_url": url, "source": "unsplash"}
    logger.info("No verified hero photo found on Unsplash for '%s', falling through", destination)

    url = _places_fallback_url(destination)
    if url:
        return {"photo_url": url, "source": "places"}

    return {"photo_url": None, "source": None}


@router.get("/destination-photo")
def destination_photo(
    destination: str = Query(..., description="Destination name, e.g. 'Kyoto, Japan'"),
    _client=Depends(get_current_client),
):
    return fetch_destination_photo_url(destination)


def fetch_diverse_destination_photos(destinations: list[str]) -> dict[str, str | None]:
    """Fetch hero photos for up to 3 destinations ensuring no two photos share the same scene type.
    Each destination is checked for up to n Unsplash candidates; the one with an unused scene tag
    is preferred. Falls back to Google Places if Unsplash yields nothing."""
    used_scene_tags: set[str] = set()
    result: dict[str, str | None] = {}

    for destination in destinations:
        if not destination:
            result[destination] = None
            continue

        selected_url: str | None = None
        fallback_url: str | None = None  # best accepted photo even if tag clashes

        for photo in _unsplash_hero_results(destination, n=8):
            url = photo.get("urls", {}).get("full") or photo.get("urls", {}).get("regular")
            if not url:
                continue
            accepted, tag = _verify_hero_photo(url, destination)
            if not accepted:
                continue
            if fallback_url is None:
                fallback_url = url  # keep first accepted as safety net
            if tag not in used_scene_tags:
                selected_url = url
                used_scene_tags.add(tag)
                logger.info("Diverse hero: '%s' → %s (%s)", destination, url, tag)
                break

        if selected_url is None:
            # All candidates share a used tag — use first accepted anyway
            selected_url = fallback_url
            if selected_url is None:
                # No Unsplash candidate passed at all — try Places
                selected_url = _places_fallback_url(destination)
            if selected_url:
                logger.info("Diverse hero fallback: '%s' → %s", destination, selected_url)

        result[destination] = selected_url

    return result


@router.get("/destination-photos")
def destination_photos_batch(
    destinations: str = Query(..., description="Comma-separated destination names, up to 3"),
    _client=Depends(get_current_client),
):
    """Return a diverse set of hero photos for multiple destinations in one call."""
    dests = [d.strip() for d in destinations.split(",") if d.strip()][:3]
    return fetch_diverse_destination_photos(dests)


def _verify_activity_photo(url: str, title: str, location: str) -> bool:
    """Use Claude Haiku vision to confirm a photo actually depicts the activity.
    Returns True only if the image clearly matches. Falls back to False on any error."""
    anthropic_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not anthropic_key:
        return True  # no key → skip gate, show photo
    try:
        # Download image and encode as base64 so we don't rely on URL passthrough
        img_resp = httpx.get(url, timeout=8, follow_redirects=True)
        img_resp.raise_for_status()
        content_type = img_resp.headers.get("content-type", "image/jpeg").split(";")[0].strip()
        if content_type not in ("image/jpeg", "image/png", "image/gif", "image/webp"):
            content_type = "image/jpeg"
        b64 = base64.standard_b64encode(img_resp.content).decode()

        client = anthropic_sdk.Anthropic(api_key=anthropic_key)
        resp = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=5,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {"type": "base64", "media_type": content_type, "data": b64},
                    },
                    {
                        "type": "text",
                        "text": (
                            f"Does this photo accurately and specifically depict '{title}' "
                            f"in or around {location}? "
                            "Answer YES if it clearly shows the activity, landmark, or scene. "
                            "Answer NO if it is generic, unrelated, or could be anywhere. "
                            "Reply with YES or NO only."
                        ),
                    },
                ],
            }],
        )
        answer = resp.content[0].text.strip().upper()
        return answer.startswith("YES")
    except Exception as exc:
        logger.warning("Photo verify failed for %s: %s", url, exc)
        return False


def _unsplash_candidates(query: str, n: int = 8) -> list[str]:
    """Search Unsplash and return up to n landscape photo URLs, best quality first."""
    try:
        resp = httpx.get(
            "https://api.unsplash.com/search/photos",
            params={"query": query, "per_page": n, "orientation": "landscape", "content_filter": "high", "order_by": "relevant"},
            headers={"Authorization": f"Client-ID {UNSPLASH_ACCESS_KEY}"},
            timeout=8,
        )
        resp.raise_for_status()
        results = resp.json().get("results", [])
        # Sort by resolution descending so the best image is first
        results.sort(key=lambda p: p.get("width", 0) * p.get("height", 0), reverse=True)
        return [url for r in results if (url := r.get("urls", {}).get("regular"))]
    except Exception:
        pass
    return []


def _activity_search_queries(title: str, location: str) -> list[str]:
    """Break a compound activity title into focused Unsplash queries.

    'Runyon Canyon & Breakfast in Los Feliz' + 'Los Angeles'
      → ['Runyon Canyon Los Angeles', 'Breakfast Los Angeles']
    """
    parts = re.split(r"\s*&\s*|\s+and\s+", title, flags=re.IGNORECASE)
    queries = []
    for part in parts[:2]:
        clean = re.sub(r"\s+(?:in|at|near)\s+.+$", "", part, flags=re.IGNORECASE).strip()
        if clean:
            queries.append(f"{clean} {location}")
    return queries or [f"{title} {location}"]


def fetch_activity_photo_candidates(title: str, location: str) -> dict:
    """Shared helper: return a single verified landscape photo URL for an activity block."""
    if not UNSPLASH_ACCESS_KEY:
        return {"candidates": []}
    seen: set[str] = set()
    for query in _activity_search_queries(title, location):
        for url in _unsplash_candidates(query):
            if url in seen:
                continue
            seen.add(url)
            if _verify_activity_photo(url, title, location):
                logger.info("Photo verified for '%s' @ %s: %s", title, location, url)
                return {"candidates": [url]}
    logger.info("No verified photo found for '%s' @ %s", title, location)
    return {"candidates": []}


@router.get("/activity-photo")
def activity_photo(
    title: str = Query(..., description="Activity block title, e.g. 'Runyon Canyon & Breakfast in Los Feliz'"),
    location: str = Query(..., description="Location/city, e.g. 'Los Angeles'"),
    _client=Depends(get_current_client),
):
    return fetch_activity_photo_candidates(title, location)


@router.get("/place-lookup")
def place_lookup(
    query: str = Query(..., description="Hotel name + destination, e.g. 'Park Hyatt Tokyo'"),
    _client=Depends(get_current_client),
):
    """Proxy a Google Places text search. Returns photo_url, place_id, rating, website, address."""
    if not PLACES_API_KEY:
        raise HTTPException(status_code=503, detail="Places API not configured")

    try:
        resp = httpx.post(
            PLACES_SEARCH_URL,
            json={"textQuery": query, "maxResultCount": 1},
            headers={
                "Content-Type": "application/json",
                "X-Goog-Api-Key": PLACES_API_KEY,
                "X-Goog-FieldMask": "places.id,places.photos,places.rating,places.websiteUri,places.formattedAddress",
            },
            timeout=8,
        )
        resp.raise_for_status()
    except httpx.RequestError:
        raise HTTPException(status_code=503, detail="Places service unavailable")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Places API error: {e.response.status_code}")

    data = resp.json()
    place = (data.get("places") or [None])[0]
    if not place:
        return {"photo_url": None, "place_id": None, "rating": None, "website": None, "address": None}

    photo_ref = (place.get("photos") or [{}])[0].get("name")
    photo_url = (
        f"https://places.googleapis.com/v1/{photo_ref}/media?maxHeightPx=480&maxWidthPx=640&key={PLACES_API_KEY}"
        if photo_ref else None
    )

    return {
        "photo_url": photo_url,
        "place_id": place.get("id"),
        "rating": place.get("rating"),
        "website": place.get("websiteUri"),
        "address": place.get("formattedAddress"),
    }


# ─── Client Stay CRUD ─────────────────────────────────────────────────────────

class ClientStayCreate(PydanticBaseModel):
    name: str
    address: Optional[str] = None
    check_in: datetime
    check_out: datetime
    confirmation_number: Optional[str] = None
    notes: Optional[str] = None
    # Pre-populated from hotel suggestion (optional)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    google_place_id: Optional[str] = None
    website: Optional[str] = None
    rating: Optional[float] = None
    photo_reference: Optional[str] = None


def _trip_belongs_to_client(trip_id: uuid.UUID, client_id: uuid.UUID, db: Session) -> Trip:
    trip = db.query(Trip).filter(Trip.id == trip_id, Trip.client_id == client_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return trip


@router.get("/trips/{trip_id}/stays", response_model=list[StayOut])
def list_stays(trip_id: uuid.UUID, db: Session = Depends(get_db), client=Depends(get_current_client)):
    _trip_belongs_to_client(trip_id, client.id, db)
    return db.query(Stay).filter(Stay.trip_id == trip_id).order_by(Stay.stay_order).all()


@router.post("/trips/{trip_id}/stays", response_model=StayOut, status_code=201)
def add_stay(
    trip_id: uuid.UUID,
    body: ClientStayCreate,
    db: Session = Depends(get_db),
    client=Depends(get_current_client),
):
    trip = _trip_belongs_to_client(trip_id, client.id, db)

    if body.check_out <= body.check_in:
        raise HTTPException(status_code=422, detail="check_out must be after check_in")

    # Determine stay_order (append after existing stays)
    existing = db.query(Stay).filter(Stay.trip_id == trip_id).order_by(Stay.stay_order).all()
    next_order = (existing[-1].stay_order + 1) if existing else 1

    stay = Stay(
        trip_id=trip_id,
        stay_order=next_order,
        name=body.name,
        address=body.address,
        check_in=body.check_in,
        check_out=body.check_out,
        confirmation_number=body.confirmation_number,
        notes=body.notes,
        latitude=body.latitude,
        longitude=body.longitude,
        google_place_id=body.google_place_id,
        website=body.website,
        rating=body.rating,
        photo_reference=body.photo_reference,
    )
    db.add(stay)
    db.commit()
    db.refresh(stay)

    # If no coordinates yet, enrich in background via Google Places
    if not stay.latitude:
        from app.services.places import enrich_stay
        stay_id = stay.id
        def _enrich():
            from app.db import SessionLocal
            _db = SessionLocal()
            try:
                _stay = _db.query(Stay).filter(Stay.id == stay_id).first()
                if _stay:
                    enrich_stay(_stay, _db)
            finally:
                _db.close()
        threading.Thread(target=_enrich, daemon=True).start()

    logger.info("Client added stay '%s' to trip %s", stay.name, trip_id)
    return stay


@router.delete("/trips/{trip_id}/stays/{stay_id}", status_code=204)
def remove_stay(
    trip_id: uuid.UUID,
    stay_id: uuid.UUID,
    db: Session = Depends(get_db),
    client=Depends(get_current_client),
):
    _trip_belongs_to_client(trip_id, client.id, db)
    stay = db.query(Stay).filter(Stay.id == stay_id, Stay.trip_id == trip_id).first()
    if not stay:
        raise HTTPException(status_code=404, detail="Stay not found")
    db.delete(stay)
    db.commit()
