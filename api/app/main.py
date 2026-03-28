from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from alembic.config import Config
from alembic import command
from app.limiter import limiter
import os
import sentry_sdk
from pathlib import Path
from app.db import engine, Base, SessionLocal, DATABASE_URL
from app.routes import auth, intake, client, admin
from app.services.seed import seed_destinations
from app.security import hash_password

sentry_dsn = os.getenv("SENTRY_DSN", "")
if sentry_dsn:
    sentry_sdk.init(
        dsn=sentry_dsn,
        environment=os.getenv("ENVIRONMENT", "production"),
        traces_sample_rate=0.2,
        send_default_pii=False,
    )


def run_migrations():
    # SQLite is only used in tests — use create_all there, Alembic for Postgres
    if DATABASE_URL.startswith("sqlite"):
        Base.metadata.create_all(bind=engine)
        return
    here = Path(__file__).parent.parent  # api/
    alembic_cfg = Config(str(here / "alembic.ini"))
    alembic_cfg.set_main_option("script_location", str(here / "alembic"))
    command.upgrade(alembic_cfg, "head")


@asynccontextmanager
async def lifespan(app: FastAPI):
    run_migrations()
    # Hash the admin password once at startup and cache in memory
    plain = os.getenv("ADMIN_PASSWORD", "admin123")
    auth.ADMIN_PASSWORD_HASH = hash_password(plain)
    if os.getenv("SEED_ON_STARTUP", "true").lower() == "true":
        db = SessionLocal()
        try:
            seed_destinations(db)
        finally:
            db.close()
    yield


app = FastAPI(
    title="Papaya Travel Portal API",
    description="Backend API for the Papaya Travel Portal",
    version="1.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth.router)
app.include_router(intake.router)
app.include_router(client.router)
app.include_router(admin.router)


@app.get("/health")
def health():
    return {"status": "ok"}


