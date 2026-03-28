# Papaya Travel Portal

A production-ready travel planning portal for Australian travellers. Clients submit trip enquiries and admins generate AI-powered personalised itineraries using OpenAI GPT-4o. Clients review, request changes, and approve their itinerary through a structured workflow, communicating with the team via an in-portal messaging system.

---

## Quick Start (One Command)

```bash
cp .env.example .env
# Edit .env and add your credentials (see Environment Variables below)
docker-compose up --build
```

The app will be available at:

| Service | URL |
|---------|-----|
| **Client Portal** | http://localhost:5173 |
| **Admin Dashboard** | http://localhost:5173/admin/login |
| **API** | http://localhost:8000 |
| **API Docs (Swagger)** | http://localhost:8000/docs |

---

## Default Admin Credentials

| Field | Value |
|-------|-------|
| URL | http://localhost:5173/admin/login |
| Password | `admin123` (set via `ADMIN_PASSWORD` in `.env`) |

---

## Trip Lifecycle

```
INTAKE → DRAFT → REVIEW → CONFIRMED → ARCHIVED
```

| Status | Meaning | Who acts |
|--------|---------|----------|
| **INTAKE** | Client submitted an enquiry, no itinerary yet | Admin |
| **DRAFT** | Admin has generated an AI itinerary — internal working copy | Admin |
| **REVIEW** | Itinerary sent to client for approval | Client |
| **CONFIRMED** | Client approved — trip is locked in | — |
| **ARCHIVED** | Trip complete or cancelled | Admin |

### Full Flow

1. Client submits enquiry via intake form → receives **welcome email** with reference code
2. Admin generates AI itinerary (status: `DRAFT`)
3. Admin reviews, refines, and regenerates with custom instructions as needed
4. Admin clicks **"Send for Review"** → client receives **itinerary review email** (status: `REVIEW`)
5. Client logs in and either:
   - Clicks **"Confirm this itinerary"** → both parties receive **confirmation emails** (status: `CONFIRMED`)
   - Clicks **"Request changes"** → types feedback inline, message saved, trip reverts to `DRAFT`, admin receives **change request email**
6. Admin archives the trip once complete (status: `ARCHIVED`)

**Unread message badges** appear on the Messages tab and admin dashboard cards whenever a new message arrives.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Docker Compose                          │
│                                                                 │
│  ┌───────────────┐   ┌─────────────────┐   ┌────────────────┐  │
│  │  web (React)  │──▶│   api (FastAPI)  │──▶│  db (Postgres) │  │
│  │  Vite + TS    │   │   SQLAlchemy    │   │   Port 5432    │  │
│  │  Port 5173    │   │   Alembic       │   └────────────────┘  │
│  └───────────────┘   │   Port 8000     │                        │
│                      └────────┬────────┘                        │
│                               │                                 │
│                        ┌──────┴──────┐                          │
│                        ▼             ▼                          │
│              ┌──────────────┐  ┌──────────────┐                │
│              │ OpenAI GPT-4o│  │  Gmail SMTP  │                │
│              │  Structured  │  │ Transactional│                │
│              │   Outputs    │  │    Email     │                │
│              └──────────────┘  └──────────────┘                │
│                        │                                        │
│                        ▼                                        │
│              ┌──────────────────┐                               │
│              │  Sentry          │                               │
│              │  Error Tracking  │                               │
│              └──────────────────┘                               │
└─────────────────────────────────────────────────────────────────┘
```

### Key Components

**Backend (`/api`)**
- `app/main.py` — FastAPI app, CORS, Alembic migrations at startup, Sentry init
- `app/models.py` — SQLAlchemy models: Client, Trip, IntakeResponse, Itinerary, Message, DestinationCard
- `app/routes/auth.py` — JWT auth (client + admin), resend reference code, rate limiting
- `app/routes/intake.py` — Public intake form, triggers welcome email, rate limited
- `app/routes/client.py` — Client portal: trips, messages, confirm itinerary, request changes, mark-read
- `app/routes/admin.py` — Admin: trip management, AI generation, send-for-review, mark-read
- `app/services/ai.py` — GPT-4o generation with retry logic (3 attempts, exponential backoff)
- `app/services/email.py` — Gmail SMTP with branded HTML templates for all notification types
- `app/services/retrieval.py` — Destination card retrieval for AI context injection
- `app/services/seed.py` — Seeds 35 destination cards on startup
- `alembic/` — Database migration history

**Frontend (`/web`)**
- React 18 + Vite + TypeScript
- React Router v6, Axios with JWT interceptors
- Lucide React icon library
- Calendar-style day picker itinerary view
- Sentry browser error tracking

**Seed Data (`/seed/destinations`)**
- 35 destination cards covering Asia-Pacific, Europe, Americas, Middle East, Africa
- Injected into AI prompt as context for relevant destinations

---

## Environment Variables

Copy `.env.example` to `.env` and configure:

```env
DATABASE_URL=postgresql://papaya:papaya_secret@db:5432/papaya
OPENAI_API_KEY=sk-your-key-here          # Required for AI generation
JWT_SECRET=change-me-in-production       # Use a long random string
ADMIN_PASSWORD=admin123                  # Change for production
ADMIN_EMAIL=admin@papaya.travel          # Receives admin notifications
CORS_ORIGINS=http://localhost:5173
SEED_ON_STARTUP=true

