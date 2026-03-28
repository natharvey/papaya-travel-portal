import os
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from jose import jwt

from app.db import get_db
from app.models import Client
from app.schemas import ClientLoginRequest, AdminLoginRequest, TokenResponse, ResendReferenceRequest
from app.services.email import send_intake_confirmation
from app.security import verify_password

router = APIRouter(prefix="/auth", tags=["auth"])

JWT_SECRET = os.getenv("JWT_SECRET", "change-me-in-production")
ALGORITHM = "HS256"
CLIENT_TOKEN_EXPIRE_HOURS = 24
ADMIN_TOKEN_EXPIRE_HOURS = 8

# Set at startup by main.py lifespan — never holds plain text
ADMIN_PASSWORD_HASH: str = ""


def create_token(data: dict, expires_delta: timedelta) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + expires_delta
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    return jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])


@router.post("/client-login", response_model=TokenResponse)
def client_login(payload: ClientLoginRequest, db: Session = Depends(get_db)):
    client = db.query(Client).filter(
        Client.email == payload.email,
        Client.reference_code == payload.reference_code,
    ).first()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or reference code",
        )
    token = create_token(
        {"sub": str(client.id), "role": "client"},
        timedelta(hours=CLIENT_TOKEN_EXPIRE_HOURS),
    )
    return TokenResponse(access_token=token, role="client")


@router.post("/resend-reference")
def resend_reference(payload: ResendReferenceRequest, db: Session = Depends(get_db)):
    client = db.query(Client).filter(Client.email == payload.email).first()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found with that email address. Please check the address or submit a new trip enquiry.",
        )
    send_intake_confirmation(
        to=client.email,
        client_name=client.name,
        reference_code=client.reference_code,
        trip_title="your trip",
    )
    return {"message": f"Your reference code has been sent to {client.email}. Please check your inbox."}


@router.post("/admin-login", response_model=TokenResponse)
def admin_login(payload: AdminLoginRequest):
    if not ADMIN_PASSWORD_HASH or not verify_password(payload.password, ADMIN_PASSWORD_HASH):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin password",
        )
    token = create_token(
        {"sub": "admin", "role": "admin"},
        timedelta(hours=ADMIN_TOKEN_EXPIRE_HOURS),
    )
    return TokenResponse(access_token=token, role="admin")
