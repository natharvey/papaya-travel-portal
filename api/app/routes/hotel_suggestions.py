"""
Hotel suggestion management — per-trip, per-destination.

Suggestions are seeded from the itinerary JSON on first access, then managed
independently. Dismissed suggestions are remembered and excluded from future fetches.
"""
import math
import uuid
import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.db import get_db
from app.models import Trip, Itinerary, HotelSuggestionRecord
from app.routes.client import get_current_client
from app.models import Client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/client", tags=["hotel-suggestions"])


def _trip_belongs_to_client(trip_id, client_id, db: Session) -> Trip:
    trip = db.query(Trip).filter(Trip.id == trip_id, Trip.client_id == client_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return trip


def _seed_from_itinerary(trip_id, destination: str, db: Session) -> None:
    """Seed hotel_suggestion_records from the latest itinerary JSON for this destination."""
    latest = (
        db.query(Itinerary)
        .filter(Itinerary.trip_id == trip_id)
        .order_by(Itinerary.version.desc())
        .first()
    )
    if not latest:
        return
    raw = latest.itinerary_json.get("hotel_suggestions") or []
    dest_lower = destination.lower()
    to_seed = [h for h in raw if h.get("destination", "").lower() == dest_lower]

    # Fetch existing names to avoid duplicates (guards against race conditions)
    existing_names = {
        r.hotel_data.get("name", "").lower()
        for r in db.query(HotelSuggestionRecord).filter(
            HotelSuggestionRecord.trip_id == trip_id,
            HotelSuggestionRecord.destination == destination,
        ).all()
    }

    added = 0
    for hotel in to_seed:
        if hotel.get("name", "").lower() in existing_names:
            continue
        record = HotelSuggestionRecord(
            trip_id=trip_id,
            destination=destination,
            hotel_data=hotel,
            status="suggestion",
        )
        db.add(record)
        existing_names.add(hotel.get("name", "").lower())
        added += 1
    if added:
        db.commit()
        logger.info("Seeded %d hotel suggestions for trip %s / %s", added, trip_id, destination)


def _calc_fetch_count(current_non_dismissed: int) -> int:
    """target = ceil(current/3)*3 + 3; fetch = target - current.

    Guarantees:
      - Total is always a multiple of 3
      - At least 3 new suggestions are added
      - Extra suggestions top up to the nearest multiple of 3 first
    """
    target = math.ceil(max(current_non_dismissed, 1) / 3) * 3 + 3
    return target - current_non_dismissed


# ── GET suggestions for a destination (auto-seeds on first call) ─────────────

@router.get("/trips/{trip_id}/hotel-suggestions")
def get_hotel_suggestions(
    trip_id: uuid.UUID,
    destination: str = Query(...),
    db: Session = Depends(get_db),
    client: Client = Depends(get_current_client),
):
    _trip_belongs_to_client(trip_id, client.id, db)

    existing = (
        db.query(HotelSuggestionRecord)
        .filter(
            HotelSuggestionRecord.trip_id == trip_id,
            HotelSuggestionRecord.destination == destination,
        )
        .all()
    )

    # Auto-seed from itinerary JSON on first access
    if not existing:
        _seed_from_itinerary(trip_id, destination, db)
        existing = (
            db.query(HotelSuggestionRecord)
            .filter(
                HotelSuggestionRecord.trip_id == trip_id,
                HotelSuggestionRecord.destination == destination,
            )
            .all()
        )

    return [_record_out(r) for r in existing]


# ── PATCH suggestion status ───────────────────────────────────────────────────

class StatusUpdate(BaseModel):
    status: str  # "suggestion" | "saved" | "dismissed"


@router.patch("/trips/{trip_id}/hotel-suggestions/{suggestion_id}")
def update_suggestion_status(
    trip_id: uuid.UUID,
    suggestion_id: uuid.UUID,
    body: StatusUpdate,
    db: Session = Depends(get_db),
    client: Client = Depends(get_current_client),
):
    _trip_belongs_to_client(trip_id, client.id, db)

    if body.status not in ("suggestion", "saved", "dismissed"):
        raise HTTPException(status_code=422, detail="status must be suggestion, saved, or dismissed")

    record = db.query(HotelSuggestionRecord).filter(
        HotelSuggestionRecord.id == suggestion_id,
        HotelSuggestionRecord.trip_id == trip_id,
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="Suggestion not found")

    record.status = body.status
    db.commit()
    db.refresh(record)
    return _record_out(record)


# ── POST fetch more suggestions for a destination ─────────────────────────────

class FetchMoreRequest(BaseModel):
    destination: str
    accommodation_style: str = "Mid-range Hotel"
    budget_range: str = ""
    traveller_profile: str = ""


@router.post("/trips/{trip_id}/hotel-suggestions/fetch")
def fetch_more_suggestions(
    trip_id: uuid.UUID,
    body: FetchMoreRequest,
    db: Session = Depends(get_db),
    client: Client = Depends(get_current_client),
):
    from app.services.ai import generate_accommodation_for_destination
    from app.models import Trip as TripModel, IntakeResponse

    trip = _trip_belongs_to_client(trip_id, client.id, db)

    # Load all existing records for this destination
    all_records = (
        db.query(HotelSuggestionRecord)
        .filter(
            HotelSuggestionRecord.trip_id == trip_id,
            HotelSuggestionRecord.destination == body.destination,
        )
        .all()
    )

    # Names to exclude (all already known — dismissed ones excluded from display but still excluded from AI)
    exclude_names = [r.hotel_data.get("name", "") for r in all_records if r.hotel_data.get("name")]
    non_dismissed = [r for r in all_records if r.status != "dismissed"]
    current_count = len(non_dismissed)
    fetch_count = _calc_fetch_count(current_count)

    # Enrich profile from intake if available
    accommodation_style = body.accommodation_style
    budget_range = body.budget_range
    traveller_profile = body.traveller_profile

    intake = db.query(IntakeResponse).filter(IntakeResponse.trip_id == trip_id).first()
    if intake:
        accommodation_style = intake.accommodation_style or accommodation_style
        traveller_profile = f"{intake.travellers_count} traveller(s), {intake.accommodation_style}"

    budget_range = budget_range or trip.budget_range

    try:
        new_hotels = generate_accommodation_for_destination(
            destination=body.destination,
            trip_title=trip.title,
            budget_range=budget_range,
            accommodation_style=accommodation_style,
            traveller_profile=traveller_profile,
            count=fetch_count,
            exclude_names=exclude_names,
        )
    except Exception as e:
        logger.error("Failed to fetch more hotel suggestions for trip %s: %s", trip_id, e)
        raise HTTPException(status_code=500, detail="Failed to fetch suggestions. Please try again.")

    # Save new records
    for hotel in new_hotels:
        hotel.setdefault("destination", body.destination)
        record = HotelSuggestionRecord(
            trip_id=trip_id,
            destination=body.destination,
            hotel_data=hotel,
            status="suggestion",
        )
        db.add(record)
    db.commit()

    # Return all non-dismissed records (including newly added)
    updated = (
        db.query(HotelSuggestionRecord)
        .filter(
            HotelSuggestionRecord.trip_id == trip_id,
            HotelSuggestionRecord.destination == body.destination,
            HotelSuggestionRecord.status != "dismissed",
        )
        .order_by(HotelSuggestionRecord.created_at)
        .all()
    )
    return [_record_out(r) for r in updated]


# ── GET saved suggestions across all destinations ─────────────────────────────

@router.get("/trips/{trip_id}/hotel-suggestions/saved")
def get_saved_suggestions(
    trip_id: uuid.UUID,
    db: Session = Depends(get_db),
    client: Client = Depends(get_current_client),
):
    _trip_belongs_to_client(trip_id, client.id, db)
    saved = (
        db.query(HotelSuggestionRecord)
        .filter(
            HotelSuggestionRecord.trip_id == trip_id,
            HotelSuggestionRecord.status == "saved",
        )
        .order_by(HotelSuggestionRecord.created_at)
        .all()
    )
    return [_record_out(r) for r in saved]


# ── Serialiser ────────────────────────────────────────────────────────────────

def _record_out(r: HotelSuggestionRecord) -> dict:
    return {
        "id": str(r.id),
        "destination": r.destination,
        "hotel_data": r.hotel_data,
        "status": r.status,
        "created_at": r.created_at.isoformat(),
    }
