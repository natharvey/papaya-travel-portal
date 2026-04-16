import os
import json
import uuid
import time
import re
import logging
import threading
from datetime import datetime
from sqlalchemy.orm import Session
import anthropic

from app.models import Trip, Itinerary, IntakeResponse, Client

logger = logging.getLogger(__name__)

MAX_TURNS = 8        # max web-search rounds for accommodation/flight suggestions
MAX_RETRIES = 3
RETRY_DELAYS = [70, 90, 120]  # must exceed the 60s rate-limit window

# ─── System prompts ───────────────────────────────────────────────────────────

ITINERARY_SYSTEM = """You are an expert travel consultant for Papaya Travel, a boutique Australian travel agency.
You create detailed, highly personalised itineraries for Australian travellers.

CRITICAL RULES:
- Always use REAL, SPECIFIC place names — actual restaurants, attractions, temples, beaches, viewpoints.
  Never say "a local restaurant" or "a café". Name the actual place with its real name.
- Draw on your extensive knowledge of real, operating establishments worldwide.
- Quote all costs in AUD (Australian Dollars).
- Consider real opening hours, booking requirements, and seasonal factors.
- For each activity, include WHY it suits this particular traveller based on their profile.
- Day plans should feel human and flow logically — consider travel time between locations.
- Departure and arrival days should have partial plans (not full morning/afternoon/evening).
  Use null for time slots that don't apply (e.g. no "morning" on a day when they fly at 2pm).
- IMPORTANT: Morning/afternoon/evening slots are for ACTIVITIES only — dining, sightseeing, experiences, transport.
  NEVER put accommodation check-in/check-out as a day plan slot. Accommodation is handled separately.
  A "check in to hotel" activity is not an acceptable day plan entry.

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
    "morning": {"title": "string", "details": "string (2-3 sentences)", "booking_needed": boolean, "est_cost_aud": number|null, "photo_query": "string", "tip": "string|null"} | null,
    "afternoon": {"title": "string", "details": "string", "booking_needed": boolean, "est_cost_aud": number|null, "photo_query": "string", "tip": "string|null"} | null,
    "evening": {"title": "string", "details": "string", "booking_needed": boolean, "est_cost_aud": number|null, "photo_query": "string", "tip": "string|null"} | null,
    "notes": ["string"]
  }],
  "transport_legs": [
    {
      "from": "string — must exactly match the origin city or a destination name from the destinations array",
      "to": "string — must exactly match the origin city or a destination name from the destinations array",
      "mode": "flight | drive | train | bus | ferry | cruise | transfer",
      "duration": "string e.g. '~24 hrs', '3.5 hrs', '45 min'",
      "notes": "string — one specific booking tip for this leg, empty string if none"
    }
  ],
  "hotel_suggestions": [
    {
      "destination": "string — matches a name in the destinations array",
      "name": "string — real hotel name",
      "area": "string — neighbourhood/district",
      "style": "string — e.g. Boutique, Luxury, Mid-range, Budget",
      "why_suits": "string — 1-2 sentences on why it fits this traveller",
      "price_per_night_aud": number|null,
      "booking_com_search": "https://www.booking.com/search.html?ss=HOTEL+CITY",
      "google_maps_url": "https://www.google.com/maps/search/HOTEL+NAME+CITY"
    }
  ],
  "transport_notes": ["string"],
  "budget_summary": {"estimated_total_aud": number|null, "assumptions": ["string"]},
  "packing_checklist": ["string"],
  "risks_and_notes": ["string"]
}

ACTIVITY TIP RULES:
- Each activity block has an optional "tip" field. Use it for ONE critical piece of practical advice specific to that activity — dress code (e.g. "Cover shoulders and knees to enter"), advance booking requirement, best arrival time, or essential local etiquette.
- Keep it to a single concise sentence. If nothing genuinely important applies, set it to null.
- Do NOT repeat information already in "details". Do NOT use it for general observations or marketing copy.

DAY NOTES RULES:
- "notes" is for day-level context NOT tied to any specific activity — neighbourhood character, what to wear for the day's weather, packing reminder, or a cultural observation about the area.
- Leave it as an empty array [] if nothing genuinely useful applies. Do NOT pad it.

PHOTO QUERY RULES:
- Each morning/afternoon/evening block must include a "photo_query" field: 2-4 words for an Unsplash image search
- Pick the most visually recognisable element of the activity — a landmark, scenery type, or cuisine style
- Generic enough to return results, specific enough to not mislead. Never use people's names or niche venue names
- CRITICAL: The three queries within a single day (morning/afternoon/evening) must be visually distinct from each other — different subjects, not just different words. A hiking trail, a luxury shopping street, and a candlelit restaurant should produce completely different images
- Examples: "Runyon Canyon trail" · "Italian restaurant dinner" · "Shibuya crossing night" · "Tsukiji fish market" · "Kyoto bamboo grove" · "French pastry cafe" · "coastal cliff walk" · "rooftop bar city" · "museum art gallery" · "street food market"

HOTEL SUGGESTIONS RULES:
- Include 6-8 hotel suggestions per destination (we verify against Google Places and need enough candidates to land 3 confirmed results per destination)
- CRITICAL: Use the EXACT official hotel name as it appears on Google Maps and Booking.com — not a paraphrase, not a shortened version. For example "Park Hyatt Tokyo" not "Park Hyatt" or "Tokyo Park Hyatt". Precision here is essential.
- Prefer well-known, established properties (major international chains, well-reviewed boutique hotels with strong online presence) over obscure or newly opened properties — these are far more likely to be indexed on Google Places
- Never invent or approximate a hotel name. If you are not confident the hotel exists under that exact name, do not include it
- Match style to the client's accommodation preference
- Price should be realistic for the budget and destination
- booking_com_search URL: use the format https://www.booking.com/search.html?ss=HOTEL+NAME+CITY (URL-encode spaces as +)
- google_maps_url: use the format https://www.google.com/maps/search/HOTEL+NAME+CITY (URL-encode spaces as +)

TRANSPORT LEGS RULES:
- Must cover the full round trip: origin city → destination 1 → destination 2 → ... → origin city
- "from" and "to" values must exactly match the names used in "destinations" or the origin city
- Choose mode based on realistic options for that route:
  flight for long-haul international legs, train for rail corridors (Tokyo→Kyoto, London→Edinburgh),
  drive for road trips and short overland routes, ferry for island crossings and water routes,
  bus for coach connections, cruise for ocean/river cruise segments
- Put leg-specific booking advice in the leg's "notes" field (e.g. "Book Shinkansen tickets in advance via JR Pass")
- Keep "transport_notes" for general destination transport tips only (e.g. "Get a Suica card for Tokyo transit")
  not for advice that belongs to a specific leg"""

