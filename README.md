# Travel Papaya

An AI-powered travel planning portal for Australian travellers. Clients describe their dream trip through a conversational intake, receive a personalised day-by-day itinerary built by AI, and can refine it further through the portal — all without manual involvement from a planner.

**Live:** https://www.travel-papaya.com

---

## How it works

### Client flow

1. **Intake** — Client visits the landing page and starts a short AI-guided conversation about their trip (destination, dates, budget, style, interests). Maya (the AI) gathers all the details naturally before submitting.
2. **Generation** — The moment the form is submitted, AI generates a personalised day-by-day itinerary in the background. The client receives a magic login link by email and is shown a "building your itinerary" screen in their portal.
3. **Review** — When generation completes the client receives an "itinerary ready" email and the portal updates automatically. They can read through the full day-by-day plan, view the budget breakdown, packing list, transport notes, and more.
4. **Refine** — The client can use **Ask Maya** to adjust anything — swap activities, change the pace, add day trips, shift dates. Maya edits the itinerary live. Clients can also message the human planner directly if they want personal advice.

### Admin (planner) role

The admin dashboard provides a view across all trips and allows the planner to:
- Read and respond to client messages
- Provide personalised guidance when a client reaches out
- View trip status and itinerary details
- Archive completed or cancelled trips

The AI handles all itinerary generation and refinement. Admin involvement is optional and purely advisory.

---

## Trip lifecycle

```
GENERATING → REVIEW → ARCHIVED
```

| Status | Meaning |
|--------|---------|
| **GENERATING** | Intake submitted — AI is building the itinerary |
| **REVIEW** | Itinerary ready — client is reviewing and refining |
| **ARCHIVED** | Trip complete or cancelled |

---

## Features

- **Conversational intake** — Maya guides clients through trip planning via natural chat before submitting
- **AI itinerary generation** — Claude Sonnet 4.6 produces structured day-by-day itineraries with activities, costs, transport notes, packing lists, and risk notes
- **Ask Maya** — Clients refine their itinerary post-generation via AI chat directly in the portal
- **Activity map** — Per-day map view: click a day to zoom in and see geocoded activity markers (AM/PM/EVE colour-coded). Click an activity pin to zoom in further and see travel time from that night's accommodation
- **Walk/drive routes** — Activity pins show a route line from the stay to the activity; toggle between walking and driving time with a single click
- **Accommodation tab** — AI-suggested hotels per destination, seeded from the itinerary and enriched via Google Places (real photos, ratings, addresses). Clients save, dismiss, or request more options. Added stays appear on the map and in the day timeline
- **Top hotel highlight** — The top-ranked hotel suggestion for each destination is surfaced inline in the itinerary view with a one-click add-to-trip flow
- **Photo caching** — Hotel photo URLs are cached against each suggestion record in the database; Google Places is only called once per hotel, never on every page load
- **Photo quality gate** — Activity photos are verified by Claude Haiku vision before display; only photos that actually depict the activity are shown
- **Flight lookup** — Clients enter a flight number and date to see route details, times, terminals, and a live route map
- **Flight route map** — Visual route map showing all booked flights
- **PDF export** — Clients download a branded PDF of their full itinerary
- **Document uploads** — Clients and admins upload trip documents (PDFs, images) stored in S3
- **Magic link login** — Single-use login links sent by email; no passwords for clients
- **Messaging** — In-portal message thread between client and planner with email notifications and unread badges
- **Trip management** — Clients can edit their trip title or delete a trip from the portal
- **Countdown timer** — Trip cards show days until departure
- **CloudWatch monitoring** — Container logs from both services stream to CloudWatch (`/ecs/papaya`); CPU, memory, and task health metrics captured automatically

---

## Quick start (local)

```bash
cp .env.example .env
# Edit .env — add your API keys (see Environment Variables below)
docker-compose up --build
```

| Service | URL |
|---------|-----|
| **Client portal** | http://localhost:5173 |
| **Admin dashboard** | http://localhost:5173/admin/login |
| **API** | http://localhost:8000 |
| **API docs** | http://localhost:8000/docs |

---

## Default admin credentials

