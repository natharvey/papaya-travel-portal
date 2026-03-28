import uuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session, joinedload
from jose import jwt, JWTError
import os

from app.db import get_db
from app.models import Client, Trip, Itinerary, Message
from app.schemas import (
    TripWithLatestItinerary, TripDetail, MessageCreate, MessageOut, ItineraryOut
)
from app.services.email import send_trip_confirmed_client, send_trip_confirmed_admin

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
        )
        .first()
    )
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return TripDetail.model_validate(trip)


@router.post("/trips/{trip_id}/confirm")
def confirm_trip(
    trip_id: uuid.UUID,
    client: Client = Depends(get_current_client),
    db: Session = Depends(get_db),
):
    trip = db.query(Trip).filter(Trip.id == trip_id, Trip.client_id == client.id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if trip.status != "REVIEW":
        raise HTTPException(status_code=400, detail="Your itinerary must be in review before it can be confirmed.")
    trip.status = "CONFIRMED"
    trip.updated_at = datetime.utcnow()
    db.commit()
    send_trip_confirmed_client(
        to=client.email,
        client_name=client.name,
        trip_title=trip.title,
        trip_id=str(trip_id),
    )
    send_trip_confirmed_admin(
        client_name=client.name,
        client_email=client.email,
        trip_title=trip.title,
        trip_id=str(trip_id),
    )
    return {"message": "Trip confirmed successfully."}


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
    return MessageOut.model_validate(msg)
