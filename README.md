# Papaya Travel Portal

A production-ready travel planning portal for Australian travellers. Clients submit trip enquiries and admins generate AI-powered personalised itineraries using OpenAI GPT-4o. Clients review, request changes, and approve their itinerary through a structured workflow, communicating with the team via an in-portal messaging system.

**Live:** http://papaya-alb-1789522533.us-east-1.elb.amazonaws.com

## Features

- **AI itinerary generation** — GPT-4o produces structured day-by-day itineraries with costs, activities, transport notes and packing lists
- **Screenshot scanning** — upload a flight or hotel booking screenshot; GPT-4o vision extracts all details and auto-fills the form
- **Flight management** — add flights manually, look up live data via AeroDataBox, or scan booking screenshots; multi-leg support with automatic date ordering
- **Accommodation management** — add stays with check-in/out details; scan hotel confirmation screenshots to auto-fill
- **S3 document storage** — admins and clients upload trip documents (PDFs, images) stored in AWS S3; clients can delete their own uploads
- **Magic link login** — clients receive a one-click login link by email; falls back to email + reference code
- **PDF itinerary export** — clients download a branded PDF of their itinerary
- **Real-time messaging** — in-portal message thread between admin and client with email notifications and unread badges
- **Countdown timer** — trip cards show days until departure
- **Interactive flight map** — visual route map on the client portal
- **CloudWatch dashboard** — live monitoring of request counts, response times, errors, ECS CPU/memory and RDS metrics

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

1. Client submits enquiry via intake form → receives **welcome email** with a one-click magic login link + reference code as fallback
2. Admin generates AI itinerary (status: `DRAFT`)
3. Admin reviews, adds internal notes, refines, and regenerates with custom instructions as needed
4. Admin clicks **"Send for Review"** → client receives **itinerary review email** (status: `REVIEW`)
5. Client logs in and either:
   - Clicks **"Confirm this itinerary"** → both parties receive **confirmation emails** (status: `CONFIRMED`)
   - Clicks **"Request changes"** → types feedback inline, message saved, trip reverts to `DRAFT`, admin receives **change request email**
6. Admin and client can exchange messages at any time — both receive email notifications for new messages
7. Admin archives the trip once complete (status: `ARCHIVED`)

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
- `app/main.py` — FastAPI app, CORS, Alembic migrations at startup, Sentry init, JWT secret enforcement
- `app/models.py` — SQLAlchemy models: Client, Trip, IntakeResponse, Itinerary, Message, LoginToken, DestinationCard
- `app/routes/auth.py` — JWT auth (client + admin), magic link login, resend reference code, rate limiting
- `app/routes/intake.py` — Public intake form, generates magic login token, triggers welcome email, rate limited
- `app/routes/client.py` — Client portal: trips, messages, confirm itinerary, request changes, mark-read
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
- Lucide React icon library (zero emojis)
- Multi-step intake form with animated progress bar
- Calendar-style day-by-day itinerary timeline view
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
JWT_SECRET=change-me-in-production       # Required — use a long random string
                                         # Generate: python -c "import secrets; print(secrets.token_hex(32))"
ADMIN_PASSWORD=admin123                  # Change for production
ADMIN_EMAIL=admin@papaya.travel          # Receives admin notifications
CORS_ORIGINS=http://localhost:5173
SEED_ON_STARTUP=true

# Email (Gmail SMTP)
# Generate an App Password at: myaccount.google.com > Security > App passwords
EMAIL_ADDRESS=you@gmail.com
EMAIL_PASSWORD=xxxx xxxx xxxx xxxx
PORTAL_URL=http://localhost:5173        # Used in email links and magic login URLs

