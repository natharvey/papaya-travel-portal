from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from app.db import engine, Base, SessionLocal
from app.routes import auth, intake, client, admin
from app.services.seed import seed_destinations


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
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