# Email (Gmail SMTP)
# Generate an App Password at: myaccount.google.com > Security > App passwords
EMAIL_ADDRESS=you@gmail.com
EMAIL_PASSWORD=xxxx xxxx xxxx xxxx
PORTAL_URL=http://localhost:5173

# Sentry error tracking (optional — leave blank to disable)
SENTRY_DSN=                              # Backend DSN from sentry.io
VITE_SENTRY_DSN=                         # Frontend DSN from sentry.io
ENVIRONMENT=production
```

### Email Notifications

| Trigger | Recipient |
|---------|-----------|
| Intake form submitted | Client — welcome email with reference code |
| Reference code resend | Client — reference code reminder |
| Admin sends for review | Client — itinerary ready to review |
| Client confirms | Client + Admin — confirmation notification |
| Client requests changes | Admin — change request with quoted message |

---

## Database Migrations

Migrations run automatically at startup via Alembic. To create a new migration after changing a model:

```bash
docker-compose exec api alembic revision --autogenerate -m "describe the change"
# Restart the API — it runs migrations automatically on startup
docker-compose restart api
```

---

## API Reference

Full interactive documentation at http://localhost:8000/docs

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/intake` | None | Submit trip enquiry |
| POST | `/auth/client-login` | None | Client login |
| POST | `/auth/admin-login` | None | Admin login |
| POST | `/auth/resend-reference` | None | Resend reference code |
| GET | `/client/trips` | Client JWT | List client's trips |
| GET | `/client/trips/{id}` | Client JWT | Trip detail + itinerary |
| POST | `/client/trips/{id}/confirm` | Client JWT | Confirm itinerary |
| POST | `/client/trips/{id}/request-changes` | Client JWT | Request changes (reverts to DRAFT) |
| POST | `/client/trips/{id}/messages/read` | Client JWT | Mark admin messages as read |
| POST | `/client/trips/{id}/messages` | Client JWT | Send message |
| GET | `/admin/trips` | Admin JWT | All trips (filterable by status) |
| GET | `/admin/trips/{id}` | Admin JWT | Trip detail |
| PATCH | `/admin/trips/{id}` | Admin JWT | Update trip (DRAFT→REVIEW sends email) |
| POST | `/admin/trips/{id}/generate-itinerary` | Admin JWT | Generate AI itinerary |
| POST | `/admin/trips/{id}/regenerate-itinerary` | Admin JWT | Regenerate with instructions |
| POST | `/admin/trips/{id}/messages/read` | Admin JWT | Mark client messages as read |
| POST | `/admin/trips/{id}/messages` | Admin JWT | Send admin message |
| GET | `/health` | None | Health check |

---

## Running Tests

```bash
cd api
pytest tests/ -v
```

Tests use SQLite and run without Docker. CI runs on every push via GitHub Actions.

---

## Local Development (without Docker)

```bash
# API
cd api
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export DATABASE_URL=postgresql://papaya:papaya_secret@localhost:5432/papaya
export JWT_SECRET=dev-secret ADMIN_PASSWORD=admin123 OPENAI_API_KEY=sk-your-key
uvicorn app.main:app --reload --port 8000

# Frontend
cd web
npm install
VITE_API_URL=http://localhost:8000 npm run dev
```

---

## Production Checklist

- [ ] Change `JWT_SECRET`, `ADMIN_PASSWORD`, and database password
- [ ] Set `CORS_ORIGINS` to your production domain
- [ ] Set `PORTAL_URL` to your production domain (email links)
- [ ] Switch `EMAIL_ADDRESS` to your company Google Workspace address
- [ ] Add `SENTRY_DSN` and `VITE_SENTRY_DSN` for error tracking
- [ ] Use managed PostgreSQL (RDS, Cloud SQL, Supabase)
- [ ] Add HTTPS via nginx, Caddy, or a load balancer
- [ ] Enable automated database backups
- [ ] Monitor OpenAI token usage (GPT-4o ~$5/1M input tokens; long itineraries use up to 16k tokens)