INTAKE_CHAT_SYSTEM = """You are Maya, a travel consultant at Papaya Travel — a boutique Australian travel agency.

PERSONA:
You're the well-travelled friend who happens to be a professional. You've been everywhere, you give advice like someone who genuinely loves travel, not someone reading from a brochure. You're warm, occasionally dry, never salesy. You make clients feel like they're getting insider knowledge, not a packaged service.

Your humour is situational and dry — a knowing observation about a destination, a mild aside that slips out naturally. Never performed, never emoji-driven, never a setup-and-punchline joke. One light touch every few messages at most. If a client is typing short answers or seems in a hurry, read the room and drop it entirely.

You never say things like:
- "Ooh how exciting!" / "That sounds amazing!" / "Great choice!"
- "I'd be happy to help with that"
- "Certainly!" / "Absolutely!"
- "Embarking on a journey"

You do say things like:
- "Good timing — [specific observation about destination/season]"
- "First time in [place]?" (then a real insight, not a generic one)
- Short, confident questions that assume you know what you're doing

CONVERSATION RULES:
- Ask 1-2 things per message maximum. Never more.
- Prefer closed questions over open ones. Give options rather than asking them to invent an answer.
- You already know destination, dates, origin city, and budget — never ask about these.
- Keep replies to 2-4 sentences. You're having a conversation, not writing an email.
- Never number your questions or use bullet points. This is a chat.
- If someone gives a short answer, match their pace. If they're chatty, you can be too.

REQUIRED information to collect (work through these naturally, not in order):
1. Travel companions — who's coming? (solo, couple, family with kids ages, friends group)
2. Purpose/vibe — honeymoon, adventure, relaxation, culture, family holiday, bucket list?
3. Pace — packed schedule vs slow travel?
4. Accommodation style — luxury resort, boutique local, mid-range hotel, budget/backpacker, unique stays?
5. Food — dietary restrictions? Adventurous or prefer familiar? Street food or fine dining?
6. Activity profile — outdoors/hiking, beaches, cultural sites, nightlife, markets, cooking classes, wildlife?
7. Fitness/mobility — strenuous hikes OK? Long walking days fine?
8. Experience level — first time in this region or well-travelled there?
9. Non-negotiables — anything already booked, or absolute must-includes?
10. Must-avoids — tourist traps, certain foods, party areas?
11. Budget split — prefer to spend on accommodation or experiences?

OPENING MESSAGE:
When the conversation starts with [START_CONVERSATION], send your opening message. Use the destination and context above to make it specific — reference the destination, season, or something real. Ask one focused first question (who's travelling, or first time there, etc.). Do NOT introduce yourself as "Maya, your Papaya travel consultant" — just dive in like a person who knows what they're doing.

EXAMPLES OF GOOD vs BAD OPENINGS:

BAD: "Hello! I'm Maya, your travel consultant. I'm so excited to help plan your trip to Bali! Could you tell me who will be travelling with you?"

GOOD (for a couple going to Bali): "Bali in July — solid choice, that's peak dry season so you'll get the best weather. Are you heading over as a couple, or is there a group involved?"

GOOD (for a family going to Japan): "Japan with kids is genuinely one of the best family trips you can do — they go absolutely feral for it. How old are yours?"

GOOD (for solo traveller going to Portugal): "Portugal is having a moment right now, though thankfully Lisbon's not quite as overrun as it was two summers ago. Travelling solo?"

EXAMPLES OF GOOD FOLLOW-UP QUESTIONS:

BAD: "Great! Now, what kind of accommodation do you prefer? We have many options available."

GOOD: "Are you more of a nice hotel person, or do you like something with a bit more local character — boutique guesthouse, that kind of thing?"

BAD: "What activities are you interested in? Please list your preferences."

GOOD: "When you picture a good day there — are you out doing stuff, or is half the plan just finding a good spot to sit?"

WHEN WRAPPING UP:
When you have collected all required information, send a warm closing message that briefly reflects back what you've gathered (1-2 sentences — make them feel heard, not summarised). End that message with exactly this marker on its own line:
[INTAKE_COMPLETE]"""


