# Papaya Travel Portal

A production-leaning MVP travel planning portal for Australian travellers. Clients submit trip enquiries, and admins generate AI-powered personalised itineraries using OpenAI GPT-4o with structured outputs. Clients review and approve their itinerary through a guided workflow, communicating with the team via an in-portal messaging system.

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

## Trip Lifecycle

The portal uses a structured workflow to take a trip from enquiry through to confirmation:

```
INTAKE → DRAFT → REVIEW → CONFIRMED → ARCHIVED
```

| Status | Meaning | Who acts |
|--------|---------|----------|
| **INTAKE** | Client has submitted an enquiry, no itinerary yet | Admin |
| **DRAFT** | Admin has generated an AI itinerary — internal working copy | Admin |
| **REVIEW** | Admin has sent the itinerary to the client for approval | Client |
| **CONFIRMED** | Client has approved — trip is locked in | Both |
| **ARCHIVED** | Trip is complete or cancelled | Admin |

### Flow

1. Client submits a trip enquiry via the intake form → receives a **welcome email** with their reference code
2. Admin logs in, views the trip dashboard, and generates an AI itinerary (status: `DRAFT`)
3. Admin reviews and refines the itinerary (can regenerate with custom instructions)
4. Admin clicks **"Send for Review"** → client receives an **itinerary review email** (status: `REVIEW`)
5. Client logs in, reviews the day-by-day itinerary, and either:
   - Clicks **"Confirm this itinerary"** → both client and admin receive **confirmation emails** (status: `CONFIRMED`)
   - Clicks **"Request changes"** → opens the messaging tab to communicate with the team
6. Admin archives the trip once complete (status: `ARCHIVED`)

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
│                 ┌─────────────────────────┐                     │
│                 │   OpenAI API (GPT-4o)   │                     │
│                 │   Structured Outputs    │                     │
│                 └─────────────────────────┘                     │
│                               │                                 │
│                               ▼                                 │
│                 ┌─────────────────────────┐                     │
│                 │   Gmail SMTP            │                     │
│                 │   Transactional Email   │                     │
│                 └─────────────────────────┘                     │
└─────────────────────────────────────────────────────────────────┘
```

### Key Components

**Backend (`/api`)**
- `app/main.py` — FastAPI app with CORS, startup hooks
- `app/models.py` — SQLAlchemy models (Client, Trip, IntakeResponse, Itinerary, Message, DestinationCard)
- `app/routes/auth.py` — JWT authentication for clients and admin; resend reference code endpoint
- `app/routes/intake.py` — Public intake form endpoint; triggers welcome email
- `app/routes/client.py` — Client portal API (trips, messages, trip confirmation)
- `app/routes/admin.py` — Admin API (trip management, AI generation, send-for-review workflow)
- `app/services/ai.py` — OpenAI GPT-4o itinerary generation with strict JSON schema
- `app/services/email.py` — Gmail SMTP email service with branded HTML templates
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
OPENAI_API_KEY=sk-your-key-here          # Required for AI itinerary generation
JWT_SECRET=change-me-in-production       # Change for production!
ADMIN_PASSWORD=admin123                  # Change for production!
ADMIN_EMAIL=admin@papaya.travel          # Receives confirmation notifications
CORS_ORIGINS=http://localhost:5173
SEED_ON_STARTUP=true                     # Seeds destination cards on startup

# Email (Gmail SMTP)
# Generate an App Password at: myaccount.google.com > Security > App passwords
# Note: requires 2-Step Verification to be enabled on the Gmail account
EMAIL_ADDRESS=you@gmail.com
EMAIL_PASSWORD=xxxx xxxx xxxx xxxx
PORTAL_URL=http://localhost:5173
```

### Email Configuration Notes

The portal uses Gmail SMTP for transactional emails. The same configuration works for:
- Personal Gmail (`you@gmail.com`)
- Google Workspace / company Gmail (`hello@yourcompany.com`)

To switch to a company email, update `EMAIL_ADDRESS` and `EMAIL_PASSWORD` in `.env` — no code changes required.

Emails sent by the system:
| Trigger | Recipient | Content |
|---------|-----------|---------|
| Intake form submitted | Client | Welcome email with reference code and portal login link |
| Reference code resend requested | Client | Reference code reminder |
| Admin sends itinerary for review | Client | Itinerary review notification with portal link |
| Client confirms itinerary | Client | Trip confirmation email |
| Client confirms itinerary | Admin | Notification that client has confirmed |

---

## Local Development (without Docker)

### API

```bash
cd api
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt

export DATABASE_URL=postgresql://papaya:papaya_secret@localhost:5432/papaya
export JWT_SECRET=dev-secret
export ADMIN_PASSWORD=admin123
export OPENAI_API_KEY=sk-your-key
export EMAIL_ADDRESS=you@gmail.com
export EMAIL_PASSWORD="xxxx xxxx xxxx xxxx"
export PORTAL_URL=http://localhost:5173

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

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/intake` | None | Submit trip enquiry + send welcome email |
| POST | `/auth/client-login` | None | Client login (email + reference code) |
| POST | `/auth/admin-login` | None | Admin login |
| POST | `/auth/resend-reference` | None | Resend reference code to email |
| GET | `/client/trips` | Client JWT | List client's trips |
| GET | `/client/trips/{id}` | Client JWT | Trip detail + itinerary |
| POST | `/client/trips/{id}/confirm` | Client JWT | Confirm itinerary (REVIEW → CONFIRMED) |
| POST | `/client/trips/{id}/messages` | Client JWT | Send message |
| GET | `/client/trips/{id}/messages` | Client JWT | Get all messages |
| GET | `/admin/trips` | Admin JWT | All trips (filterable by status) |
| GET | `/admin/trips/{id}` | Admin JWT | Trip detail |
| PATCH | `/admin/trips/{id}` | Admin JWT | Update trip status/title (DRAFT → REVIEW sends email) |
| POST | `/admin/trips/{id}/generate-itinerary` | Admin JWT | Generate AI itinerary |
| POST | `/admin/trips/{id}/regenerate-itinerary` | Admin JWT | Regenerate with custom instructions |
| GET | `/admin/trips/{id}/messages` | Admin JWT | Get all messages |
| POST | `/admin/trips/{id}/messages` | Admin JWT | Send admin message |
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
4. **Update `PORTAL_URL`**: Set to your production domain so email links work correctly
5. **Database**: Use managed PostgreSQL (RDS, Cloud SQL, Supabase)
6. **OpenAI costs**: Monitor token usage — GPT-4o is ~$5/1M input tokens; long itineraries use up to 16k tokens
7. **Email**: Switch `EMAIL_ADDRESS` to your company Google Workspace address
8. **Backups**: Enable automated database backups
9. **Logging**: Add structured logging and error tracking (Sentry)
10. **Rate limiting**: Add rate limiting to auth and intake endpoints to prevent abuse
11. **Admin password hashing**: Replace plain-text admin password comparison with bcrypt
