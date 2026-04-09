import os
import json
import uuid
import time
import re
import logging
from datetime import datetime
from sqlalchemy.orm import Session
import anthropic

from app.models import Trip, Itinerary, IntakeResponse, Client

logger = logging.getLogger(__name__)

MAX_TURNS = 12       # max web-search rounds before we give up
MAX_RETRIES = 3
RETRY_DELAYS = [5, 15, 30]

# ─── System prompts ───────────────────────────────────────────────────────────

ITINERARY_SYSTEM = """You are an expert travel consultant for Papaya Travel, a boutique Australian travel agency.
You create detailed, highly personalised itineraries for Australian travellers.

CRITICAL RULES:
- Always use REAL, SPECIFIC place names — actual restaurants, hotels, attractions, temples, beaches.
  Never say "a local restaurant" or "a beachside café". Name the actual place.
- Search the web for current, accurate information before writing recommendations.
- Quote all costs in AUD (Australian Dollars).
- Consider real opening hours, booking requirements, and seasonal factors.
- For each activity, include WHY it suits this particular traveller based on their profile.
- Day plans should feel human and flow logically — consider travel time between locations.
- Departure and arrival days should have partial plans (not full morning/afternoon/evening).
  Use null for time slots that don't apply (e.g. no "morning" on a day when they fly at 2pm).

OUTPUT FORMAT:
After your research, output the itinerary as a single JSON block wrapped in ```json ... ```.
The JSON must match this exact schema — no extra fields, no missing fields:

{
  "trip_title": "string",
  "overview": "string (2-3 sentences describing the trip character)",
  "destinations": [{"name": "string", "nights": integer}],
  "day_plans": [{
    "day_number": integer,
    "date": "YYYY-MM-DD",
    "location_base": "string",
    "morning": {"title": "string", "details": "string (2-3 sentences)", "booking_needed": boolean, "est_cost_aud": number|null} | null,
    "afternoon": {"title": "string", "details": "string", "booking_needed": boolean, "est_cost_aud": number|null} | null,
    "evening": {"title": "string", "details": "string", "booking_needed": boolean, "est_cost_aud": number|null} | null,
    "notes": ["string"]
  }],
  "accommodation_suggestions": [{"area": "string", "style": "string", "notes": "string"}],
  "transport_notes": ["string"],
  "budget_summary": {"estimated_total_aud": number|null, "assumptions": ["string"]},
  "packing_checklist": ["string"],
  "risks_and_notes": ["string"]
}"""

INTAKE_CHAT_SYSTEM = """You are Maya, a friendly and knowledgeable travel consultant at Papaya Travel.
Your job is to have a warm, natural conversation to understand a client's travel needs.

You must collect the following information — but do it conversationally, not like a form.
Ask 1-2 things at a time maximum. Use yes/no and multiple-choice questions where possible.

REQUIRED information to collect:
1. Travel companions — who's coming? (solo, couple, family with kids ages, friends group)
2. Purpose/vibe — honeymoon, adventure, relaxation, culture, family holiday, bucket list?
3. Pace — packed schedule vs slow travel?
4. Accommodation style — luxury resort, boutique local, mid-range hotel, budget/backpacker, unique stays (treehouses, ryokans)?
5. Food — any dietary restrictions? Adventurous or prefer familiar? Street food or fine dining?
6. Activity profile — outdoors/hiking, beaches, cultural sites, nightlife, markets, cooking classes, wildlife?
7. Fitness/mobility — will they do strenuous hikes? Long walks OK?
8. Experience level — first time in this region or well-travelled there?
9. Non-negotiables — anything already booked, or absolute must-includes?
10. Must-avoids — tourist traps, certain foods, party areas?
11. Budget split — prefer to spend on accommodation or experiences?

Start with a warm greeting. You already know their destination, dates, origin city, and budget from the booking form.

When you have collected all required information, end your FINAL message with exactly this marker on its own line:
[INTAKE_COMPLETE]

Keep responses concise — 2-4 sentences max per message. Be warm, not robotic."""


# ─── Intake chat ─────────────────────────────────────────────────────────────