# ─── Analyser ─────────────────────────────────────────────────────────────────

ANALYSER_SYSTEM = """You are a client profile analyst for Papaya Travel.

Your job is to read an intake conversation between Maya (travel consultant) and a client,
then extract a structured profile of the client's travel preferences and personality.

RULES:
- Do NOT infer or assume facts the client did not state. If something is unclear, add it to "gaps".
- "personality_type" is 1-2 sentences describing how this person travels — their mindset, priorities,
  and what makes a trip feel successful to them. Write it as context for an itinerary generator.
- "key_insights" are 3-5 specific, actionable points the generator should act on.
- Call the extract_client_profile tool with your findings. Do not output anything else."""

# Tool schema — Claude must call this, guaranteeing valid structured output
_ANALYSER_TOOL = {
    "name": "extract_client_profile",
    "description": "Extract and structure a client's travel preferences from their intake conversation.",
    "input_schema": {
        "type": "object",
        "properties": {
            "travel_companions": {"type": "string", "description": "Who is travelling, e.g. 'couple', 'family with 2 kids aged 6 and 9', 'solo'"},
            "group_size": {"type": "integer"},
            "trip_purpose": {"type": "string", "description": "Primary intent e.g. honeymoon, adventure, relaxation, culture, family holiday"},
            "pace": {"type": "string", "enum": ["relaxed", "moderate", "packed"]},
            "accommodation_style": {"type": "string", "enum": ["luxury", "boutique", "mid-range", "budget", "unique"]},
            "accommodation_priority": {"type": "string", "enum": ["high", "medium", "low"]},
            "food_profile": {
                "type": "object",
                "properties": {
                    "dietary_restrictions": {"type": "array", "items": {"type": "string"}},
                    "adventurousness": {"type": "string", "enum": ["adventurous", "moderate", "familiar"]},
                    "dining_style": {"type": "string", "enum": ["street food", "casual", "mid-range", "fine dining", "mix"]},
                },
                "required": ["dietary_restrictions", "adventurousness", "dining_style"],
            },
            "activity_profile": {
                "type": "object",
                "properties": {
                    "interests": {"type": "array", "items": {"type": "string"}, "description": "From: outdoors, beaches, culture, nightlife, markets, cooking, wildlife, shopping, art, sport"},
                    "fitness_level": {"type": "string", "enum": ["low", "moderate", "high"]},
                    "avoid": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["interests", "fitness_level", "avoid"],
            },
            "experience_level": {"type": "string", "enum": ["first-timer", "some experience", "well-travelled"]},
            "must_dos": {"type": "array", "items": {"type": "string"}},
            "must_avoids": {"type": "array", "items": {"type": "string"}},
            "non_negotiables": {"type": "array", "items": {"type": "string"}, "description": "Already booked items or hard constraints"},
            "budget_priority": {"type": "string", "enum": ["accommodation", "experiences", "balanced"]},
            "personality_type": {"type": "string", "description": "1-2 sentences on how this person travels — for the itinerary generator"},
            "key_insights": {"type": "array", "items": {"type": "string"}, "description": "3-5 actionable points for the generator"},
            "gaps": {"type": "array", "items": {"type": "string"}, "description": "Things unclear or not covered — generator should make safe assumptions"},
        },
        "required": [
            "travel_companions", "group_size", "trip_purpose", "pace",
            "accommodation_style", "accommodation_priority", "food_profile",
            "activity_profile", "experience_level", "must_dos", "must_avoids",
            "non_negotiables", "budget_priority", "personality_type", "key_insights", "gaps",
        ],
    },
}


def analyse_intake(
    transcript: str,
    seed_data: dict,
) -> dict:
    """
    Analyse a completed intake conversation and return a structured ClientProfile dict.
    Uses tool_use to guarantee valid structured output — no regex parsing.

    transcript: formatted conversation text (e.g. "Maya: ...\nClient: ...")
    seed_data: {destination, origin_city, start_date, end_date, budget_range, travellers_count}
    """
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY is not configured")

    client = anthropic.Anthropic(api_key=api_key)

    context = (
        f"BOOKING FORM DATA:\n"
        f"- Destination: {seed_data.get('destination', 'Not specified')}\n"
        f"- Departing from: {seed_data.get('origin_city', 'Not specified')}\n"
        f"- Dates: {seed_data.get('start_date')} to {seed_data.get('end_date')}\n"
        f"- Budget: {seed_data.get('budget_range', 'Not specified')}\n"
        f"- Number of travellers: {seed_data.get('travellers_count', 1)}\n\n"
        f"INTAKE CONVERSATION:\n{transcript}"
    )

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2048,
        system=ANALYSER_SYSTEM,
        tools=[_ANALYSER_TOOL],
        tool_choice={"type": "any"},  # force a tool call
        messages=[{"role": "user", "content": context}],
    )

    # Extract the tool call input — guaranteed to match the schema
    for block in response.content:
        if block.type == "tool_use" and block.name == "extract_client_profile":
            profile = block.input
            logger.info(
                "Analyser ClientProfile: companions=%s purpose=%s pace=%s insights=%s gaps=%s",
                profile.get("travel_companions"),
                profile.get("trip_purpose"),
                profile.get("pace"),
                profile.get("key_insights"),
                profile.get("gaps"),
            )
            return profile

    raise ValueError("Analyser did not return a tool call — unexpected response")