| Field | Value |
|-------|-------|
| Password | `admin123` (set via `ADMIN_PASSWORD` in `.env`) |

---

## Maya — AI Agent Architecture

Maya is not a single chatbot. It is a pipeline of four cooperating agents, each with a narrow, well-defined role. Agents pass structured data between them so each stage can operate with precision.

```
Client fills booking form
        │
        ▼
┌─────────────────────┐
│  1. Intake Maya     │  Collects preferences through warm, natural conversation
└──────────┬──────────┘
           │  Full conversation transcript
           ▼
┌─────────────────────┐
│  2. Analyser        │  Synthesises transcript → structured ClientProfile JSON
└──────────┬──────────┘
           │  ClientProfile
           ▼
┌─────────────────────┐
│  3. Generator       │  Builds day-by-day plan using real venues + web search
└──────────┬──────────┘
           │  Itinerary JSON
           ▼
┌─────────────────────┐
│  4. Concierge Maya  │  Handles post-generation questions, edits, refinement
└─────────────────────┘
```

**Agent 1 — Intake Maya:** Runs a real-time conversation with the client. Collects 11 categories of preference data one or two questions at a time. Signals completion with `[INTAKE_COMPLETE]`, which triggers the backend pipeline. Designed to feel like a travel consultant, not a form.

**Agent 2 — Analyser:** A pure synthesis agent. Reads the full intake transcript and produces a structured `ClientProfile` JSON — travel companions, pace, food profile, activity interests, personality type, key generator insights, and explicitly flagged gaps. The Generator receives clean structured facts, not raw chat.

**Agent 3 — Generator:** The most knowledge-intensive agent. Runs in an agentic loop with web search enabled (up to 8 Claude turns) to verify real venues, opening hours, and booking requirements. Generates photo queries per activity at creation time for higher-quality Unsplash results.

**Agent 4 — Concierge Maya:** Post-generation assistant. Has access to the full itinerary JSON and a persistent `client_memory` string updated after each session. Detects regeneration intent and triggers a full rebuild; handles surgical block edits for targeted changes.

Full technical detail — agent inputs/outputs, design decisions, data schemas: [`docs/agent-architecture.md`](docs/agent-architecture.md)

---

## Infrastructure Architecture