def intake_chat_turn(
    messages: list[dict],
    seed_data: dict,
) -> tuple[str, bool]:
    """
    Run one turn of the intake conversation.
    Returns (assistant_message, is_complete).
    seed_data: {destination, origin_city, start_date, end_date, budget_range, travellers_count}
    """
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY is not configured")

    client = anthropic.Anthropic(api_key=api_key)

    context = (
        f"CLIENT DETAILS FROM BOOKING FORM:\n"
        f"- Destination: {seed_data.get('destination', 'Not specified')}\n"
        f"- Departing from: {seed_data.get('origin_city', 'Not specified')}\n"
        f"- Dates: {seed_data.get('start_date')} to {seed_data.get('end_date')}\n"
        f"- Budget: {seed_data.get('budget_range', 'Not specified')}\n"
        f"- Number of travellers: {seed_data.get('travellers_count', 1)}\n\n"
        "Now have a natural conversation to collect all remaining required information."
    )

    system = f"{INTAKE_CHAT_SYSTEM}\n\n{context}"

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=system,
        messages=messages,
    )

    text = response.content[0].text
    is_complete = "[INTAKE_COMPLETE]" in text
    # Strip the marker from displayed text
    display_text = text.replace("[INTAKE_COMPLETE]", "").strip()

    return display_text, is_complete


# ─── Itinerary generation ─────────────────────────────────────────────────────

def build_generation_prompt(
    trip: Trip,
    intake: IntakeResponse,
    client: Client,
    conversation_transcript: str = "",
) -> str:
    days = (trip.end_date - trip.start_date).days
    parts = [
        f"Create a detailed {days}-day travel itinerary for the following client.\n",
        f"CLIENT: {client.name}",
        f"ORIGIN: {trip.origin_city}",
        f"DESTINATION: {trip.title}",
        f"DATES: {trip.start_date.isoformat()} to {trip.end_date.isoformat()} ({days} days)",
        f"BUDGET: {trip.budget_range}",
        f"PACE: {trip.pace}",
        f"TRAVELLERS: {intake.travellers_count}",
        f"ACCOMMODATION STYLE: {intake.accommodation_style}",
        f"INTERESTS: {', '.join(intake.interests) if intake.interests else 'General'}",
    ]

    if intake.must_dos:
        parts.append(f"MUST INCLUDE: {intake.must_dos}")
    if intake.must_avoid:
        parts.append(f"MUST AVOID: {intake.must_avoid}")
    if intake.constraints:
        parts.append(f"CONSTRAINTS: {intake.constraints}")

    if conversation_transcript:
        parts.append(
            f"\nDETAILED CLIENT PROFILE (from intake conversation):\n{conversation_transcript}"
        )
    elif intake.notes:
        parts.append(f"ADDITIONAL NOTES: {intake.notes}")

    parts.append(
        "\nSearch the web for real, specific, currently-operating places "
        "(hotels, restaurants, attractions) that match this profile. "
        "Use actual names throughout. Output the complete itinerary JSON."
    )

    return "\n".join(parts)


def _parse_json_from_text(text: str) -> dict:
    """Extract JSON from a ```json ... ``` block or raw JSON."""
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if match:
        return json.loads(match.group(1))
    # Fallback: try to find raw JSON object
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        return json.loads(match.group(0))
    raise ValueError("No JSON found in Claude response")


def _call_claude_with_search(system: str, user_prompt: str) -> str:
    """
    Call Claude with web_search enabled. Handles multi-turn tool use
    automatically until we get a final text response.
    """
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY is not configured")

    client = anthropic.Anthropic(api_key=api_key)

    messages = [{"role": "user", "content": user_prompt}]
    tools = [{"type": "web_search_20250305", "name": "web_search", "max_uses": 8}]

    for turn in range(MAX_TURNS):
        response = client.beta.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=8000,
            system=system,
            messages=messages,
            tools=tools,
            betas=["web-search-2025-03-05"],
        )

        logger.info("Claude turn %d: stop_reason=%s", turn + 1, response.stop_reason)

        # Collect text from this response
        text_parts = []
        has_tool_use = False

        for block in response.content:
            if hasattr(block, "text"):
                text_parts.append(block.text)
            elif block.type == "tool_use":
                has_tool_use = True

        if response.stop_reason == "end_turn" or not has_tool_use:
            return "\n".join(text_parts)

        # Continue the conversation — add assistant turn and tool results
        messages.append({"role": "assistant", "content": response.content})
        tool_results = [
            {
                "type": "tool_result",
                "tool_use_id": block.id,
                "content": "Search completed.",
            }
            for block in response.content
            if block.type == "tool_use"
        ]
        messages.append({"role": "user", "content": tool_results})

    raise ValueError(f"Claude did not finish after {MAX_TURNS} turns")