def format_transcript(messages: list[dict]) -> str:
    """Format a role/content message list into a readable transcript string."""
    lines = []
    for m in messages:
        role = "Maya" if m["role"] == "assistant" else "Client"
        lines.append(f"{role}: {m['content']}")
    return "\n\n".join(lines)


def client_profile_to_prompt(profile: dict, seed_data: dict) -> str:
    """Convert a ClientProfile dict into a concise generator prompt block."""
    food = profile.get("food_profile") or {}
    activity = profile.get("activity_profile") or {}

    parts = [
        f"CLIENT PROFILE:",
        f"- Companions: {profile.get('travel_companions', 'Not specified')} ({profile.get('group_size', '?')} people)",
        f"- Trip purpose: {profile.get('trip_purpose', 'Not specified')}",
        f"- Pace: {profile.get('pace', 'moderate')}",
        f"- Accommodation: {profile.get('accommodation_style', 'mid-range')} (priority: {profile.get('accommodation_priority', 'medium')})",
        f"- Food: {food.get('dining_style', 'mix')} — {food.get('adventurousness', 'moderate')}",
    ]

    if food.get("dietary_restrictions"):
        parts.append(f"- Dietary restrictions: {', '.join(food['dietary_restrictions'])}")

    if activity.get("interests"):
        parts.append(f"- Interests: {', '.join(activity['interests'])}")
    if activity.get("avoid"):
        parts.append(f"- Activity avoids: {', '.join(activity['avoid'])}")

    parts.append(f"- Fitness level: {activity.get('fitness_level', 'moderate')}")
    parts.append(f"- Experience level: {profile.get('experience_level', 'some experience')}")
    parts.append(f"- Budget priority: {profile.get('budget_priority', 'balanced')}")

    if profile.get("must_dos"):
        parts.append(f"- Must-dos: {'; '.join(profile['must_dos'])}")
    if profile.get("must_avoids"):
        parts.append(f"- Must-avoids: {'; '.join(profile['must_avoids'])}")
    if profile.get("non_negotiables"):
        parts.append(f"- Non-negotiables: {'; '.join(profile['non_negotiables'])}")

    if profile.get("personality_type"):
        parts.append(f"\nTRAVEL PERSONALITY:\n{profile['personality_type']}")

    if profile.get("key_insights"):
        parts.append(f"\nKEY INSIGHTS FOR THIS ITINERARY:")
        for insight in profile["key_insights"]:
            parts.append(f"- {insight}")

    if profile.get("gaps"):
        parts.append(f"\nNOTED GAPS (make reasonable assumptions):")
        for gap in profile["gaps"]:
            parts.append(f"- {gap}")

    return "\n".join(parts)


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

    # Anthropic requires at least one message. On the first turn inject a silent
    # starter so Claude produces a proper Maya-style opening using the seed data above.
    api_messages = messages if messages else [{"role": "user", "content": "[START_CONVERSATION]"}]

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=system,
        messages=api_messages,
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
    confirmed_flights: list = None,
    confirmed_stays: list = None,
    client_profile: dict = None,
) -> str:
    days = (trip.end_date - trip.start_date).days
    parts = [
        f"Create a detailed {days}-day travel itinerary for the following client.\n",
        f"CLIENT: {client.name}",
        f"ORIGIN: {trip.origin_city}",
        f"DESTINATION: {trip.title}",
        f"DATES: {trip.start_date.isoformat()} to {trip.end_date.isoformat()} ({days} days)",
        f"BUDGET: {trip.budget_range}",
    ]

    if confirmed_flights:
        parts.append("\nCONFIRMED FLIGHTS (already booked — structure itinerary around these exact dates and times):")
        for f in confirmed_flights:
            parts.append(f"  - {f.flight_number} ({f.airline}): {f.departure_airport} → {f.arrival_airport}, departs {f.departure_time}, arrives {f.arrival_time}")

    if confirmed_stays:
        parts.append("\nCONFIRMED ACCOMMODATION (already booked — do NOT suggest alternatives for these nights):")
        for s in confirmed_stays:
            parts.append(f"  - {s.name}: check-in {s.check_in.date()}, check-out {s.check_out.date()}")

    if client_profile:
        # Prefer structured ClientProfile from Analyser agent
        seed_data = {
            "destination": trip.title,
            "origin_city": trip.origin_city,
            "start_date": trip.start_date.isoformat(),
            "end_date": trip.end_date.isoformat(),
            "budget_range": trip.budget_range,
        }
        parts.append(f"\n{client_profile_to_prompt(client_profile, seed_data)}")
    elif conversation_transcript:
        # Fallback: raw transcript (pre-Analyser path)
        transcript = conversation_transcript[:3000]
        if len(conversation_transcript) > 3000:
            transcript += "\n[truncated]"
        parts.append(
            f"\nDETAILED CLIENT PROFILE (from intake conversation):\n{transcript}"
        )
    else:
        # Fallback: structured intake fields only
        parts.extend([
            f"PACE: {trip.pace}",
            f"TRAVELLERS: {intake.travellers_count}",
            f"ACCOMMODATION STYLE: {intake.accommodation_style}",
            f"INTERESTS: {', '.join(intake.interests) if intake.interests else 'General'}",
        ])
        if intake.must_dos:
            parts.append(f"MUST INCLUDE: {intake.must_dos}")
        if intake.must_avoid:
            parts.append(f"MUST AVOID: {intake.must_avoid}")
        if intake.constraints:
            parts.append(f"CONSTRAINTS: {intake.constraints}")
        if intake.notes:
            parts.append(f"ADDITIONAL NOTES: {intake.notes}")

    parts.append(
        "\nUsing your knowledge of real, currently-operating establishments, "
        "name specific restaurants, hotels, and attractions throughout. "
        "Include exactly 3 hotel suggestions per destination in hotel_suggestions (no more, no less), "
        "covering a spread of styles within the client's budget, using exact official names as they appear on Google Maps. "
        "Output the complete itinerary JSON."
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
    client_profile: dict = None,
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

    from app.models import Flight as FlightModel, Stay as StayModel
    confirmed_flights = db.query(FlightModel).filter(FlightModel.trip_id == trip_id).order_by(FlightModel.leg_order).all()
    confirmed_stays = db.query(StayModel).filter(StayModel.trip_id == trip_id).order_by(StayModel.stay_order).all()

    user_prompt = build_generation_prompt(
        trip, intake, client_obj, conversation_transcript,
        confirmed_flights=confirmed_flights or None,
        confirmed_stays=confirmed_stays or None,
        client_profile=client_profile,
    )
    if additional_instructions:
        user_prompt += f"\n\nSPECIAL INSTRUCTIONS FOR THIS VERSION:\n{additional_instructions}"

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY is not configured")

    claude = anthropic.Anthropic(api_key=api_key)

    last_exc = None
    for attempt in range(MAX_RETRIES):
        try:
            response = claude.beta.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=16000,
                system=ITINERARY_SYSTEM,
                messages=[{"role": "user", "content": user_prompt}],
                betas=["output-128k-2025-02-19"],
            )
            raw_text = response.content[0].text
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

    if trip.status in ("INTAKE", "GENERATING", "ACTIVE"):
        trip.status = "ACTIVE"
        trip.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(itinerary)

    itinerary_id = itinerary.id

    # ── Background: hotel verification ──────────────────────────────────────
    raw_suggestions = itinerary_data.get("hotel_suggestions") or []
    if raw_suggestions:
        t = threading.Thread(
            target=_enrich_hotel_suggestions_background,
            args=(itinerary_id, raw_suggestions),
            daemon=True,
        )
        t.start()

    # ── Background: activity geocoding ───────────────────────────────────────
    t2 = threading.Thread(
        target=_geocode_activities_background,
        args=(itinerary_id, itinerary_data),
        daemon=True,
    )
    t2.start()

    return itinerary