See the live interactive diagram at [travel-papaya.com/architecture](https://www.travel-papaya.com/architecture) — click any node for a full breakdown of what it does and why it's there.

### Backend (`/api`)

- `app/main.py` — FastAPI app, CORS, Alembic migrations on startup, Sentry init
- `app/models.py` — SQLAlchemy models: Client, Trip, IntakeResponse, Itinerary, Message, Flight, Stay, HotelSuggestionRecord
- `app/routes/auth.py` — Magic link login, admin login, JWT issuance
- `app/routes/intake.py` — Intake chat endpoint + intake submission; fires AI generation as a background task
- `app/routes/client.py` — Client portal: trip detail, itinerary, messages, Ask Maya, flight lookup, accommodation CRUD, activity photos (with vision quality gate), document uploads
- `app/routes/hotel_suggestions.py` — Hotel suggestion CRUD: auto-seed from itinerary JSON, status updates (save/dismiss), AI-driven "fetch more" with deduplication
- `app/routes/admin.py` — Admin: trip list, messages, flight/stay management, screenshot parsing (Claude Haiku vision), document uploads, photo cache refresh
- `app/services/ai.py` — Multi-agent Maya pipeline: intake, analyser (tool_use), itinerary generator, concierge chat (intent classifier)
- `app/services/places.py` — Google Places: hotel verification (coords + photo), activity geocoding (background thread), place lookup proxy
- `app/services/email.py` — Gmail SMTP with branded HTML templates
- `app/services/s3.py` — S3 upload, list, delete and presigned URL helpers

### Frontend (`/web`)

- React 18 + Vite + TypeScript, React Router v6
- `pages/LandingPage.tsx` — Public marketing page
- `pages/IntakePage.tsx` — Multi-step intake with Maya AI chat
- `pages/TripDetailPage.tsx` — Client portal: itinerary, Ask Maya, flights, accommodation, messages, documents
- `pages/AdminDashboardPage.tsx` — Admin trip list with unread badges
- `pages/AdminTripPage.tsx` — Admin trip detail, messaging, flight/stay management
- `pages/ArchitecturePage.tsx` — Interactive Reactflow architecture diagram
- `components/UnifiedTripMap.tsx` — Mapbox map: destination labels, transport routes, per-day activity markers, stay markers, walk/drive route lines with time toggle
- `components/ItineraryTimeline.tsx` — Day-by-day timeline with activity photos (quality-gated), costs, booking flags, and per-night accommodation footer
- Lucide React icons, `@react-pdf/renderer` for PDF export

---

## Environment variables

```env
DATABASE_URL=postgresql://papaya:papaya_secret@db:5432/papaya
JWT_SECRET=change-me-in-production
ADMIN_PASSWORD=admin123
ADMIN_EMAIL=you@yourdomain.com
CORS_ORIGINS=http://localhost:5173
SEED_ON_STARTUP=true

# AI
ANTHROPIC_API_KEY=sk-ant-your-key-here

# Email (Gmail App Password)
EMAIL_ADDRESS=you@gmail.com
EMAIL_PASSWORD=xxxx xxxx xxxx xxxx
PORTAL_URL=http://localhost:5173

# AWS S3 (document + screenshot storage)
S3_BUCKET=your-bucket-name

# Google Places API (hotel verification, photos, geocoding)
GOOGLE_PLACES_API_KEY=your-key-here

# Google Places (baked into frontend at build time for map search proxy)
VITE_GOOGLE_PLACES_API_KEY=your-key-here

# AeroDataBox (optional — enables flight number lookup)
AERODATABOX_API_KEY=your-key-here

# Sentry (optional)
SENTRY_DSN=

# Frontend (baked in at build time by Vite / GitHub Actions)
VITE_MAPBOX_TOKEN=your-mapbox-token-here
VITE_SENTRY_DSN=
```

### Email notifications

| Trigger | Recipient |
|---------|-----------|
| Intake submitted | Client — welcome + magic login link |
| Itinerary ready | Client — link to portal |
| New client message | Admin |
| New admin message | Client |

### Magic link login

Clients receive a single-use login link by email. Links expire after 1 hour. No passwords required.

---

## Database migrations

Alembic runs automatically on startup. To create a new migration after changing a model:

```bash
docker-compose exec api alembic revision --autogenerate -m "describe the change"
docker-compose restart api
```

---

## API reference

Full interactive docs at http://localhost:8000/docs

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/intake/chat` | None | Intake chat turn with Maya |
| POST | `/intake` | None | Submit trip — triggers AI generation |
| POST | `/auth/admin-login` | None | Admin login |
| GET | `/auth/magic/{token}` | None | Magic link login |
| GET | `/client/trips` | Client JWT | List client's trips |
| GET | `/client/trips/{id}` | Client JWT | Trip detail + itinerary |
| PATCH | `/client/trips/{id}/title` | Client JWT | Edit trip title |
| DELETE | `/client/trips/{id}` | Client JWT | Delete trip |
| POST | `/client/trips/{id}/chat` | Client JWT | Ask Maya (itinerary chat) |
| GET | `/client/trips/{id}/messages` | Client JWT | Get messages |
| POST | `/client/trips/{id}/messages` | Client JWT | Send message to planner |
| POST | `/client/trips/{id}/messages/read` | Client JWT | Mark messages read |
| GET | `/client/trips/{id}/documents` | Client JWT | List documents |
| POST | `/client/trips/{id}/documents` | Client JWT | Upload document |
| DELETE | `/client/trips/{id}/documents` | Client JWT | Delete own document |
| GET | `/client/flights/lookup` | Client JWT | Look up flight by number + date |
| GET | `/client/trips/{id}/stays` | Client JWT | List confirmed stays |
| POST | `/client/trips/{id}/stays` | Client JWT | Add stay (suggestion or manual) |
| DELETE | `/client/trips/{id}/stays/{sid}` | Client JWT | Remove stay |
| GET | `/client/activity-photo` | Client JWT | Verified activity photo (Haiku vision gate) |
| GET | `/client/place-lookup` | Client JWT | Google Places search proxy |
| GET | `/client/trips/{id}/hotel-suggestions` | Client JWT | List suggestions for a destination (auto-seeds from itinerary) |
| PATCH | `/client/trips/{id}/hotel-suggestions/{sid}` | Client JWT | Update suggestion status (suggestion / saved / dismissed) |
| POST | `/client/trips/{id}/hotel-suggestions/fetch` | Client JWT | AI-generate more suggestions, excluding known hotels |
| GET | `/client/trips/{id}/hotel-suggestions/saved` | Client JWT | List saved suggestions across all destinations |
| GET | `/admin/trips` | Admin JWT | All trips (filterable by status) |
| GET | `/admin/trips/{id}` | Admin JWT | Trip detail |
| PATCH | `/admin/trips/{id}` | Admin JWT | Update trip status or admin notes |
| GET | `/admin/trips/{id}/messages` | Admin JWT | Get messages |
| POST | `/admin/trips/{id}/messages` | Admin JWT | Send message to client |
| POST | `/admin/trips/{id}/messages/read` | Admin JWT | Mark messages read |
| GET | `/admin/trips/{id}/flights` | Admin JWT | List flights |
| POST | `/admin/trips/{id}/flights` | Admin JWT | Add flight |
| PATCH | `/admin/trips/{id}/flights/{fid}` | Admin JWT | Update flight |
| DELETE | `/admin/trips/{id}/flights/{fid}` | Admin JWT | Delete flight |
| GET | `/admin/trips/{id}/stays` | Admin JWT | List stays |
| POST | `/admin/trips/{id}/stays` | Admin JWT | Add stay |
| PATCH | `/admin/trips/{id}/stays/{sid}` | Admin JWT | Update stay |
| DELETE | `/admin/trips/{id}/stays/{sid}` | Admin JWT | Delete stay |
| GET | `/admin/trips/{id}/documents` | Admin JWT | List documents |
| POST | `/admin/trips/{id}/documents` | Admin JWT | Upload document |
| DELETE | `/admin/trips/{id}/documents` | Admin JWT | Delete document |
| GET | `/health` | None | Health check |

---

## Deployment

Every push to `main` triggers the CD pipeline automatically:

1. Builds `linux/amd64` Docker images for API and web
2. Pushes to ECR
3. Forces a new ECS deployment and waits for stability

See `.github/workflows/deploy.yml` for the pipeline config.

### AWS infrastructure

| Component | Service | Notes |
|-----------|---------|-------|
| Container runtime | ECS Fargate | Serverless — no EC2 to manage |
| Container registry | ECR | API and web images |
| Database | RDS PostgreSQL | Private VPC |
| Load balancer | ALB | HTTPS on 443, HTTP→HTTPS redirect |
| SSL | ACM | Covers `travel-papaya.com` + `www` |
| File storage | S3 | Private bucket, presigned URLs |
| DNS | GoDaddy | `www` CNAME → ALB |
| Logging | CloudWatch | `/ecs/papaya` log group |

Secrets (API keys, DB password, JWT secret) are set as environment variables in the ECS task definition. `task-definition.json` is gitignored. A pre-commit hook blocks accidental secret commits.

---

## Local development (without Docker)

```bash
# API
cd api
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export DATABASE_URL=postgresql://papaya:papaya_secret@localhost:5432/papaya
export JWT_SECRET=dev ADMIN_PASSWORD=admin123 ANTHROPIC_API_KEY=sk-ant-...
uvicorn app.main:app --reload --port 8000

# Web
cd web
npm install
VITE_API_URL=http://localhost:8000 npm run dev
```

---

## Running tests

```bash
cd api && pytest tests/ -v
```

---

## Production checklist

- [x] Custom domain (`travel-papaya.com`)
- [x] HTTPS via ACM
- [x] Automated CD pipeline on push to `main`
- [x] Pre-commit hook blocking secret commits
- [ ] Move secrets to AWS Secrets Manager
- [ ] Increase RDS backup retention
- [ ] Multi-AZ RDS for high availability
- [ ] Set `SENTRY_DSN` and `VITE_SENTRY_DSN` for error tracking