def generate_itinerary(
    db: Session,
    trip_id: uuid.UUID,
    additional_instructions: str = "",
    conversation_transcript: str = "",
) -> Itinerary:
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise ValueError(f"Trip {trip_id} not found")

    intake = db.query(IntakeResponse).filter(IntakeResponse.trip_id == trip_id).first()
    if not intake:
        raise ValueError(f"Intake for trip {trip_id} not found")

    client_obj = db.query(Client).filter(Client.id == trip.client_id).first()
    if not client_obj:
        raise ValueError(f"Client for trip {trip_id} not found")

    user_prompt = build_generation_prompt(trip, intake, client_obj, conversation_transcript)
    if additional_instructions:
        user_prompt += f"\n\nSPECIAL INSTRUCTIONS FOR THIS VERSION:\n{additional_instructions}"

    last_exc = None
    for attempt in range(MAX_RETRIES):
        try:
            raw_text = _call_claude_with_search(ITINERARY_SYSTEM, user_prompt)
            itinerary_data = _parse_json_from_text(raw_text)
            break
        except Exception as e:
            last_exc = e
            if attempt < MAX_RETRIES - 1:
                delay = RETRY_DELAYS[attempt]
                logger.warning("Generation attempt %d failed, retrying in %ds: %s", attempt + 1, delay, e)
                time.sleep(delay)
            else:
                raise ValueError(f"Itinerary generation failed after {MAX_RETRIES} attempts: {last_exc}") from e

    existing = db.query(Itinerary).filter(Itinerary.trip_id == trip_id).all()
    next_version = max((i.version for i in existing), default=0) + 1

    rendered_md = render_itinerary_markdown(itinerary_data)

    itinerary = Itinerary(
        trip_id=trip_id,
        itinerary_json=itinerary_data,
        rendered_md=rendered_md,
        version=next_version,
        created_at=datetime.utcnow(),
    )
    db.add(itinerary)

    if trip.status in ("INTAKE", "GENERATING"):
        trip.status = "REVIEW"
        trip.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(itinerary)
    return itinerary


# ─── Chat refinement ─────────────────────────────────────────────────────────

CHAT_SYSTEM = """You are Maya, an expert travel consultant at Papaya Travel.
You are helping a client refine their travel itinerary.

The client's current itinerary is provided as JSON context.
Respond conversationally and warmly — like a knowledgeable friend, not a chatbot.

If the client asks a question (e.g. "what's the weather like in Bali in July?"), answer it conversationally.

If the client wants changes to the itinerary (e.g. "make day 3 more relaxed", "swap the cooking class for snorkelling"), then:
1. Describe the changes you're making in a friendly sentence or two
2. Output the COMPLETE updated itinerary JSON in a ```json block at the end of your response

Important: only include the ```json block when you are making actual changes to the itinerary.
Keep all responses concise — 2-4 sentences for conversational replies."""


def chat_with_itinerary(
    messages: list[dict],
    itinerary_json: dict,
    trip_context: str,
) -> tuple[str, dict | None]:
    """
    Run one turn of itinerary refinement chat.
    Returns (assistant_message, updated_itinerary_json | None).
    updated_itinerary_json is set only when Claude made changes.
    """
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY is not configured")

    client = anthropic.Anthropic(api_key=api_key)

    system = (
        f"{CHAT_SYSTEM}\n\n"
        f"TRIP CONTEXT:\n{trip_context}\n\n"
        f"CURRENT ITINERARY JSON:\n```json\n{json.dumps(itinerary_json, indent=2)}\n```"
    )

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=8000,
        system=system,
        messages=messages,
    )

    text = response.content[0].text
    updated = None

    # Check if Claude included an updated itinerary JSON block
    try:
        updated = _parse_json_from_text(text)
        # Strip the JSON block from the displayed message
        text = re.sub(r"```(?:json)?\s*\{.*?\}\s*```", "", text, flags=re.DOTALL).strip()
    except (ValueError, json.JSONDecodeError):
        pass  # No JSON block — conversational reply only

    return text, updated


