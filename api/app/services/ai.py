import os
import json
import uuid
from datetime import datetime
from sqlalchemy.orm import Session
from openai import OpenAI

from app.models import Trip, Itinerary, IntakeResponse, Client
from app.services.retrieval import retrieve_destination_cards

ITINERARY_SCHEMA = {
    "name": "itinerary",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {
            "trip_title": {"type": "string"},
            "overview": {"type": "string"},
            "destinations": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "nights": {"type": "integer"},
                    },
                    "required": ["name", "nights"],
                    "additionalProperties": False,
                },
            },
            "day_plans": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "day_number": {"type": "integer"},
                        "date": {"type": "string"},
                        "location_base": {"type": "string"},
                        "morning": {
                            "type": "object",
                            "properties": {
                                "title": {"type": "string"},
                                "details": {"type": "string"},
                                "booking_needed": {"type": "boolean"},
                                "est_cost_aud": {"type": ["number", "null"]},
                            },
                            "required": ["title", "details", "booking_needed", "est_cost_aud"],
                            "additionalProperties": False,
                        },
                        "afternoon": {
                            "type": "object",
                            "properties": {
                                "title": {"type": "string"},
                                "details": {"type": "string"},
                                "booking_needed": {"type": "boolean"},
                                "est_cost_aud": {"type": ["number", "null"]},
                            },
                            "required": ["title", "details", "booking_needed", "est_cost_aud"],
                            "additionalProperties": False,
                        },
                        "evening": {
                            "type": "object",
                            "properties": {
                                "title": {"type": "string"},
                                "details": {"type": "string"},
                                "booking_needed": {"type": "boolean"},
                                "est_cost_aud": {"type": ["number", "null"]},
                            },
                            "required": ["title", "details", "booking_needed", "est_cost_aud"],
                            "additionalProperties": False,
                        },
                        "notes": {"type": "array", "items": {"type": "string"}},
                    },
                    "required": ["day_number", "date", "location_base", "morning", "afternoon", "evening", "notes"],
                    "additionalProperties": False,
                },
            },
            "accommodation_suggestions": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "area": {"type": "string"},
                        "style": {"type": "string"},
                        "notes": {"type": "string"},
                    },
                    "required": ["area", "style", "notes"],
                    "additionalProperties": False,
                },
            },
            "transport_notes": {"type": "array", "items": {"type": "string"}},
            "budget_summary": {
                "type": "object",
                "properties": {
                    "estimated_total_aud": {"type": ["number", "null"]},
                    "assumptions": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["estimated_total_aud", "assumptions"],
                "additionalProperties": False,
            },
            "packing_checklist": {"type": "array", "items": {"type": "string"}},
            "risks_and_notes": {"type": "array", "items": {"type": "string"}},
        },
        "required": [
            "trip_title",
            "overview",
            "destinations",
            "day_plans",
            "accommodation_suggestions",
            "transport_notes",
            "budget_summary",
            "packing_checklist",
            "risks_and_notes",
        ],
        "additionalProperties": False,
    },
}

SYSTEM_PROMPT = """You are a professional travel consultant for Papaya Travel Portal, a boutique Australian travel agency.
You specialise in creating detailed, personalised itineraries for Australian travellers.
You are warm, knowledgeable, and attentive to client preferences.
Always quote costs in AUD (Australian Dollars).
Provide practical, actionable day-by-day plans based on the client's preferences, budget, and travel style.
Consider local seasons, practical logistics, and booking requirements.
Be specific about activities, restaurants, and experiences rather than generic suggestions."""


def build_user_prompt(trip: Trip, intake: IntakeResponse, client: Client, destination_context: str, additional_instructions: str = "") -> str:
    prompt_parts = [
        f"Please create a detailed itinerary for the following trip:\n",
        f"**Client:** {client.name} ({client.email})",
        f"**Trip Title:** {trip.title}",
        f"**Origin City:** {trip.origin_city}",
        f"**Travel Dates:** {trip.start_date.isoformat()} to {trip.end_date.isoformat()}",
        f"**Duration:** {(trip.end_date - trip.start_date).days} days",
        f"**Budget Range:** {trip.budget_range}",
        f"**Pace:** {trip.pace}",
        f"\n**Traveller Details:**",
        f"- Number of travellers: {intake.travellers_count}",
        f"- Accommodation style: {intake.accommodation_style}",
        f"- Interests: {', '.join(intake.interests) if intake.interests else 'General sightseeing'}",
    ]

    if intake.must_dos:
        prompt_parts.append(f"- Must-dos: {intake.must_dos}")
    if intake.must_avoid:
        prompt_parts.append(f"- Must avoid: {intake.must_avoid}")
    if intake.constraints:
        prompt_parts.append(f"- Constraints/requirements: {intake.constraints}")
    if intake.notes:
        prompt_parts.append(f"- Additional notes: {intake.notes}")

    if destination_context:
        prompt_parts.append(f"\n**Destination Research Cards:**\n{destination_context}")

    if additional_instructions:
        prompt_parts.append(f"\n**Special Instructions for this version:**\n{additional_instructions}")

    prompt_parts.append(
        "\nPlease create a comprehensive day-by-day itinerary covering the entire trip duration. "
        "Include specific activities, estimated costs in AUD, practical tips, accommodation suggestions, "
        "transport notes, a packing checklist, and any important risks or notes."
    )

    return "\n".join(prompt_parts)