# Sentry error tracking (optional — leave blank to disable)
SENTRY_DSN=                              # Backend DSN from sentry.io
VITE_SENTRY_DSN=                         # Frontend DSN from sentry.io
ENVIRONMENT=production
```

### Email Notifications

| Trigger | Recipient | Contents |
|---------|-----------|----------|
| Intake form submitted | Client | Welcome email with magic login link + reference code |
| Reference code resend | Client | Fresh magic login link + reference code reminder |
| Admin sends for review | Client | Itinerary ready — link to portal |
| Client confirms | Client + Admin | Confirmation notification |
| Client requests changes | Admin | Change request with quoted message |
| Admin sends message | Client | Message notification with reply link |
| Client sends message | Admin | Message notification with portal link |

### Magic Link Login

When a client submits an intake form or requests a reference code resend, their email includes a one-click login button. The link:
- Is single-use and expires after **1 hour**
- Automatically logs the client in and redirects to their portal
- Falls back gracefully — if expired, the client is directed to log in with their email and reference code

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
| POST | `/auth/client-login` | None | Client login with email + reference code |
| POST | `/auth/admin-login` | None | Admin login |
| GET | `/auth/magic/{token}` | None | Magic link login (single-use, 1hr expiry) |
| POST | `/auth/resend-reference` | None | Resend reference code + fresh magic link |
| GET | `/client/trips` | Client JWT | List client's trips |
| GET | `/client/trips/{id}` | Client JWT | Trip detail + itinerary |
| POST | `/client/trips/{id}/confirm` | Client JWT | Confirm itinerary |
| POST | `/client/trips/{id}/request-changes` | Client JWT | Request changes (reverts to DRAFT) |
| GET | `/client/trips/{id}/messages` | Client JWT | Get messages |
| POST | `/client/trips/{id}/messages/read` | Client JWT | Mark admin messages as read |
| POST | `/client/trips/{id}/messages` | Client JWT | Send message |
| GET | `/admin/trips` | Admin JWT | All trips (filterable by status) |
| GET | `/admin/trips/{id}` | Admin JWT | Trip detail |
| PATCH | `/admin/trips/{id}` | Admin JWT | Update trip status, title, or admin notes |
| POST | `/admin/trips/{id}/generate-itinerary` | Admin JWT | Generate AI itinerary |
| POST | `/admin/trips/{id}/regenerate-itinerary` | Admin JWT | Regenerate with instructions |
| GET | `/admin/trips/{id}/messages` | Admin JWT | Get messages |
| POST | `/admin/trips/{id}/messages/read` | Admin JWT | Mark client messages as read |
| POST | `/admin/trips/{id}/messages` | Admin JWT | Send admin message |
| GET | `/admin/trips/{id}/documents` | Admin JWT | List trip documents from S3 |
| POST | `/admin/trips/{id}/documents` | Admin JWT | Upload document to S3 |
| GET | `/admin/trips/{id}/documents/download-url` | Admin JWT | Get presigned S3 download URL |
| DELETE | `/admin/trips/{id}/documents` | Admin JWT | Delete document from S3 |
| POST | `/admin/parse-screenshot` | Admin JWT | Parse flight/stay screenshot with GPT-4o vision |
| GET | `/admin/flights/lookup` | Admin JWT | Look up live flight data via AeroDataBox |
| GET | `/client/trips/{id}/documents` | Client JWT | List trip documents |
| POST | `/client/trips/{id}/documents` | Client JWT | Upload document (client prefix) |
| DELETE | `/client/trips/{id}/documents` | Client JWT | Delete own document only |
| GET | `/health` | None | Health check (includes DB ping) |

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

## AWS Deployment

The app is deployed on AWS using ECS Fargate, RDS, ECR, ALB, S3, and CloudWatch.

### Infrastructure

| Component | AWS Service | Purpose |
|-----------|-------------|---------|
| Container registry | ECR (Elastic Container Registry) | Stores Docker images for API and web |
| Container runtime | ECS Fargate (Elastic Container Service) | Runs containers without managing EC2 instances |
| Database | RDS PostgreSQL (Relational Database Service) | Managed Postgres — `papaya-db.c230y8k047wv.us-east-1.rds.amazonaws.com` |
| Load balancer | ALB (Application Load Balancer) | Stable public URL, routes traffic to ECS tasks |
| File storage | S3 | Private bucket for trip documents; presigned URLs for secure downloads |
| Logging & monitoring | CloudWatch | Container logs at `/ecs/papaya`; production dashboard with request counts, error rates, ECS and RDS metrics |

### Deploying a New Version

```bash
# Authenticate Docker with ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 095523580645.dkr.ecr.us-east-1.amazonaws.com

# Build and push (must use --platform linux/amd64 on Apple Silicon)
docker build --platform linux/amd64 -t papaya-api ./api
docker tag papaya-api:latest 095523580645.dkr.ecr.us-east-1.amazonaws.com/papaya-api:latest
docker push 095523580645.dkr.ecr.us-east-1.amazonaws.com/papaya-api:latest

docker build --platform linux/amd64 -t papaya-web ./web
docker tag papaya-web:latest 095523580645.dkr.ecr.us-east-1.amazonaws.com/papaya-web:latest
docker push 095523580645.dkr.ecr.us-east-1.amazonaws.com/papaya-web:latest

# Force ECS to pull the new images
aws ecs update-service --cluster papaya-cluster --service papaya-service --force-new-deployment --region us-east-1
```

### TODO

- [ ] Register a custom domain and point it at the ALB via Route 53
- [ ] Add HTTPS via AWS Certificate Manager (ACM) — request a free SSL certificate, attach to ALB listener on port 443
- [ ] Update `CORS_ORIGINS` and `PORTAL_URL` environment variables to the custom domain
- [ ] Move secrets from task definition environment variables to AWS Secrets Manager
- [ ] Enable RDS automated backups (currently set to 1 day retention — increase for production)
- [ ] Switch to multi-AZ RDS for high availability

---

## Production Checklist

- [ ] Set `JWT_SECRET` to a strong random value (`python -c "import secrets; print(secrets.token_hex(32))"`)
- [ ] Change `ADMIN_PASSWORD` and database password
- [ ] Set `CORS_ORIGINS` to your production domain
- [ ] Set `PORTAL_URL` to your production domain (used in email links and magic login URLs)
- [ ] Switch `EMAIL_ADDRESS` to your company Google Workspace address
- [ ] Add `SENTRY_DSN` and `VITE_SENTRY_DSN` for error tracking
- [ ] Use managed PostgreSQL (RDS, Cloud SQL, Supabase)
- [ ] Add HTTPS via nginx, Caddy, or a load balancer
- [ ] Enable automated database backups
- [ ] Monitor OpenAI token usage (GPT-4o ~$5/1M input tokens; long itineraries use up to 16k tokens)