# ─── Accommodation suggestions ────────────────────────────────────────────────

ACCOMMODATION_SYSTEM = """You are an expert travel consultant researching accommodation options.
Search the web for real, currently-operating hotels and properties.
Return ONLY a JSON array (no other text) matching this schema exactly:
[
  {
    "name": "exact property name",
    "area": "neighbourhood or area",
    "style": "e.g. Luxury Resort / Boutique Hotel / Mid-range / Budget",
    "price_per_night_aud": number or null,
    "why_suits": "1 sentence explaining why this suits this specific traveller",
    "google_maps_url": "https://maps.google.com/?q=Property+Name+City",
    "booking_com_search": "https://www.booking.com/search.html?ss=Property+Name",
    "notes": "any important details — book ahead, great breakfast, pool access, etc."
  }
]
Include 4-6 options across a range of styles within the client's budget.
Only include real properties you are confident exist and are currently operating."""


def generate_accommodation_suggestions(
    trip_title: str,
    origin_city: str,
    budget_range: str,
    accommodation_style: str,
    traveller_profile: str,
    destinations: list[str],
) -> list[dict]:
    """Search for real accommodation options matching the client's profile."""
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY is not configured")

    client = anthropic.Anthropic(api_key=api_key)

    dest_str = ", ".join(destinations) if destinations else trip_title
    prompt = (
        f"Find real accommodation options for this trip:\n"
        f"Destination: {dest_str}\n"
        f"Preferred style: {accommodation_style}\n"
        f"Budget: {budget_range} AUD total trip budget\n"
        f"Traveller profile: {traveller_profile}\n\n"
        f"Search for currently-available properties and return the JSON array."
    )

    tools = [{"type": "web_search_20250305", "name": "web_search", "max_uses": 5}]
    messages = [{"role": "user", "content": prompt}]

    for _ in range(MAX_TURNS):
        response = client.beta.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=4000,
            system=ACCOMMODATION_SYSTEM,
            messages=messages,
            tools=tools,
            betas=["web-search-2025-03-05"],
        )

        text_parts = []
        has_tool_use = False
        for block in response.content:
            if hasattr(block, "text"):
                text_parts.append(block.text)
            elif block.type == "tool_use":
                has_tool_use = True

        if response.stop_reason == "end_turn" or not has_tool_use:
            raw = "\n".join(text_parts)
            # Extract JSON array from response
            match = re.search(r"\[.*\]", raw, re.DOTALL)
            if match:
                return json.loads(match.group(0))
            return []

        messages.append({"role": "assistant", "content": response.content})
        tool_results = [
            {"type": "tool_result", "tool_use_id": b.id, "content": "Search completed."}
            for b in response.content if b.type == "tool_use"
        ]
        messages.append({"role": "user", "content": tool_results})

    return []


# ─── Flight suggestions ───────────────────────────────────────────────────────

FLIGHTS_SYSTEM = """You are a flight expert helping Australian travellers find the best routes.
Return ONLY a JSON array (no other text) matching this schema exactly:
[
  {
    "route": "e.g. Sydney → Bali (Denpasar)",
    "airlines": ["Jetstar", "AirAsia"],
    "typical_price_aud": "e.g. $400–$650 return",
    "flight_time": "e.g. ~6 hours direct",
    "tips": "best time to book, peak season warnings, layover tips",
    "google_flights_url": "pre-filled Google Flights URL for this route and dates",
    "skyscanner_url": "pre-filled Skyscanner URL"
  }
]
Include all legs of the journey (outbound, return, any internal flights needed).
Build Google Flights URLs in this format:
https://www.google.com/travel/flights?q=Flights+from+ORIGIN+to+DEST+on+DATE
Build Skyscanner URLs in this format:
https://www.skyscanner.com.au/transport/flights/ORIG/DEST/YYMMDD/YYMMDD/"""