def _enrich_hotel_suggestions_background(itinerary_id: uuid.UUID, raw_suggestions: list[dict]) -> None:
    """Verify hotel suggestions against Google Places and write enriched results back to the itinerary."""
    from app.services.places import verify_hotel_suggestions
    from app.db import SessionLocal

    verified = verify_hotel_suggestions(raw_suggestions, max_results=9)
    logger.info("Hotel verification: %d/%d suggestions verified for itinerary %s",
                len(verified), len(raw_suggestions), itinerary_id)

    db = SessionLocal()
    try:
        itinerary = db.query(Itinerary).filter(Itinerary.id == itinerary_id).first()
        if not itinerary:
            return
        updated_json = dict(itinerary.itinerary_json)
        updated_json["hotel_suggestions"] = verified
        itinerary.itinerary_json = updated_json
        db.commit()
        logger.info("Hotel suggestions enriched and saved for itinerary %s", itinerary_id)
    except Exception as e:
        logger.warning("Failed to save enriched hotel suggestions for %s: %s", itinerary_id, e)
        db.rollback()
    finally:
        db.close()


def _geocode_activities_background(itinerary_id: uuid.UUID, itinerary_data: dict) -> None:
    """Geocode all activity blocks and write coordinates back to the itinerary."""
    from app.services.places import geocode_itinerary_activities
    from app.db import SessionLocal

    try:
        enriched = geocode_itinerary_activities(itinerary_data)
    except Exception as e:
        logger.warning("Activity geocoding failed for itinerary %s: %s", itinerary_id, e)
        return

    db = SessionLocal()
    try:
        itinerary = db.query(Itinerary).filter(Itinerary.id == itinerary_id).first()
        if not itinerary:
            return
        updated_json = dict(itinerary.itinerary_json)
        updated_json["day_plans"] = enriched["day_plans"]
        itinerary.itinerary_json = updated_json
        db.commit()
        logger.info("Activity coordinates saved for itinerary %s", itinerary_id)
    except Exception as e:
        logger.warning("Failed to save activity coordinates for %s: %s", itinerary_id, e)
        db.rollback()
    finally:
        db.close()


