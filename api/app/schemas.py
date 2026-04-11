from __future__ import annotations
import uuid
from datetime import date, datetime
from typing import Any, Optional
from pydantic import BaseModel, EmailStr, field_validator


# ─── Auth ────────────────────────────────────────────────────────────────────

class ResendReferenceRequest(BaseModel):
    email: EmailStr


class AdminLoginRequest(BaseModel):
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str


# ─── Intake ──────────────────────────────────────────────────────────────────

class IntakeCreate(BaseModel):
    # Client info
    client_name: str
    client_email: EmailStr
    # Trip info
    trip_title: str
    origin_city: str
    start_date: date
    end_date: date
    budget_range: str
    pace: str  # "relaxed", "moderate", "packed"
    # Intake details
    travellers_count: int
    interests: list[str]
    constraints: str = ""
    accommodation_style: str
    must_dos: str = ""
    must_avoid: str = ""
    notes: str = ""


class IntakeResponse(BaseModel):
    email: str
    trip_id: uuid.UUID
    message: str


# ─── Destination Card ────────────────────────────────────────────────────────

class SampleDayBlock(BaseModel):
    time: str
    activity: str
    duration: str
    cost_aud: Optional[float] = None


class DestinationCardOut(BaseModel):
    id: uuid.UUID
    destination: str
    region: str
    tags: list[str]
    best_season: str
    summary: str
    neighbourhoods: str
    must_do: str
    transport_tips: str
    safety_notes: str
    budget_notes: str
    sample_day_blocks: list[dict]
    raw_text: str

    model_config = {"from_attributes": True}


# ─── Intake Response ─────────────────────────────────────────────────────────

class IntakeResponseOut(BaseModel):
    id: uuid.UUID
    trip_id: uuid.UUID
    travellers_count: int
    interests: list[str]
    constraints: str
    accommodation_style: str
    must_dos: str
    must_avoid: str
    notes: str

    model_config = {"from_attributes": True}


# ─── Itinerary ───────────────────────────────────────────────────────────────

class ItineraryOut(BaseModel):
    id: uuid.UUID
    trip_id: uuid.UUID
    itinerary_json: dict
    rendered_md: Optional[str] = None
    version: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Message ─────────────────────────────────────────────────────────────────

class MessageCreate(BaseModel):
    body: str


class MessageOut(BaseModel):
    id: uuid.UUID
    trip_id: uuid.UUID
    sender_type: str
    body: str
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Client ──────────────────────────────────────────────────────────────────

class ClientOut(BaseModel):
    id: uuid.UUID
    email: str
    name: str
    reference_code: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Trip ────────────────────────────────────────────────────────────────────

class TripOut(BaseModel):
    id: uuid.UUID
    client_id: uuid.UUID
    title: str
    origin_city: str
    start_date: date
    end_date: date
    budget_range: str
    pace: str
    status: str
    admin_notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TripWithLatestItinerary(TripOut):
    latest_itinerary: Optional[ItineraryOut] = None


class TripDetail(TripOut):
    client: ClientOut
    intake_response: Optional[IntakeResponseOut] = None
    itineraries: list[ItineraryOut] = []
    messages: list[MessageOut] = []
    flights: list[FlightOut] = []
    stays: list[StayOut] = []


# ─── Flight ──────────────────────────────────────────────────────────────────

class FlightCreate(BaseModel):
    leg_order: int = 1
    flight_number: str
    airline: str
    departure_airport: str
    arrival_airport: str
    departure_time: datetime
    arrival_time: datetime
    terminal_departure: Optional[str] = None
    terminal_arrival: Optional[str] = None
    booking_ref: Optional[str] = None


class FlightOut(BaseModel):
    id: uuid.UUID
    trip_id: uuid.UUID
    leg_order: int
    flight_number: str
    airline: str
    departure_airport: str
    arrival_airport: str
    departure_time: datetime
    arrival_time: datetime
    terminal_departure: Optional[str] = None
    terminal_arrival: Optional[str] = None
    booking_ref: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Stay ────────────────────────────────────────────────────────────────────

class StayCreate(BaseModel):
    stay_order: int = 1
    name: str
    address: Optional[str] = None
    check_in: datetime
    check_out: datetime
    confirmation_number: Optional[str] = None
    notes: Optional[str] = None


class StayOut(BaseModel):
    id: uuid.UUID
    trip_id: uuid.UUID
    stay_order: int
    name: str
    address: Optional[str] = None
    check_in: datetime
    check_out: datetime
    confirmation_number: Optional[str] = None
    notes: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    website: Optional[str] = None
    google_place_id: Optional[str] = None
    photo_reference: Optional[str] = None
    rating: Optional[float] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Admin Trip Update ───────────────────────────────────────────────────────

class TripUpdate(BaseModel):
    status: Optional[str] = None
    title: Optional[str] = None
    admin_notes: Optional[str] = None


# ─── Admin Generate Itinerary ────────────────────────────────────────────────

class RegenerateRequest(BaseModel):
    instructions: str


# ─── Admin Trip List ─────────────────────────────────────────────────────────

class AdminTripListItem(BaseModel):
    id: uuid.UUID
    title: str
    origin_city: str
    start_date: date
    end_date: date
    budget_range: str
    pace: str
    status: str
    created_at: datetime
    updated_at: datetime
    client_name: str
    client_email: str
    unread_count: int = 0

    model_config = {"from_attributes": True}