def generate_flight_suggestions(
    origin_city: str,
    trip_title: str,
    start_date: str,
    end_date: str,
    budget_range: str,
    travellers_count: int,
    destinations: list[str],
) -> list[dict]:
    """Generate flight route suggestions with booking deep links."""
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY is not configured")

    client = anthropic.Anthropic(api_key=api_key)

    dest_str = ", ".join(destinations) if destinations else trip_title
    prompt = (
        f"Suggest flight options for:\n"
        f"From: {origin_city}, Australia\n"
        f"To: {dest_str}\n"
        f"Outbound: {start_date}\n"
        f"Return: {end_date}\n"
        f"Travellers: {travellers_count}\n"
        f"Total budget: {budget_range} AUD\n\n"
        f"Include all required flight legs. Build accurate deep links. Return the JSON array."
    )

    tools = [{"type": "web_search_20250305", "name": "web_search", "max_uses": 3}]
    messages = [{"role": "user", "content": prompt}]

    for _ in range(MAX_TURNS):
        response = client.beta.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=3000,
            system=FLIGHTS_SYSTEM,
            messages=messages,
            tools=tools,
            betas=["web-search-2025-03-05"],
        )

        text_parts = []
        has_tool_use = False
        for block in response.content:
            if hasattr(block, "text"):
                text_parts.append(block.text)
            elif block.type == "tool_use":
                has_tool_use = True

        if response.stop_reason == "end_turn" or not has_tool_use:
            raw = "\n".join(text_parts)
            match = re.search(r"\[.*\]", raw, re.DOTALL)
            if match:
                return json.loads(match.group(0))
            return []

        messages.append({"role": "assistant", "content": response.content})
        tool_results = [
            {"type": "tool_result", "tool_use_id": b.id, "content": "Search completed."}
            for b in response.content if b.type == "tool_use"
        ]
        messages.append({"role": "user", "content": tool_results})

    return []


# ─── Markdown renderer ────────────────────────────────────────────────────────

def render_itinerary_markdown(data: dict) -> str:
    lines = []
    lines.append(f"# {data.get('trip_title', 'Travel Itinerary')}\n")
    lines.append("## Overview")
    lines.append(data.get("overview", "") + "\n")

    for d in data.get("destinations", []):
        lines.append(f"- **{d['name']}** — {d['nights']} nights")
    if data.get("destinations"):
        lines.append("")

    for day in data.get("day_plans", []):
        lines.append(f"### Day {day['day_number']} — {day['date']} | {day['location_base']}")
        for period in ["morning", "afternoon", "evening"]:
            block = day.get(period)
            if block:
                cost = f" (~${block['est_cost_aud']} AUD)" if block.get("est_cost_aud") else ""
                booking = " *(booking required)*" if block.get("booking_needed") else ""
                lines.append(f"**{period.capitalize()}:** {block['title']}{cost}{booking}")
                lines.append(block["details"])
        for note in day.get("notes", []):
            lines.append(f"> {note}")
        lines.append("")

    if data.get("accommodation_suggestions"):
        lines.append("## Accommodation Suggestions")
        for a in data["accommodation_suggestions"]:
            lines.append(f"- **{a['area']}** ({a['style']}): {a['notes']}")
        lines.append("")

    if data.get("transport_notes"):
        lines.append("## Transport Notes")
        for t in data["transport_notes"]:
            lines.append(f"- {t}")
        lines.append("")

    budget = data.get("budget_summary", {})
    if budget:
        lines.append("## Budget Summary")
        if budget.get("estimated_total_aud"):
            lines.append(f"**Estimated Total:** ${budget['estimated_total_aud']:,.0f} AUD")
        for a in budget.get("assumptions", []):
            lines.append(f"- {a}")
        lines.append("")

    if data.get("packing_checklist"):
        lines.append("## Packing Checklist")
        for item in data["packing_checklist"]:
            lines.append(f"- [ ] {item}")
        lines.append("")

    if data.get("risks_and_notes"):
        lines.append("## Risks & Important Notes")
        for r in data["risks_and_notes"]:
            lines.append(f"- {r}")
        lines.append("")

    return "\n".join(lines)