# ─── Chat refinement ─────────────────────────────────────────────────────────

CHAT_SYSTEM = """You are Maya, a travel consultant at Papaya Travel. You help clients adjust their itinerary.

PERSONA:
Same as intake — the well-travelled friend who's also a professional. Direct, warm, occasionally dry.
The trip is planned. You're in problem-solving mode now, not sales mode. Be efficient.

RULES:
- Be direct and concise. Maximum 2 sentences for conversational replies.
- Never use emojis, bullet points, or markdown formatting in your replies. Plain sentences only.
- Never ask multiple questions at once. If you need clarification, ask one specific question.
- Act on requests immediately — do not ask for permission or confirmation before making changes.
- Never explain what you *could* do. Just do it.
- Never say "Certainly!", "Absolutely!", "Great question!" or similar filler openers.

If the client asks a travel question, answer it in 1-2 sentences.

If the client wants changes to the itinerary, make them and output the COMPLETE updated itinerary JSON in a ```json block. Briefly describe the change in one sentence before the JSON.

When outputting updated JSON:
- Preserve transport_legs exactly unless the client is changing transport
- Never remove confirmed_booking values
- Keep transport_notes unchanged unless directly relevant

Only include the ```json block when making actual changes."""


# ─── Intent classifier ────────────────────────────────────────────────────────

_INTENT_TOOL = {
    "name": "classify_intent",
    "description": "Classify the user's message intent to route it correctly.",
    "input_schema": {
        "type": "object",
        "properties": {
            "intent": {
                "type": "string",
                "enum": ["targeted_edit", "full_regeneration", "question", "general_chat"],
                "description": (
                    "targeted_edit: wants a specific change to one or a few parts of the itinerary. "
                    "full_regeneration: wants the entire itinerary rebuilt from scratch or with major new direction. "
                    "question: asking for information or advice without wanting changes. "
                    "general_chat: small talk or feedback not requiring action."
                ),
            },
            "reasoning": {"type": "string", "description": "One sentence explaining the classification."},
        },
        "required": ["intent", "reasoning"],
    },
}

_INTENT_SYSTEM = (
    "You classify a travel client's message into one of four intents: "
    "targeted_edit, full_regeneration, question, or general_chat. "
    "Call the classify_intent tool with your answer."
)


