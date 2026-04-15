# Maya — Multi-Agent Architecture

## Overview

Maya is the AI engine behind Papaya Travel. It is not a single chatbot — it is a pipeline of four cooperating agents, each with a narrow, well-defined role. The agents pass structured data between them so that each stage can do its job with precision rather than trying to do everything at once.

```
Client fills booking form
        │
        ▼
┌───────────────────┐
│  1. Intake Maya   │  Conversational intake agent
│  (INTAKE agent)   │  Collects preferences warmly, naturally
└────────┬──────────┘
         │  Full conversation transcript
         ▼
┌───────────────────┐
│  2. Analyser      │  Synthesis agent
│  (ANALYSE agent)  │  Reads transcript → produces ClientProfile JSON
└────────┬──────────┘
         │  ClientProfile (structured JSON)
         ▼
┌───────────────────┐
│  3. Generator     │  Itinerary creation agent
│  (GEN agent)      │  Builds day-by-day plan using real venues + web search
└────────┬──────────┘
         │  Itinerary JSON
         ▼
┌───────────────────┐
│  4. Concierge     │  Post-generation refinement agent
│  Maya             │  Handles client questions, edits, regeneration requests
└───────────────────┘
```

---

## Agent 1 — Intake Maya

**File:** `api/app/services/ai.py` → `INTAKE_CHAT_SYSTEM`, `intake_chat_turn()`
**Route:** `POST /intake/chat`

### Purpose

Intake Maya runs the first conversation with a client. Its job is to feel like a real travel consultant — warm, curious, and never robotic — while systematically collecting everything the Analyser and Generator need to build a great itinerary.

### Design Principles

- **One or two questions per turn maximum.** Firing a form at someone kills the vibe. Maya asks what matters most given what it already knows and progressively fills in detail.
- **Prefer closed questions over open ones.** "Do you prefer a packed schedule or slow travel?" gets a usable answer. "Tell me about your travel style?" gets an essay.
- **Pre-seeded context.** The agent already knows destination, dates, origin city, and budget from the booking form. It never asks for those again.
- **Explicit completion signal.** When Maya has collected all required information, it appends `[INTAKE_COMPLETE]` to its final message. The server strips this before displaying it to the client and uses it to trigger the Analyser pipeline.

### Inputs

| Field | Source |
|---|---|
| `messages` | Full conversation so far (role/content list) |
| `seed_data` | Booking form: destination, origin_city, start_date, end_date, budget_range, travellers_count |

### Output

`(assistant_message: str, is_complete: bool)`

### Required Information Collected

1. Travel companions (solo / couple / family with child ages / friends group)
2. Trip purpose / vibe (honeymoon, adventure, relaxation, culture, family, bucket list)
3. Pace (packed vs slow travel)
4. Accommodation style (luxury, boutique, mid-range, budget, unique stays)
5. Food (dietary restrictions, adventurous vs familiar, street food vs fine dining)
6. Activity profile (outdoors, beaches, culture, nightlife, markets, cooking, wildlife)
7. Fitness and mobility (strenuous hikes, long walks)
8. Experience level (first time in region or well-travelled)
9. Non-negotiables (already booked items, absolute must-includes)
10. Must-avoids (tourist traps, foods, party areas)
11. Budget priority (spend on accommodation vs experiences)

### Why This Agent Exists Separately

Mixing intake with generation creates a confused agent trying to be warm and also technically precise at the same time. Separation means Intake Maya can be trained purely on conversation quality, and the Generator never has to wade through chat transcript structure.

---

## Agent 2 — Analyser

**File:** `api/app/services/ai.py` → `ANALYSER_SYSTEM`, `analyse_intake()`
**Route:** triggered server-side on `[INTAKE_COMPLETE]`

### Purpose

The Analyser is the bridge between conversation and itinerary. It reads the entire intake transcript and distils it into a structured `ClientProfile` JSON object. This profile is what the Generator actually works from — not the raw chat history.

The Analyser prevents the Generator from having to parse conversational language. It also makes client preferences reusable: the `ClientProfile` is stored and can inform future trips or updates without re-reading the transcript.

### Design Principles

- **Pure synthesis — no chat, no generation.** The Analyser reads and extracts. It outputs JSON. It has no other job.
- **Infer personality type, not just preferences.** Beyond facts ("likes hiking"), the Analyser identifies travel personality ("experience collector who prioritises authenticity over comfort") because this shapes how the Generator frames activities.
- **Flag uncertainty explicitly.** If the client was vague about something, the Analyser notes it in `gaps[]` so the Generator can make a reasonable assumption rather than silently defaulting.
- **One call, deterministic output.** No tools, no loops. Just a focused synthesis pass.

### Inputs

| Field | Source |
|---|---|
| `transcript` | Full intake conversation as formatted text |
| `seed_data` | Booking form data (destination, dates, budget, etc.) |

