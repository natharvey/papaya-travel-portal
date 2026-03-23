import uuid
import enum
from datetime import datetime, date
from sqlalchemy import (
    Column, String, Integer, DateTime, Date, ForeignKey, Text, Boolean,
    Enum as SAEnum, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.types import JSON, TypeDecorator, CHAR
from sqlalchemy.orm import relationship
from app.db import Base


# Cross-DB UUID type
class UUIDType(TypeDecorator):
    """Platform-independent UUID type. Uses PostgreSQL's UUID type, or CHAR(36) on SQLite."""
    impl = CHAR
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(PGUUID(as_uuid=True))
        else:
            return dialect.type_descriptor(CHAR(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        if dialect.name == "postgresql":
            return str(value)
        if not isinstance(value, uuid.UUID):
            return str(uuid.UUID(str(value)))
        return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        if not isinstance(value, uuid.UUID):
            return uuid.UUID(str(value))
        return value


class TripStatus(str, enum.Enum):
    INTAKE = "INTAKE"
    DRAFT = "DRAFT"
    REVIEW = "REVIEW"
    CONFIRMED = "CONFIRMED"
    ARCHIVED = "ARCHIVED"


class SenderType(str, enum.Enum):
    CLIENT = "CLIENT"
    ADMIN = "ADMIN"


class Client(Base):
    __tablename__ = "clients"

    id = Column(UUIDType, primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    reference_code = Column(String(16), unique=True, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    trips = relationship("Trip", back_populates="client")


class Trip(Base):
    __tablename__ = "trips"

    id = Column(UUIDType, primary_key=True, default=uuid.uuid4)
    client_id = Column(UUIDType, ForeignKey("clients.id"), nullable=False, index=True)
    title = Column(String(500), nullable=False)
    origin_city = Column(String(255), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    budget_range = Column(String(255), nullable=False)
    pace = Column(String(100), nullable=False)
    status = Column(String(20), default=TripStatus.INTAKE.value, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    client = relationship("Client", back_populates="trips")
    intake_response = relationship("IntakeResponse", back_populates="trip", uselist=False)
    itineraries = relationship("Itinerary", back_populates="trip", order_by="Itinerary.version")
    messages = relationship("Message", back_populates="trip", order_by="Message.created_at")


class IntakeResponse(Base):
    __tablename__ = "intake_responses"

    id = Column(UUIDType, primary_key=True, default=uuid.uuid4)
    trip_id = Column(UUIDType, ForeignKey("trips.id"), unique=True, nullable=False)
    travellers_count = Column(Integer, nullable=False)
    interests = Column(JSON, nullable=False, default=list)
    constraints = Column(Text, default="")
    accommodation_style = Column(String(255), nullable=False)
    must_dos = Column(Text, default="")
    must_avoid = Column(Text, default="")
    notes = Column(Text, default="")
    raw_json = Column(JSON, nullable=False, default=dict)

    trip = relationship("Trip", back_populates="intake_response")


class Itinerary(Base):
    __tablename__ = "itineraries"

    id = Column(UUIDType, primary_key=True, default=uuid.uuid4)
    trip_id = Column(UUIDType, ForeignKey("trips.id"), nullable=False, index=True)
    itinerary_json = Column(JSON, nullable=False, default=dict)
    rendered_md = Column(Text, nullable=True)
    version = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    trip = relationship("Trip", back_populates="itineraries")


class Message(Base):
    __tablename__ = "messages"

    id = Column(UUIDType, primary_key=True, default=uuid.uuid4)
    trip_id = Column(UUIDType, ForeignKey("trips.id"), nullable=False, index=True)
    sender_type = Column(String(10), nullable=False)
    body = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    trip = relationship("Trip", back_populates="messages")


class DestinationCard(Base):
    __tablename__ = "destination_cards"

    id = Column(UUIDType, primary_key=True, default=uuid.uuid4)
    destination = Column(String(255), nullable=False, index=True)
    region = Column(String(255), nullable=False)
    tags = Column(JSON, nullable=False, default=list)
    best_season = Column(String(255), nullable=False)
    summary = Column(Text, nullable=False)
    neighbourhoods = Column(Text, nullable=False)
    must_do = Column(Text, nullable=False)
    transport_tips = Column(Text, nullable=False)
    safety_notes = Column(Text, nullable=False)
    budget_notes = Column(Text, nullable=False)
    sample_day_blocks = Column(JSON, nullable=False, default=list)
    raw_text = Column(Text, nullable=False)