def generate_itinerary(
    db: Session,
    trip_id: uuid.UUID,
    additional_instructions: str = "",
) -> Itinerary:
    # Fetch trip and related data
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise ValueError(f"Trip {trip_id} not found")

    intake = db.query(IntakeResponse).filter(IntakeResponse.trip_id == trip_id).first()
    if not intake:
        raise ValueError(f"Intake response for trip {trip_id} not found")

    client = db.query(Client).filter(Client.id == trip.client_id).first()
    if not client:
        raise ValueError(f"Client for trip {trip_id} not found")

    # Retrieve relevant destination cards
    destination_keywords = [trip.title, trip.origin_city]
    if intake.interests:
        destination_keywords.extend(intake.interests)

    dest_cards = retrieve_destination_cards(
        db,
        destinations=destination_keywords,
        interests=intake.interests or [],
        limit=5,
    )

    destination_context = ""
    if dest_cards:
        context_parts = []
        for card in dest_cards:
            context_parts.append(
                f"### {card.destination} ({card.region})\n"
                f"**Summary:** {card.summary}\n"
                f"**Best Season:** {card.best_season}\n"
                f"**Must-Do:** {card.must_do}\n"
                f"**Transport Tips:** {card.transport_tips}\n"
                f"**Budget Notes:** {card.budget_notes}\n"
                f"**Safety:** {card.safety_notes}\n"
                f"**Neighbourhoods:** {card.neighbourhoods}"
            )
        destination_context = "\n\n".join(context_parts)

    # Build prompts
    user_prompt = build_user_prompt(trip, intake, client, destination_context, additional_instructions)

    # Call OpenAI
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY environment variable not set")

    openai_client = OpenAI(api_key=api_key)

    response = openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        response_format={
            "type": "json_schema",
            "json_schema": ITINERARY_SCHEMA,
        },
        temperature=0.7,
        max_tokens=16000,
    )

    raw_content = response.choices[0].message.content
    itinerary_data = json.loads(raw_content)

    # Determine version number
    existing = db.query(Itinerary).filter(Itinerary.trip_id == trip_id).all()
    next_version = max((i.version for i in existing), default=0) + 1

    # Render basic markdown
    rendered_md = render_itinerary_markdown(itinerary_data)

    # Persist
    itinerary = Itinerary(
        trip_id=trip_id,
        itinerary_json=itinerary_data,
        rendered_md=rendered_md,
        version=next_version,
        created_at=datetime.utcnow(),
    )
    db.add(itinerary)

    # Update trip status to DRAFT if still INTAKE
    if trip.status == "INTAKE":
        trip.status = "DRAFT"
        from datetime import datetime as dt
        trip.updated_at = dt.utcnow()

    db.commit()
    db.refresh(itinerary)
    return itinerary


def render_itinerary_markdown(data: dict) -> str:
    lines = []
    lines.append(f"# {data.get('trip_title', 'Travel Itinerary')}")
    lines.append("")
    lines.append("## Overview")
    lines.append(data.get("overview", ""))
    lines.append("")

    destinations = data.get("destinations", [])
    if destinations:
        lines.append("## Destinations")
        for d in destinations:
            lines.append(f"- **{d['name']}** — {d['nights']} nights")
        lines.append("")

    day_plans = data.get("day_plans", [])
    if day_plans:
        lines.append("## Day-by-Day Itinerary")
        for day in day_plans:
            lines.append(f"### Day {day['day_number']} — {day['date']} | {day['location_base']}")
            for period in ["morning", "afternoon", "evening"]:
                block = day.get(period, {})
                if block:
                    cost_str = f" (~${block['est_cost_aud']} AUD)" if block.get('est_cost_aud') else ""
                    booking_str = " *(booking required)*" if block.get('booking_needed') else ""
                    lines.append(f"**{period.capitalize()}:** {block['title']}{cost_str}{booking_str}")
                    lines.append(f"{block['details']}")
            notes = day.get("notes", [])
            if notes:
                for note in notes:
                    lines.append(f"> {note}")
            lines.append("")

    accomm = data.get("accommodation_suggestions", [])
    if accomm:
        lines.append("## Accommodation Suggestions")
        for a in accomm:
            lines.append(f"- **{a['area']}** ({a['style']}): {a['notes']}")
        lines.append("")

    transport = data.get("transport_notes", [])
    if transport:
        lines.append("## Transport Notes")
        for t in transport:
            lines.append(f"- {t}")
        lines.append("")

    budget = data.get("budget_summary", {})
    if budget:
        lines.append("## Budget Summary")
        if budget.get("estimated_total_aud"):
            lines.append(f"**Estimated Total:** ${budget['estimated_total_aud']:,.0f} AUD")
        for assumption in budget.get("assumptions", []):
            lines.append(f"- {assumption}")
        lines.append("")

    packing = data.get("packing_checklist", [])
    if packing:
        lines.append("## Packing Checklist")
        for item in packing:
            lines.append(f"- [ ] {item}")
        lines.append("")

    risks = data.get("risks_and_notes", [])
    if risks:
        lines.append("## Risks & Important Notes")
        for r in risks:
            lines.append(f"- {r}")
        lines.append("")

    return "\n".join(lines)
