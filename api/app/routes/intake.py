import random
import string
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Client, Trip, IntakeResponse as IntakeResponseModel
from app.schemas import IntakeCreate, IntakeResponse
from app.services.email import send_intake_confirmation
from app.limiter import limiter

router = APIRouter(prefix="/intake", tags=["intake"])


def generate_reference_code(length: int = 8) -> str:
    chars = string.ascii_uppercase + string.digits
    return "".join(random.choices(chars, k=length))


def get_or_create_client(db: Session, email: str, name: str) -> Client:
    client = db.query(Client).filter(Client.email == email).first()
    if client:
        # Update name if changed
        if client.name != name:
            client.name = name
            db.commit()
        return client
    # Create new client
    ref_code = generate_reference_code()
    # Ensure uniqueness
    while db.query(Client).filter(Client.reference_code == ref_code).first():
        ref_code = generate_reference_code()
    client = Client(email=email, name=name, reference_code=ref_code)
    db.add(client)
    db.commit()
    db.refresh(client)
    return client


@router.post("", response_model=IntakeResponse)
@limiter.limit("10/hour")
def create_intake(request: Request, payload: IntakeCreate, db: Session = Depends(get_db)):
    client = get_or_create_client(db, str(payload.client_email), payload.client_name)

    trip = Trip(
        client_id=client.id,
        title=payload.trip_title,
        origin_city=payload.origin_city,
        start_date=payload.start_date,
        end_date=payload.end_date,
        budget_range=payload.budget_range,
        pace=payload.pace,
        status="INTAKE",
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

    send_intake_confirmation(
        to=client.email,
        client_name=client.name,
        reference_code=client.reference_code,
        trip_title=trip.title,
    )

    return IntakeResponse(
        email=client.email,
        reference_code=client.reference_code,
        trip_id=trip.id,
        message=(
            f"Your Papaya portal login is {client.email} + {client.reference_code}. "
            "We've sent your reference code to your email — please save it to log in to your portal."
        ),
    )
