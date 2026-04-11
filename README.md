# Travel Papaya

A production travel planning portal for Australian travellers. Clients submit trip enquiries and admins generate AI-powered personalised itineraries using GPT-4o and Claude. Clients review and refine their itinerary through a structured workflow, with an AI assistant (Maya) available to help make changes.

**Live:** https://www.travel-papaya.com

---

## Features

- **AI itinerary generation** — GPT-4o produces structured day-by-day itineraries with costs, activities, transport notes and packing lists
- **Ask Maya** — clients chat with an AI assistant directly in their portal to request itinerary changes
- **Screenshot scanning** — upload a flight or hotel booking screenshot; GPT-4o vision extracts all details and auto-fills the form
- **Flight management** — add flights manually, look up live data via AeroDataBox, or scan booking screenshots; multi-leg support with automatic date ordering
- **Accommodation management** — add stays with check-in/out details; scan hotel confirmation screenshots to auto-fill
- **S3 document storage** — admins and clients upload trip documents (PDFs, images) stored in AWS S3; clients can delete their own uploads
- **Magic link login** — clients receive a one-click login link by email; single-use with 1-hour expiry
- **PDF itinerary export** — clients download a branded PDF of their itinerary
- **Real-time messaging** — in-portal message thread between admin and client with email notifications and unread badges
- **Trip management** — clients can edit their trip title and delete trips from their portal
- **Countdown timer** — trip cards show days until departure
- **Interactive flight map** — visual route map on the client portal
- **CloudWatch dashboard** — live monitoring of request counts, response times, errors, ECS CPU/memory and RDS metrics

---

## Quick Start (Local)

```bash
cp .env.example .env
# Edit .env and add your credentials (see Environment Variables below)
docker-compose up --build
```

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

1. Client submits enquiry via intake form → receives **welcome email** with a one-click magic login link
2. Admin generates AI itinerary (status: `DRAFT`)
3. Admin reviews, adds internal notes, refines, and regenerates with custom instructions as needed
4. Admin clicks **"Send for Review"** → client receives **itinerary review email** (status: `REVIEW`)
5. Client logs in and can:
   - Click **"Confirm this itinerary"** → both parties receive **confirmation emails** (status: `CONFIRMED`)
   - Use **"Refine with Maya"** → opens the Ask Maya chat tab to request AI-driven changes
   - Use **"Message your planner"** → opens the Messages tab to contact the human travel planner
6. Admin and client can exchange messages at any time — both receive email notifications for new messages
7. Admin archives the trip once complete (status: `ARCHIVED`)

**Unread message badges** appear on the Messages tab and admin dashboard cards whenever a new message arrives.

---

## Architecture Overview

```
                    ┌─────────────────────────────────────────────┐
                    │         AWS (us-east-1)                     │
                    │                                             │
  Users ──HTTPS──▶  │  ALB (port 443, ACM certificate)           │
                    │   │                                         │
                    │   ├──▶ /api/* ──▶ ECS Fargate (papaya-api)  │
                    │   │               FastAPI + SQLAlchemy       │
                    │   │               Port 8000                  │
                    │   │                    │                     │
                    │   │               RDS PostgreSQL             │
                    │   │               (papaya-db)                │
                    │   │                                         │
                    │   └──▶ /* ──▶ ECS Fargate (papaya-web)      │
                    │               React + Vite (nginx)           │
                    │               Port 80                        │
                    │                                             │
                    │  ECR — Docker image registry                │
                    │  S3  — Trip document storage                │
                    │  CloudWatch — Logs + monitoring             │
                    └─────────────────────────────────────────────┘
                              │               │
                        OpenAI GPT-4o    Claude (Anthropic)
                        Itinerary gen    Ask Maya AI chat
                              │
                         Gmail SMTP
                         Transactional email
```

### Key Components

