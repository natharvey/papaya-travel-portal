import uuid
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
import httpx

from app.db import get_db
from app.models import Client, Trip, Itinerary, Message, Flight, Stay
from app.schemas import (
    TripWithLatestItinerary, TripDetail, MessageCreate, MessageOut, ItineraryOut, FlightOut
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


@router.get("/destination-photo")
def destination_photo(
    destination: str = Query(..., description="Destination name, e.g. 'Kyoto, Japan'"),
    _client=Depends(get_current_client),
):
    """Return a high-quality hero photo URL for a travel destination.
    Uses Unsplash API if UNSPLASH_ACCESS_KEY is set, otherwise falls back to Google Places."""
    if UNSPLASH_ACCESS_KEY:
        try:
            resp = httpx.get(
                "https://api.unsplash.com/search/photos",
                params={
                    "query": f"{destination} travel landscape",
                    "per_page": 3,
                    "orientation": "landscape",
                    "content_filter": "high",
                    "order_by": "relevant",
                },
                headers={"Authorization": f"Client-ID {UNSPLASH_ACCESS_KEY}"},
                timeout=8,
            )
            resp.raise_for_status()
            results = resp.json().get("results", [])
            if results:
                # Prefer the photo with the highest resolution
                best = max(results, key=lambda p: p.get("width", 0) * p.get("height", 0))
                url = best.get("urls", {}).get("full") or best.get("urls", {}).get("regular")
                if url:
                    return {"photo_url": url, "source": "unsplash"}
        except Exception:
            pass  # fall through to Places

    # Fallback: Google Places at maximum resolution
    if PLACES_API_KEY:
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
                    url = f"https://places.googleapis.com/v1/{photo_ref}/media?maxHeightPx=4800&maxWidthPx=4800&key={PLACES_API_KEY}"
                    return {"photo_url": url, "source": "places"}
        except Exception:
            pass

    return {"photo_url": None, "source": None}


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
