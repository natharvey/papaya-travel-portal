# Papaya Travel Portal

A production-leaning MVP travel planning portal for Australian travellers. Clients submit trip enquiries, and admins generate AI-powered personalised itineraries using OpenAI GPT-4o with structured outputs. Clients view their itineraries and communicate with the team via an in-portal messaging system.

---

## Quick Start (One Command)

```bash
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY
docker-compose up --build
```

The app will be available at:

| Service | URL |
|---------|-----|
| **Frontend (Client Portal)** | http://localhost:5173 |
| **API** | http://localhost:8000 |
| **API Docs (Swagger)** | http://localhost:8000/docs |
| **API Docs (ReDoc)** | http://localhost:8000/redoc |
| **PostgreSQL** | localhost:5432 |

---

## Default Admin Credentials

| Field | Value |
|-------|-------|
| URL | http://localhost:5173/admin/login |
| Password | `admin123` (set via `ADMIN_PASSWORD` in `.env`) |

---

## Client Portal Flow

1. Client visits http://localhost:5173/intake and submits a 3-step trip enquiry
2. Client receives an email + reference code
3. Client logs in at http://localhost:5173/login
4. Admin logs in, views the trip dashboard, generates an AI itinerary
5. Client sees the itinerary in their portal and can message the team

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Docker Compose                          │
│                                                                 │
│  ┌───────────────┐   ┌─────────────────┐   ┌────────────────┐  │
│  │  web (React)  │──▶│   api (FastAPI)  │──▶│   db (PG15)    │  │
│  │  Vite + TS    │   │   SQLAlchemy    │   │   PostgreSQL   │  │
│  │  Port 5173    │   │   Pydantic v2   │   │   Port 5432    │  │
│  └───────────────┘   │   Port 8000     │   └────────────────┘  │
│                      └────────┬────────┘                        │
│                               │                                 │
│                               ▼                                 │
│                      ┌─────────────────┐                        │
│                      │   OpenAI API    │                        │
│                      │   GPT-4o        │                        │
│                      │   Structured    │                        │
│                      │   Outputs       │                        │
│                      └─────────────────┘                        │
└─────────────────────────────────────────────────────────────────┘
```

### Key Components

**Backend (`/api`)**
- `app/main.py` — FastAPI app with CORS, startup hooks
- `app/models.py` — SQLAlchemy models (Client, Trip, IntakeResponse, Itinerary, Message, DestinationCard)
- `app/routes/auth.py` — JWT authentication for clients and admin
- `app/routes/intake.py` — Public intake form endpoint
- `app/routes/client.py` — Client portal API (trips, messages)
- `app/routes/admin.py` — Admin API (trip management, AI generation)
- `app/services/ai.py` — OpenAI GPT-4o itinerary generation with strict JSON schema
- `app/services/retrieval.py` — Destination card retrieval (FTS + keyword matching)
- `app/services/seed.py` — Destination card seeding from JSON files

**Frontend (`/web`)**
- React 18 + Vite + TypeScript
- React Router v6 for client-side routing
- Axios with JWT interceptors
- Papaya brand system (orange #FF6B35, navy #2D3A4A)

**Seed Data (`/seed/destinations`)**
- 35 destination cards covering Asia-Pacific, Europe, Americas, Middle East, Africa
- Used for AI context injection during itinerary generation

---

## Environment Variables

Copy `.env.example` to `.env` and configure:

```env
DATABASE_URL=postgresql://papaya:papaya_secret@db:5432/papaya
OPENAI_API_KEY=sk-your-key-here          # Required for AI features
JWT_SECRET=change-me-in-production       # Change for production!
ADMIN_PASSWORD=admin123                  # Change for production!
ADMIN_EMAIL=admin@papaya.travel
CORS_ORIGINS=http://localhost:5173
SEED_ON_STARTUP=true                     # Seeds destination cards on startup
```

---

## Local Development (without Docker)

### API

```bash
cd api
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Set env vars
export DATABASE_URL=postgresql://papaya:papaya_secret@localhost:5432/papaya
export JWT_SECRET=dev-secret
export ADMIN_PASSWORD=admin123
export OPENAI_API_KEY=sk-your-key

uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd web
npm install
VITE_API_URL=http://localhost:8000 npm run dev
```

### Run Tests

```bash
cd api
pytest tests/ -v
```

---

## API Reference

Full interactive documentation available at http://localhost:8000/docs

Key endpoints:

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/intake` | None | Submit trip enquiry |
| POST | `/auth/client-login` | None | Client login |
| POST | `/auth/admin-login` | None | Admin login |
| GET | `/client/trips` | Client JWT | List client trips |
| GET | `/client/trips/{id}` | Client JWT | Trip detail + itinerary |
| POST | `/client/trips/{id}/messages` | Client JWT | Send message |
| GET | `/admin/trips` | Admin JWT | All trips (filterable) |
| POST | `/admin/trips/{id}/generate-itinerary` | Admin JWT | Generate AI itinerary |
| POST | `/admin/trips/{id}/regenerate-itinerary` | Admin JWT | Regenerate with instructions |
| PATCH | `/admin/trips/{id}` | Admin JWT | Update trip status/title |
| GET | `/health` | None | Health check |

---

## CI/CD

GitHub Actions workflow (`.github/workflows/ci.yml`):
- **api-test**: Runs Python tests with SQLite in-memory database
- **web-build**: Runs TypeScript type check and Vite production build

Triggers on push to `main`/`develop` and PRs to `main`.

---

## Production Considerations

Before deploying to production:

1. **Change secrets**: `JWT_SECRET`, `ADMIN_PASSWORD`, database password
2. **HTTPS**: Add SSL/TLS termination (nginx, Caddy, or load balancer)
3. **CORS**: Update `CORS_ORIGINS` to your production domain
4. **Database**: Use managed PostgreSQL (RDS, Cloud SQL, Supabase)
5. **OpenAI costs**: Monitor token usage — GPT-4o is ~$5/1M input tokens
6. **Email**: Add email service for sending reference codes
7. **Backups**: Enable automated database backups
8. **Logging**: Add structured logging and error tracking (Sentry)