### Output — `ClientProfile` JSON Schema

```json
{
  "travel_companions": "string — who is travelling",
  "group_size": "integer",
  "trip_purpose": "string — primary intent (e.g. honeymoon, adventure, family holiday)",
  "pace": "relaxed | moderate | packed",
  "accommodation_style": "luxury | boutique | mid-range | budget | unique",
  "accommodation_priority": "high | medium | low — how much they want to spend here",
  "food_profile": {
    "dietary_restrictions": ["string"],
    "adventurousness": "adventurous | moderate | familiar",
    "dining_style": "street food | casual | mid-range | fine dining | mix"
  },
  "activity_profile": {
    "interests": ["string — from: outdoors, beaches, culture, nightlife, markets, cooking, wildlife, shopping, art, sport"],
    "fitness_level": "low | moderate | high",
    "avoid": ["string"]
  },
  "experience_level": "first-timer | some experience | well-travelled",
  "must_dos": ["string — specific things they insisted on"],
  "must_avoids": ["string — specific things they want excluded"],
  "non_negotiables": ["string — already booked items or hard constraints"],
  "budget_priority": "accommodation | experiences | balanced",
  "personality_type": "string — 1-2 sentence travel personality description for the Generator",
  "key_insights": ["string — 3-5 bullet insights the Generator should act on"],
  "gaps": ["string — anything unclear that the Generator should make a safe assumption about"]
}
```

### Why This Agent Exists Separately

Without the Analyser, the Generator reads raw conversation and must simultaneously understand natural language AND produce a precise JSON itinerary. That's two hard tasks in one call. The Analyser handles language understanding; the Generator handles domain expertise. Separation makes each agent better at its job and makes the system easier to debug — you can inspect the `ClientProfile` and verify it's correct before the itinerary is generated.

---

## Agent 3 — Itinerary Generator

**File:** `api/app/services/ai.py` → `ITINERARY_SYSTEM`, `generate_itinerary()`
**Route:** triggered server-side after Analyser completes (also manually via admin panel)

### Purpose

The Generator builds the actual itinerary: specific venues, day-by-day plans, hotel suggestions, transport legs, budget estimates, and photo queries. It is the most domain-knowledge-intensive agent in the pipeline.

### Design Principles

- **Real places only.** The system prompt explicitly forbids generic descriptions like "a local restaurant". Every venue must have a real, specific, verifiable name.
- **Web search enabled.** The Generator runs in an agentic loop with `web_search` enabled (up to 8 turns). It researches real operating hours, booking requirements, and seasonal factors before writing the plan.
- **Itinerary reads the `ClientProfile`, not the transcript.** The Generator receives the structured `ClientProfile` from the Analyser, not raw chat. This means the Generator prompt is clean and factual.
- **Photo queries generated at creation time.** Each activity block includes a `photo_query` field — 2-4 words optimised for Unsplash search. Morning/afternoon/evening queries within a day must be visually distinct subjects.
- **Hotel suggestions are abundant and exact.** 6-8 candidates per destination with exact official names, because downstream Google Places verification will reject ~50% of suggestions. More candidates = more confirmed results.

### Inputs

| Field | Source |
|---|---|
| `trip` | Trip model (dates, destination, origin, budget, pace) |
| `client_profile` | `ClientProfile` JSON from Analyser |
| `confirmed_flights` | Any already-booked flights from the database |
| `confirmed_stays` | Any already-booked accommodation from the database |
| `additional_instructions` | Optional admin override for regeneration |

### Output — Full `Itinerary` JSON

Key fields:
- `trip_title`, `overview`
- `destinations[]` with nights per location
- `day_plans[]` — morning/afternoon/evening blocks, each with title, details, booking_needed, est_cost_aud, **photo_query**
- `transport_legs[]` — full round-trip coverage with realistic modes
- `hotel_suggestions[]` — 6-8 per destination with exact names and booking URLs
- `transport_notes[]`, `budget_summary`, `packing_checklist`, `risks_and_notes`

### Agentic Loop

The Generator uses Claude's `web_search` tool in a multi-turn loop (up to 8 rounds). Claude decides when to search and what to search for. The loop exits when Claude returns a final `end_turn` response with the complete JSON block. This means the Generator can verify restaurant opening hours, check if an attraction requires advance booking, and look up current hotel pricing — all before writing the plan.

### Error Handling