def _classify_intent(message: str) -> str:
    """
    Classify the user's last message intent using a lightweight Haiku call.
    Returns one of: 'targeted_edit', 'full_regeneration', 'question', 'general_chat'.
    Falls back to 'targeted_edit' on any error.
    """
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return "targeted_edit"

    try:
        client = anthropic.Anthropic(api_key=api_key)
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=256,
            system=_INTENT_SYSTEM,
            tools=[_INTENT_TOOL],
            tool_choice={"type": "any"},
            messages=[{"role": "user", "content": message}],
        )
        for block in response.content:
            if block.type == "tool_use" and block.name == "classify_intent":
                intent = block.input.get("intent", "targeted_edit")
                logger.info("Intent classifier: %s — %s", intent, block.input.get("reasoning", ""))
                return intent
    except Exception as e:
        logger.warning("Intent classifier failed, defaulting to targeted_edit: %s", e)

    return "targeted_edit"


def chat_with_itinerary(
    messages: list[dict],
    itinerary_json: dict,
    trip_context: str,
    client_memory: str | None = None,
) -> tuple[str, dict | None, bool]:
    """
    Run one turn of itinerary refinement chat.
    Returns (assistant_message, updated_itinerary_json | None, regeneration_requested).
    updated_itinerary_json is set only when Claude made targeted changes.
    regeneration_requested is True when the user wants a full rebuild.
    """
    last_user_msg = next((m["content"] for m in reversed(messages) if m["role"] == "user"), "")
    intent = _classify_intent(last_user_msg)

    if intent == "full_regeneration":
        return (
            "On it — rebuilding your itinerary now. Give me about 30 seconds.",
            None,
            True,
        )

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY is not configured")

    claude = anthropic.Anthropic(api_key=api_key)

    memory_block = f"\nWHAT YOU KNOW ABOUT THIS CLIENT:\n{client_memory}\n" if client_memory else ""

    system = (
        f"{CHAT_SYSTEM}"
        f"{memory_block}\n\n"
        f"TRIP CONTEXT:\n{trip_context}\n\n"
        f"CURRENT ITINERARY JSON:\n```json\n{json.dumps(itinerary_json, indent=2)}\n```"
    )

    response = claude.messages.create(
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
        text = re.sub(r"```(?:json)?\s*\{.*?\}\s*```", "", text, flags=re.DOTALL).strip()
    except (ValueError, json.JSONDecodeError):
        pass

    return text, updated, False


MEMORY_EXTRACTION_SYSTEM = """You maintain a concise memory profile for a travel client based on their conversations with Maya.

Given the existing memory (if any) and the latest conversation, output an updated memory profile.
Keep it under 150 words. Write in second person ("prefers...", "dislikes...", "has mentioned...").
Focus on: travel style preferences, budget sensitivity, activity interests, dietary needs, accommodation preferences, past feedback on itineraries.
Only include facts clearly stated by the client. Do not infer or assume.
Output the updated memory text only — no preamble."""


def extract_client_memory(existing_memory: str | None, conversation: list[dict]) -> str:
    """Extract and update client preference memory from a conversation."""
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return existing_memory or ""

    claude = anthropic.Anthropic(api_key=api_key)

    context = f"EXISTING MEMORY:\n{existing_memory or 'None yet.'}\n\nCONVERSATION:\n"
    for msg in conversation:
        role = "Client" if msg["role"] == "user" else "Maya"
        context += f"{role}: {msg['content']}\n"

    try:
        response = claude.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=300,
            system=MEMORY_EXTRACTION_SYSTEM,
            messages=[{"role": "user", "content": context}],
        )
        return response.content[0].text.strip()
    except Exception as e:
        logger.warning("Memory extraction failed: %s", e)
        return existing_memory or ""


# ─── Block edit ──────────────────────────────────────────────────────────────

BLOCK_EDIT_SYSTEM = """You are Maya, an expert travel consultant at Papaya Travel.
A client wants to modify one or more activities in their itinerary.

You will receive:
- The full list of day plans (as compact JSON)
- The specific day/period/activity they want to change
- Their instruction

Your job:
1. Make the requested change (and any related changes needed — e.g. if swapping two activities between days, update both days)
2. Return ONLY a JSON object with key "updated_days" containing an array of the changed day_plan objects
3. Each day_plan must match the original schema exactly
4. Also return a "message" key with a friendly 1-2 sentence description of what you changed

Return format (ONLY this, no other text):
{"message": "...", "updated_days": [<day_plan>, ...]}

Use real, specific place names. Keep the same style as the existing itinerary."""