**Backend (`/api`)**
- `app/main.py` — FastAPI app, CORS, Alembic migrations at startup, Sentry init, JWT secret enforcement
- `app/models.py` — SQLAlchemy models: Client, Trip, IntakeResponse, Itinerary, Message, LoginToken, DestinationCard
- `app/routes/auth.py` — JWT auth (client + admin), magic link login, rate limiting
- `app/routes/intake.py` — Public intake form, generates magic login token, triggers welcome email, rate limited
- `app/routes/client.py` — Client portal: trips, messages, confirm itinerary, title editing, trip deletion, mark-read
- `app/routes/admin.py` — Admin: trip management, admin notes, AI generation, send-for-review, mark-read
- `app/services/ai.py` — GPT-4o generation with retry logic (3 attempts, exponential backoff)
- `app/services/email.py` — Gmail SMTP with branded HTML templates for all notification types
- `app/services/retrieval.py` — Destination card retrieval for AI context injection
- `app/services/s3.py` — S3 upload, list, delete and presigned download URL helpers
- `app/services/seed.py` — Seeds 35 destination cards and a polished demo trip on startup
- `alembic/` — Database migration history

**Frontend (`/web`)**
- React 18 + Vite + TypeScript
- React Router v6, Axios with JWT interceptors
- Lucide React icon library
- Public landing page at `/` with hero, how-it-works, and features sections
- Multi-step intake form with animated progress bar
- Calendar-style day-by-day itinerary timeline view
- Ask Maya tab — AI chat interface with typewriter greeting and suggested prompts
- Trip title inline editing and trip deletion from client portal
- PDF itinerary export via `@react-pdf/renderer`
- Magic link handler at `/magic/:token`
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
ANTHROPIC_API_KEY=sk-ant-your-key-here   # Required for Ask Maya chat
JWT_SECRET=change-me-in-production       # Required — use a long random string
                                         # Generate: python -c "import secrets; print(secrets.token_hex(32))"
ADMIN_PASSWORD=admin123                  # Change for production
ADMIN_EMAIL=admin@yourdomain.com         # Receives admin notifications
CORS_ORIGINS=http://localhost:5173
SEED_ON_STARTUP=true

# Email (Gmail SMTP)
# Generate an App Password at: myaccount.google.com > Security > App passwords
EMAIL_ADDRESS=you@gmail.com
EMAIL_PASSWORD=xxxx xxxx xxxx xxxx
PORTAL_URL=http://localhost:5173        # Used in email links and magic login URLs

# AWS S3 (optional for local dev)
S3_BUCKET=your-bucket-name

# Sentry error tracking (optional — leave blank to disable)
SENTRY_DSN=                              # Backend DSN from sentry.io
VITE_SENTRY_DSN=                         # Frontend DSN from sentry.io
ENVIRONMENT=production
```

### Email Notifications

| Trigger | Recipient | Contents |
|---------|-----------|----------|
| Intake form submitted | Client | Welcome email with magic login link |
| Admin sends for review | Client | Itinerary ready — link to portal |
| Client confirms | Client + Admin | Confirmation notification |
| Client requests changes | Admin | Change request with quoted message |
| Admin sends message | Client | Message notification with reply link |
| Client sends message | Admin | Message notification with portal link |

### Magic Link Login

When a client submits an intake form, their welcome email includes a one-click login button. The link:
- Is single-use and expires after **1 hour**
- Automatically logs the client in and redirects to their portal

---

## Database Migrations

Migrations run automatically at startup via Alembic. To create a new migration after changing a model:

```bash
docker-compose exec api alembic revision --autogenerate -m "describe the change"
docker-compose restart api
```

---

## API Reference

Full interactive documentation at http://localhost:8000/docs

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/intake` | None | Submit trip enquiry |
| POST | `/auth/admin-login` | None | Admin login |
| GET | `/auth/magic/{token}` | None | Magic link login (single-use, 1hr expiry) |
| GET | `/client/trips` | Client JWT | List client's trips |
| GET | `/client/trips/{id}` | Client JWT | Trip detail + itinerary |
| POST | `/client/trips/{id}/confirm` | Client JWT | Confirm itinerary |
| PATCH | `/client/trips/{id}/title` | Client JWT | Update trip title |
| DELETE | `/client/trips/{id}` | Client JWT | Delete trip |
| GET | `/client/trips/{id}/messages` | Client JWT | Get messages |
| POST | `/client/trips/{id}/messages` | Client JWT | Send message |
| POST | `/client/trips/{id}/messages/read` | Client JWT | Mark admin messages as read |
| GET | `/client/trips/{id}/documents` | Client JWT | List trip documents |
| POST | `/client/trips/{id}/documents` | Client JWT | Upload document (client prefix) |
| DELETE | `/client/trips/{id}/documents` | Client JWT | Delete own document only |
| GET | `/admin/trips` | Admin JWT | All trips (filterable by status) |
| GET | `/admin/trips/{id}` | Admin JWT | Trip detail |
| PATCH | `/admin/trips/{id}` | Admin JWT | Update trip status, title, or admin notes |
| POST | `/admin/trips/{id}/generate-itinerary` | Admin JWT | Generate AI itinerary |
| POST | `/admin/trips/{id}/regenerate-itinerary` | Admin JWT | Regenerate with instructions |
| GET | `/admin/trips/{id}/messages` | Admin JWT | Get messages |
| POST | `/admin/trips/{id}/messages` | Admin JWT | Send admin message |
| POST | `/admin/trips/{id}/messages/read` | Admin JWT | Mark client messages as read |
| GET | `/admin/trips/{id}/documents` | Admin JWT | List trip documents from S3 |
| POST | `/admin/trips/{id}/documents` | Admin JWT | Upload document to S3 |
| GET | `/admin/trips/{id}/documents/download-url` | Admin JWT | Get presigned S3 download URL |
| DELETE | `/admin/trips/{id}/documents` | Admin JWT | Delete document from S3 |
| POST | `/admin/parse-screenshot` | Admin JWT | Parse flight/stay screenshot with GPT-4o vision |
| GET | `/admin/flights/lookup` | Admin JWT | Look up live flight data via AeroDataBox |
| GET | `/health` | None | Health check (includes DB ping) |