Three retry attempts with delays of 70s / 90s / 120s (designed to clear Anthropic's 60-second rate-limit window). JSON parsing supports both fenced code blocks and raw JSON.

---

## Agent 4 — Concierge Maya

**File:** `api/app/services/ai.py` → `CHAT_SYSTEM`, `chat_with_itinerary()`
**Route:** `POST /client/chat`

### Purpose

Concierge Maya is the post-generation assistant. Once a client has their itinerary, they can ask questions, request changes, swap activities, or regenerate the whole thing. Concierge Maya handles all of this in natural conversation.

### Design Principles

- **Direct and concise.** This Maya is not in sales mode — the trip is sold. Replies are 2 sentences maximum, no emojis, no bullet points.
- **Knows the full itinerary.** The current itinerary JSON is injected into the system prompt so Maya can answer specific questions ("what's the restaurant on day 3?") without asking the client to re-explain.
- **Knows the client.** A persistent `client_memory` string (extracted and updated by the `extract_client_memory()` function) is injected alongside the itinerary. Maya knows what this client has said across multiple conversations.
- **Detects regeneration intent.** The system detects phrases like "redo this", "can you change the whole thing", "make it more adventurous" and triggers a full `generate_itinerary()` call rather than trying to patch the JSON conversationally.
- **Block-level editing.** For targeted changes ("swap the afternoon on day 4"), Maya can call `edit_block()` to surgically update a single itinerary block without regenerating the whole thing.

### Inputs

| Field | Source |
|---|---|
| `messages` | Conversation history |
| `itinerary_json` | Current itinerary as dict |
| `trip_context` | Trip metadata string (destination, dates, budget) |
| `client_memory` | Persistent preference summary from previous conversations |

### Output

`(assistant_message: str, updated_itinerary: dict | None, should_regenerate: bool)`

---

## Data Flow Summary

```
[Booking Form]
    destination, dates, origin, budget, traveller count
        │
        ▼
[Intake Maya]  ─── warm conversational intake ───▶  [INTAKE_COMPLETE signal]
        │
        │  Full transcript
        ▼
[Analyser]  ─── one synthesis call ───▶  ClientProfile JSON
        │
        │  ClientProfile + trip data
        ▼
[Generator]  ─── web search loop (≤8 turns) ───▶  Itinerary JSON saved to DB
        │
        │  Itinerary JSON + client memory
        ▼
[Concierge Maya]  ─── ongoing refinement ───▶  edits / regen triggers / answers
```

---

## Client Memory

**File:** `api/app/services/ai.py` → `extract_client_memory()`

Separate from the four main agents, a memory extraction call runs after each Concierge Maya session. It reads the conversation and updates a persistent plain-text summary of what is known about this client: travel style, budget sensitivity, past feedback, preferences stated.

This memory is injected into Concierge Maya's context in future sessions, giving the impression of continuity — Maya "remembers" what they talked about without storing every message.

**What gets stored:** facts clearly stated by the client. The prompt explicitly forbids inference — if the client didn't say it, it doesn't go in the memory.

---

## Design Decisions

### Why four agents instead of one?

A single "super-agent" that handles intake, analysis, generation, and refinement simultaneously would face several problems:

1. **Context confusion.** Warm conversational tone and precise JSON output require opposite modes. Trying to do both degrades quality in both directions.
2. **Debugging.** With separate agents, you can inspect the `ClientProfile` and know immediately whether a bad itinerary is the Analyser's fault (profile is wrong) or the Generator's fault (profile is right but itinerary is wrong).
3. **Iteration.** You can improve Intake Maya's conversational quality without touching the Generator, and vice versa.
4. **Cost control.** Short, focused agents use fewer tokens than a single massive prompt trying to do everything.

### Why structured JSON between agents?

Passing raw conversation transcripts from stage to stage forces every downstream agent to re-parse natural language. The `ClientProfile` schema locks in exactly what the Generator needs, in the exact shape it needs it, with no ambiguity. This also makes the system inspectable — a `ClientProfile` stored in the database is human-readable evidence of what the system "understood" about a client.

### Why web search in the Generator but not the others?

Intake and Concierge Maya operate in real-time with a human waiting for a response. Web search adds latency that would make the chat feel broken. The Generator runs in the background, triggered asynchronously, so latency is acceptable. The Analyser is a pure synthesis task — it doesn't need external information.

### Why `photo_query` at generation time?

Photo queries are generated by the same model that knows the activity context. At retrieval time, you only have a title like "Dinner at Nobu". The Generator knows it's a fine-dining sushi experience for a luxury couple — it can write `"Japanese fine dining interior"` rather than searching for `"Nobu"` (which returns press photos of the chef). Generation-time queries are dramatically more relevant.

---

## Extending the System

Future agents that could be added to the pipeline:

| Agent | Purpose |
|---|---|
| **Flight Scout** | Autonomous agent that researches real flight options with live pricing, rather than generating placeholder suggestions |
| **Hotel Validator** | Currently a background thread verifying hotel names against Google Places; could be promoted to a full agent that also scrapes pricing |
| **Personalised Intro** | A short generative pass that writes a custom "letter from Maya" to accompany the itinerary, referencing specific things the client mentioned |
| **Budget Optimiser** | Reviews the draft itinerary and suggests trade-offs to fit within budget constraints |
