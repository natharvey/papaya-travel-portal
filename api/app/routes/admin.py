import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session, joinedload
from jose import jwt, JWTError
import os

from app.db import get_db
from app.models import Trip, Client, Itinerary, Message
from app.schemas import (
    TripDetail, AdminTripListItem, TripUpdate, MessageCreate, MessageOut,
    ItineraryOut, RegenerateRequest,
)
from app.services.ai import generate_itinerary
from app.services.email import send_itinerary_for_review, send_new_message_to_client

router = APIRouter(prefix="/admin", tags=["admin"])
security = HTTPBearer()

JWT_SECRET = os.getenv("JWT_SECRET", "change-me-in-production")
ALGORITHM = "HS256"

VALID_STATUSES = {"INTAKE", "DRAFT", "REVIEW", "CONFIRMED", "ARCHIVED"}


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
        )
        .first()
    )
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if payload.status is not None:
        new_status = payload.status.upper()
        if new_status not in VALID_STATUSES:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of {VALID_STATUSES}")
        if new_status == "REVIEW" and trip.status != "REVIEW":
            send_itinerary_for_review(
                to=trip.client.email,
                client_name=trip.client.name,
                trip_title=trip.title,
                trip_id=str(trip_id),
            )
        trip.status = new_status
    if payload.title is not None:
        trip.title = payload.title
    from datetime import datetime
    trip.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(trip)
    return TripDetail.model_validate(trip)


@router.post("/trips/{trip_id}/generate-itinerary", response_model=ItineraryOut)
def generate_itinerary_endpoint(
    trip_id: uuid.UUID,
    _admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    trip = db.query(Trip).options(joinedload(Trip.client)).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    try:
        itinerary = generate_itinerary(db, trip_id=trip_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")
    return ItineraryOut.model_validate(itinerary)


@router.post("/trips/{trip_id}/regenerate-itinerary", response_model=ItineraryOut)
def regenerate_itinerary_endpoint(
    trip_id: uuid.UUID,
    payload: RegenerateRequest,
    _admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    try:
        itinerary = generate_itinerary(db, trip_id=trip_id, additional_instructions=payload.instructions)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")
    return ItineraryOut.model_validate(itinerary)


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