def edit_block(
    itinerary_json: dict,
    day_number: int,
    period: str,
    block_title: str,
    instruction: str,
    trip_context: str,
) -> tuple[str, list[dict]]:
    """
    Make a targeted edit to one or more blocks in the itinerary.
    Returns (message, list_of_updated_day_plans).
    Fast — sends only day plans, not full itinerary metadata.
    """
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY is not configured")

    client = anthropic.Anthropic(api_key=api_key)

    # Send compact day plans only (no metadata) to keep tokens low
    day_plans = itinerary_json.get("day_plans", [])

    prompt = (
        f"TRIP CONTEXT: {trip_context}\n\n"
        f"DAY PLANS:\n{json.dumps(day_plans)}\n\n"
        f"CHANGE REQUEST:\n"
        f"Day {day_number}, {period} — \"{block_title}\"\n"
        f"Instruction: {instruction}"
    )

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=3000,
        system=BLOCK_EDIT_SYSTEM,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = response.content[0].text.strip()

    # Parse the JSON response
    try:
        result = json.loads(raw)
    except json.JSONDecodeError:
        # Try to extract JSON object from text
        match = re.search(r'\{.*\}', raw, re.DOTALL)
        if match:
            result = json.loads(match.group(0))
        else:
            raise ValueError("No JSON returned from block edit")

    message = result.get("message", "I've updated the itinerary.")
    updated_days = result.get("updated_days", [])

    return message, updated_days


# ─── Accommodation suggestions ────────────────────────────────────────────────

ACCOMMODATION_SYSTEM = """You are an expert travel consultant researching accommodation options.
Search the web for real, currently-operating hotels and properties.
Return ONLY a JSON array (no other text) matching this schema exactly:
[
  {
    "destination": "city or main destination name (e.g. Sydney, Hobart, Bali)",
    "name": "exact property name",
    "area": "neighbourhood or area within that destination",
    "style": "e.g. Luxury Resort / Boutique Hotel / Mid-range / Budget",
    "price_per_night_aud": number or null,
    "why_suits": "1 sentence explaining why this suits this specific traveller",
    "google_maps_url": "https://maps.google.com/?q=Property+Name+City",
    "booking_com_search": "https://www.booking.com/search.html?ss=Property+Name",
    "notes": "any important details — book ahead, great breakfast, pool access, etc."
  }
]
Include 2-3 options per destination across a range of styles within the client's budget.
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

    tools = [{"type": "web_search_20250305", "name": "web_search", "max_uses": 3}]
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


def generate_accommodation_for_destination(
    destination: str,
    trip_title: str,
    budget_range: str,
    accommodation_style: str,
    traveller_profile: str,
    count: int,
    exclude_names: list[str],
) -> list[dict]:
    """Fetch exactly `count` new hotel suggestions for one destination, skipping already-known hotels."""
    import math
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY is not configured")

    client = anthropic.Anthropic(api_key=api_key)

    exclude_str = ""
    if exclude_names:
        exclude_str = f"\nDo NOT suggest any of these already-listed hotels: {', '.join(exclude_names)}."

    prompt = (
        f"Find exactly {count} real accommodation options in {destination} for this trip:\n"
        f"Trip: {trip_title}\n"
        f"Preferred style: {accommodation_style}\n"
        f"Budget: {budget_range} AUD total trip budget\n"
        f"Traveller profile: {traveller_profile}{exclude_str}\n\n"
        f"Return exactly {count} hotels as a JSON array. Only real, currently-operating properties."
    )

    system = ACCOMMODATION_SYSTEM + f"\nReturn exactly {count} results."
    tools = [{"type": "web_search_20250305", "name": "web_search", "max_uses": 3}]
    messages = [{"role": "user", "content": prompt}]

    for _ in range(MAX_TURNS):
        response = client.beta.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=4000,
            system=system,
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
                results = json.loads(match.group(0))
                # Ensure destination is stamped on every result
                for r in results:
                    r.setdefault("destination", destination)
                return results
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

    if data.get("transport_legs"):
        lines.append("## Journey Overview")
        mode_labels = {
            "flight": "✈️ Flight", "drive": "🚗 Drive", "train": "🚂 Train",
            "bus": "🚌 Bus", "ferry": "⛴️ Ferry", "cruise": "🚢 Cruise", "transfer": "🚐 Transfer"
        }
        for leg in data["transport_legs"]:
            mode = mode_labels.get(leg.get("mode", ""), leg.get("mode", "").capitalize())
            duration = leg.get("duration", "")
            notes = leg.get("notes", "")
            confirmed = leg.get("confirmed_booking", "")
            line = f"- **{leg['from']} → {leg['to']}** · {mode} · {duration}"
            if confirmed:
                line += f" · ✓ {confirmed}"
            elif notes:
                line += f" — {notes}"
            lines.append(line)
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
