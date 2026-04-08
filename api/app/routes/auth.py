import os
import secrets
from typing import Optional
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from jose import jwt
from app.limiter import limiter

from app.db import get_db
from app.models import Client, LoginToken
from app.schemas import ClientLoginRequest, AdminLoginRequest, TokenResponse, ResendReferenceRequest
from app.services.email import send_intake_confirmation, send_magic_link_email
from app.security import verify_password

router = APIRouter(prefix="/auth", tags=["auth"])

JWT_SECRET = os.getenv("JWT_SECRET", "change-me-in-production")
ALGORITHM = "HS256"
CLIENT_TOKEN_EXPIRE_HOURS = 168  # 7 days
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


def create_magic_token(db: Session, client_id) -> str:
    """Generate a one-time login token valid for 1 hour."""
    token_str = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(hours=1)
    record = LoginToken(client_id=client_id, token=token_str, expires_at=expires)
    db.add(record)
    db.commit()
    return token_str


@router.post("/client-login", response_model=TokenResponse)
@limiter.limit("10/minute")
def client_login(request: Request, payload: ClientLoginRequest, db: Session = Depends(get_db)):
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
@limiter.limit("5/minute")
def resend_reference(request: Request, payload: ResendReferenceRequest, db: Session = Depends(get_db)):
    client = db.query(Client).filter(Client.email == payload.email).first()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found with that email address. Please check the address or submit a new trip enquiry.",
        )
    magic_token = create_magic_token(db, client.id)
    portal_url = os.getenv("PORTAL_URL", "http://localhost:5173")
    magic_link = f"{portal_url}/magic/{magic_token}"
    send_intake_confirmation(
        to=client.email,
        client_name=client.name,
        reference_code=client.reference_code,
        trip_title="your trip",
        magic_link=magic_link,
    )
    return {"message": f"Your reference code has been sent to {client.email}. Please check your inbox."}


@router.post("/request-magic-link")
@limiter.limit("5/minute")
def request_magic_link(request: Request, payload: ResendReferenceRequest, db: Session = Depends(get_db)):
    client = db.query(Client).filter(Client.email == payload.email).first()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found with that email address. Please check the address or submit a new trip enquiry.",
        )
    magic_token = create_magic_token(db, client.id)
    portal_url = os.getenv("PORTAL_URL", "http://localhost:5173")
    magic_link = f"{portal_url}/magic/{magic_token}"
    send_magic_link_email(to=client.email, client_name=client.name, magic_link=magic_link)
    return {"message": f"A login link has been sent to {client.email}. Please check your inbox."}


@router.post("/admin-login", response_model=TokenResponse)
@limiter.limit("5/minute")
def admin_login(request: Request, payload: AdminLoginRequest):
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


@router.get("/magic/{token}", response_model=TokenResponse)
@limiter.limit("20/minute")
def magic_login(request: Request, token: str, db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    record = (
        db.query(LoginToken)
        .filter(
            LoginToken.token == token,
            LoginToken.used == False,  # noqa: E712
            LoginToken.expires_at > now,
        )
        .first()
    )
    if not record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This login link has expired or has already been used. Please request a new one from the login page.",
        )
    record.used = True
    db.commit()
    jwt_token = create_token(
        {"sub": str(record.client_id), "role": "client"},
        timedelta(hours=CLIENT_TOKEN_EXPIRE_HOURS),
    )
    return TokenResponse(access_token=jwt_token, role="client")
