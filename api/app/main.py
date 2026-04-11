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
import threading
import sentry_sdk
from pathlib import Path
from app.db import engine, Base, SessionLocal, DATABASE_URL
from app.routes import auth, intake, client, admin
from app.services.seed import seed_destinations, seed_demo_trip, seed_sarah_trips
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
    from sqlalchemy import inspect
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    if "alembic_version" not in tables:
        # Fresh database: create all tables from models and stamp as up-to-date
        Base.metadata.create_all(bind=engine)
        command.stamp(alembic_cfg, "head")
    else:
        command.upgrade(alembic_cfg, "head")


def _resume_stuck_generations():
    """On startup, re-trigger generation for any trips that never got an itinerary.

    This covers two cases:
    - status=GENERATING: task was killed mid-flight (e.g. during a deploy)
    - status=INTAKE: generation failed and rolled back, trip still has no itinerary
    """
    import logging
    import time
    from app.models import Trip, Itinerary, IntakeResponse as IntakeResponseModel
    from app.routes.intake import _run_generation
    log = logging.getLogger(__name__)
    time.sleep(5)  # Let the server finish starting up
    db = SessionLocal()
    try:
        stuck = (
            db.query(Trip)
            .outerjoin(Itinerary, Itinerary.trip_id == Trip.id)
            .join(IntakeResponseModel, IntakeResponseModel.trip_id == Trip.id)
            .filter(Trip.status.in_(["GENERATING", "INTAKE"]), Itinerary.id == None)  # noqa: E711
            .all()
        )
        if stuck:
            log.info("Resuming %d stuck generation(s) after startup", len(stuck))
        for trip in stuck:
            log.info("Re-triggering generation for trip %s", trip.id)
            trip.status = "GENERATING"
            db.commit()
            threading.Thread(
                target=_run_generation,
                args=(trip.id, ""),
                daemon=True,
            ).start()
    except Exception as e:
        log.error("Failed to resume stuck generations: %s", e)
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    jwt_secret = os.getenv("JWT_SECRET", "")
    if not jwt_secret or jwt_secret == "change-me-in-production":
        if not DATABASE_URL.startswith("sqlite"):
            raise RuntimeError(
                "JWT_SECRET environment variable must be set to a strong random value. "
                "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\""
            )
    run_migrations()
    # Hash the admin password once at startup and cache in memory
    plain = os.getenv("ADMIN_PASSWORD", "admin123")
    auth.ADMIN_PASSWORD_HASH = hash_password(plain)
    if os.getenv("SEED_ON_STARTUP", "true").lower() == "true":
        db = SessionLocal()
        try:
            seed_destinations(db)
            seed_demo_trip(db)
            seed_sarah_trips(db)
        finally:
            db.close()

    # Resume any trips stuck in GENERATING (e.g. killed mid-task by a deploy)
    threading.Thread(target=_resume_stuck_generations, daemon=True).start()

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
    try:
        db = SessionLocal()
        db.execute(__import__("sqlalchemy").text("SELECT 1"))
        db.close()
        return {"status": "ok", "db": "ok"}
    except Exception:
        return JSONResponse(status_code=503, content={"status": "error", "db": "unreachable"})