---

## Deployment

Deployments are fully automated via GitHub Actions. Every push to `main` triggers the CD pipeline:

1. Builds `linux/amd64` Docker images for API and web
2. Pushes images to ECR
3. Forces a new ECS deployment
4. Waits for the service to stabilise

See `.github/workflows/deploy.yml` for the full pipeline config.

### AWS Infrastructure

| Component | AWS Service | Details |
|-----------|-------------|---------|
| Container registry | ECR | Stores API and web Docker images |
| Container runtime | ECS Fargate | Serverless containers — no EC2 to manage |
| Database | RDS PostgreSQL | Managed Postgres in private VPC |
| Load balancer | ALB | HTTPS on port 443, HTTP→HTTPS redirect |
| SSL certificate | ACM | Covers `travel-papaya.com` and `www.travel-papaya.com` |
| File storage | S3 | Private bucket; presigned URLs for secure downloads |
| DNS | GoDaddy | `www` CNAME → ALB; root domain forwarded to `www` |
| Logging & monitoring | CloudWatch | Container logs at `/ecs/papaya`; production dashboard |

### Secrets

All production secrets (API keys, DB password, JWT secret, email credentials) are set as environment variables in the ECS task definition. The `task-definition.json` file is gitignored — never commit secrets to the repository.

A pre-commit hook blocks commits containing known secret patterns (API keys, database URLs, private keys).

---

## Running Tests

```bash
cd api
pytest tests/ -v
```

Tests use SQLite and run without Docker.

---

## Local Development (without Docker)

```bash
# API
cd api
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export DATABASE_URL=postgresql://papaya:papaya_secret@localhost:5432/papaya
export JWT_SECRET=dev-secret ADMIN_PASSWORD=admin123 OPENAI_API_KEY=sk-your-key ANTHROPIC_API_KEY=sk-ant-your-key
uvicorn app.main:app --reload --port 8000

# Frontend
cd web
npm install
VITE_API_URL=http://localhost:8000 npm run dev
```

---

## Production Checklist

- [x] Custom domain (`travel-papaya.com`) via GoDaddy
- [x] HTTPS via ACM — SSL certificate attached to ALB
- [x] CD pipeline — automated deployments on push to `main`
- [x] Pre-commit hook blocking accidental secret commits
- [ ] Move secrets from task definition to AWS Secrets Manager
- [ ] Enable RDS automated backups with longer retention
- [ ] Switch to multi-AZ RDS for high availability
- [ ] Set `SENTRY_DSN` and `VITE_SENTRY_DSN` for error tracking
