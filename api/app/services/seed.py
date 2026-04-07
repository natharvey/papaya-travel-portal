import os
import json
import glob
from datetime import datetime, date
from sqlalchemy.orm import Session

from app.models import DestinationCard, Client, Trip, IntakeResponse, Itinerary, Flight, Stay, Message, TripStatus, SenderType

SEED_DIR = os.getenv("SEED_DIR", "/seed/destinations")


def seed_destinations(db: Session) -> None:
    """
    Read all JSON files from the seed directory and insert DestinationCard rows
    that don't already exist. Idempotent — safe to run on every startup.
    """
    pattern = os.path.join(SEED_DIR, "*.json")
    files = glob.glob(pattern)

    if not files:
        # Try local path for development/testing
        local_dir = os.path.join(os.path.dirname(__file__), "..", "..", "..", "seed", "destinations")
        local_dir = os.path.normpath(local_dir)
        pattern = os.path.join(local_dir, "*.json")
        files = glob.glob(pattern)

    inserted = 0
    skipped = 0

    for filepath in sorted(files):
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)

            destination_name = data.get("destination")
            if not destination_name:
                continue

            # Check if already exists (idempotent)
            existing = (
                db.query(DestinationCard)
                .filter(DestinationCard.destination == destination_name)
                .first()
            )
            if existing:
                skipped += 1
                continue

            card = DestinationCard(
                destination=data.get("destination", ""),
                region=data.get("region", ""),
                tags=data.get("tags", []),
                best_season=data.get("best_season", ""),
                summary=data.get("summary", ""),
                neighbourhoods=data.get("neighbourhoods", ""),
                must_do=data.get("must_do", ""),
                transport_tips=data.get("transport_tips", ""),
                safety_notes=data.get("safety_notes", ""),
                budget_notes=data.get("budget_notes", ""),
                sample_day_blocks=data.get("sample_day_blocks", []),
                raw_text=data.get("raw_text", ""),
            )
            db.add(card)
            inserted += 1

        except (json.JSONDecodeError, IOError) as e:
            print(f"[seed] Error reading {filepath}: {e}")
            continue

    if inserted > 0 or skipped > 0:
        db.commit()
        print(f"[seed] Destinations: {inserted} inserted, {skipped} skipped.")


DEMO_EMAIL = "harvey_n@hotmail.co.uk"
DEMO_REF   = "TOKYO2026"


def seed_demo_trip(db: Session) -> None:
    """Create a polished demo trip for harvey_n@hotmail.co.uk. Idempotent."""
    if db.query(Client).filter(Client.email == DEMO_EMAIL).first():
        return  # already seeded

    # ── Client ────────────────────────────────────────────────────────────────
    client = Client(
        email=DEMO_EMAIL,
        name="Nat Harvey",
        reference_code=DEMO_REF,
    )
    db.add(client)
    db.flush()

    # ── Trip ──────────────────────────────────────────────────────────────────
    trip = Trip(
        client_id=client.id,
        title="Tokyo — 10 Days in Japan",
        origin_city="Brisbane",
        start_date=date(2026, 6, 1),
        end_date=date(2026, 6, 10),
        budget_range="8000",
        pace="moderate",
        status=TripStatus.REVIEW.value,
        admin_notes="Demo trip — great example to show clients. Flights confirmed with Jetstar, Park Hyatt booked.",
    )
    db.add(trip)
    db.flush()

    # ── Intake ────────────────────────────────────────────────────────────────
    intake = IntakeResponse(
        trip_id=trip.id,
        travellers_count=2,
        interests=["Culture & History", "Food & Dining", "Art & Museums", "Local Markets", "Architecture"],
        accommodation_style="Luxury Hotel / Resort",
        must_dos="teamLab digital art museum, Tsukiji outer market breakfast, day trip to Nikko, kaiseki dinner",
        must_avoid="very crowded tourist traps, fast food",
        constraints="",
        notes="Partner's first trip to Japan. Want a mix of modern Tokyo and traditional culture.",
        raw_json={},
    )
    db.add(intake)

    # ── Flights ───────────────────────────────────────────────────────────────
    flights = [
        Flight(
            trip_id=trip.id, leg_order=1,
            flight_number="JQ10", airline="Jetstar",
            departure_airport="BNE", arrival_airport="NRT",
            departure_time=datetime(2026, 6, 1, 10, 30),
            arrival_time=datetime(2026, 6, 2, 18, 45),
            terminal_departure="International", terminal_arrival="2",
            booking_ref="JSTAR8K",
        ),
        Flight(
            trip_id=trip.id, leg_order=2,
            flight_number="JQ11", airline="Jetstar",
            departure_airport="NRT", arrival_airport="BNE",
            departure_time=datetime(2026, 6, 10, 20, 30),
            arrival_time=datetime(2026, 6, 11, 8, 0),
            terminal_departure="2", terminal_arrival="International",
            booking_ref="JSTAR8K",
        ),
    ]
    for f in flights:
        db.add(f)

    # ── Accommodation ─────────────────────────────────────────────────────────
    stay = Stay(
        trip_id=trip.id, stay_order=1,
        name="Park Hyatt Tokyo",
        address="3-7-1-2 Nishi-Shinjuku, Shinjuku-ku, Tokyo 163-1055",
        check_in=datetime(2026, 6, 2, 15, 0),
        check_out=datetime(2026, 6, 10, 11, 0),
        confirmation_number="PHT-20260602-NAT",
        notes="Deluxe King room, floors 39–52. New York Bar access included. Request high-floor city view at check-in.",
    )
    db.add(stay)

    # ── Itinerary ─────────────────────────────────────────────────────────────
    itinerary_json = {
        "trip_title": "Tokyo — 10 Days in Japan",
        "overview": "A perfectly balanced 10-day Tokyo adventure blending world-class cuisine, cutting-edge art, ancient temples, and serene day trips — all from the iconic Park Hyatt in Shinjuku.",
        "destinations": [
            {"name": "Tokyo", "nights": 8},
            {"name": "Nikko (day trip)", "nights": 0},
            {"name": "Kamakura (day trip)", "nights": 0},
        ],
        "day_plans": [
            {
                "day_number": 1, "date": "2026-06-02", "location_base": "Tokyo — Shinjuku",
                "morning": {"title": "Arrival & Check-in", "details": "Land at Narita (NRT) at 18:45. Take the Narita Express (N'EX) to Shinjuku — approx 80 mins, ¥3,070. Check in to Park Hyatt Tokyo.", "booking_needed": False, "est_cost_aud": 45},
                "afternoon": {"title": "Settle in & Shinjuku stroll", "details": "Drop bags and explore Shinjuku at dusk. Walk through Takashimaya Times Square, then wander the Memory Lane (Omoide Yokocho) alleyway for yakitori skewers and cold Sapporo.", "booking_needed": False, "est_cost_aud": 40},
                "evening": {"title": "New York Bar, Park Hyatt", "details": "Unwind at the legendary 52nd-floor New York Bar with panoramic Tokyo views. Cocktails from ¥2,200. Lost in Translation vibes guaranteed.", "booking_needed": False, "est_cost_aud": 80},
                "notes": ["JR Pass is not needed for a Tokyo-only itinerary — get a Suica card at the airport", "Jet lag tip: stay up until 10pm local time on arrival day"],
            },
            {
                "day_number": 2, "date": "2026-06-03", "location_base": "Tokyo — Harajuku & Shibuya",
                "morning": {"title": "Meiji Shrine & Yoyogi Park", "details": "Start early at Meiji Jingu shrine (free entry) to beat the crowds. The forested walk to the main hall takes 20 mins. Stroll through Yoyogi Park afterwards.", "booking_needed": False, "est_cost_aud": 5},
                "afternoon": {"title": "Takeshita Street & Omotesando", "details": "Walk Harajuku's Takeshita Street for street fashion and crepes, then switch to the leafy luxury of Omotesando Hills for architecture and designer browsing.", "booking_needed": False, "est_cost_aud": 60},
                "evening": {"title": "Shibuya Crossing & Sky", "details": "Head to Shibuya for the famous scramble crossing at peak hour. Have dinner at Shibuya Sky observation deck restaurant (book ahead — ¥2,000 entry + dinner).", "booking_needed": True, "est_cost_aud": 120},
                "notes": ["Book Shibuya Sky online at least 3 days in advance", "Harajuku is best explored on a weekday morning"],
            },
            {
                "day_number": 3, "date": "2026-06-04", "location_base": "Tokyo — Asakusa & Akihabara",
                "morning": {"title": "Tsukiji Outer Market Breakfast", "details": "Rise early for the best sushi breakfast of your life at Tsukiji Outer Market. Daiwa Sushi or Sushi Dai open at 5am. Expect a queue — worth every minute.", "booking_needed": False, "est_cost_aud": 55},
                "afternoon": {"title": "Senso-ji Temple & Nakamise", "details": "Walk Asakusa's Nakamise shopping street to Senso-ji, Tokyo's oldest temple. Visit Kaminarimon gate and browse crafts and matcha snacks.", "booking_needed": False, "est_cost_aud": 30},
                "evening": {"title": "Akihabara Electric Town", "details": "Head to Akihabara for neon-lit electronics shops, retro arcade centres and maid cafés. Try a floor of Super Potato retro games.", "booking_needed": False, "est_cost_aud": 50},
                "notes": ["Tsukiji is best visited before 8am — stalls sell out", "Senso-ji is open 24hrs but busiest 8–11am"],
            },
            {
                "day_number": 4, "date": "2026-06-05", "location_base": "Nikko (day trip)",
                "morning": {"title": "Train to Nikko", "details": "Take the Tobu Nikko Line from Asakusa station (¥1,360 each, 2hrs). Arrive in Nikko by 10am. Head straight to Tosho-gu — Japan's most ornate shrine complex.", "booking_needed": False, "est_cost_aud": 20},
                "afternoon": {"title": "Tosho-gu Shrine & Waterfalls", "details": "Explore the gilded Tosho-gu complex (¥1,300 entry), then walk to Kegon Falls — a 97m waterfall with a lift to the viewing platform.", "booking_needed": False, "est_cost_aud": 40},
                "evening": {"title": "Return & Shinjuku dinner", "details": "Return train to Tokyo by 18:30. Dinner in Shinjuku's Kabukicho district at Ichiran ramen (private booths, solo-dining style ramen — perfect for tired legs).", "booking_needed": False, "est_cost_aud": 35},
                "notes": ["Wear comfortable shoes — Nikko involves significant walking and steps", "Buy train tickets the evening before at Asakusa station"],
            },
            {
                "day_number": 5, "date": "2026-06-06", "location_base": "Tokyo — Odaiba & teamLab",
                "morning": {"title": "Odaiba waterfront", "details": "Take the driverless Yurikamome monorail to Odaiba. Visit the life-size Gundam statue, teamLab Borderless digital art museum (book online — ¥3,200).", "booking_needed": True, "est_cost_aud": 60},
                "afternoon": {"title": "teamLab Borderless", "details": "Spend 3–4 hours in the immersive digital art maze. Wear comfortable shoes you can slip off — some rooms are barefoot. The Forest of Resonating Lamps is unmissable.", "booking_needed": True, "est_cost_aud": 0},
                "evening": {"title": "Palette Town & Tokyo Bay views", "details": "Walk the waterfront promenade for Tokyo Tower views across the bay at sunset. Dinner at Aqua City Odaiba food court for excellent variety at lower prices.", "booking_needed": False, "est_cost_aud": 45},
                "notes": ["teamLab must be booked online — they sell out weeks in advance", "The Rainbow Bridge walk is free and takes about 30 mins"],
            },
            {
                "day_number": 6, "date": "2026-06-07", "location_base": "Kamakura (day trip)",
                "morning": {"title": "Train to Kamakura", "details": "JR Yokosuka Line from Tokyo Station (¥920, 55 mins). Arrive by 9am before tour groups. Head immediately to the Great Buddha (Kotoku-in) — 13m bronze, ¥300 entry.", "booking_needed": False, "est_cost_aud": 15},
                "afternoon": {"title": "Engaku-ji & Hase Temple", "details": "Walk the Daibutsu hiking trail through bamboo groves to Hase-dera temple (¥400). The Kannon statue and hilltop ocean views are stunning.", "booking_needed": False, "est_cost_aud": 20},
                "evening": {"title": "Kamakura dinner & return", "details": "Try shirasu (whitebait) donburi — Kamakura's local specialty — at a restaurant near the station before returning to Tokyo by 19:00.", "booking_needed": False, "est_cost_aud": 40},
                "notes": ["June can be rainy season — bring a compact umbrella", "IC card works on all trains needed for this day trip"],
            },
            {
                "day_number": 7, "date": "2026-06-08", "location_base": "Tokyo — Ginza & Marunouchi",
                "morning": {"title": "Tsukiji to Ginza walk", "details": "Morning stroll from Tsukiji to Ginza (20 mins on foot). Browse the Itoya stationery store — 12 floors of Japanese paper, pens and gifts.", "booking_needed": False, "est_cost_aud": 30},
                "afternoon": {"title": "Ginza shopping & galleries", "details": "Browse flagship stores and the free Ginza Six rooftop garden. Visit the free Hermès Maison gallery or the Pola Museum Annex for contemporary Japanese art.", "booking_needed": False, "est_cost_aud": 100},
                "evening": {"title": "Kaiseki dinner", "details": "Book a kaiseki (traditional multi-course) dinner at Kojyu or Kagurazaka Ishikawa. An unmissable fine-dining experience — expect ¥25,000–¥35,000 per person.", "booking_needed": True, "est_cost_aud": 400},
                "notes": ["Book kaiseki 4–6 weeks in advance — these restaurants fill fast", "Ginza shops close at 20:00"],
            },
            {
                "day_number": 8, "date": "2026-06-09", "location_base": "Tokyo — Shinjuku Gyoen & Golden Gai",
                "morning": {"title": "Shinjuku Gyoen National Garden", "details": "Open 9am, ¥500 entry. A rare oasis of calm — 58 hectares with French formal, English landscape and Japanese traditional gardens. Allow 2 hours.", "booking_needed": False, "est_cost_aud": 8},
                "afternoon": {"title": "Tokyo National Museum", "details": "Japan's largest museum in Ueno Park. The Honkan building (Japanese Gallery) is unmissable — samurai armour, lacquerware, ceramics. ¥1,000 entry.", "booking_needed": False, "est_cost_aud": 12},
                "evening": {"title": "Golden Gai & Kabukicho", "details": "End the trip in Golden Gai — a network of tiny Shinjuku bars each seating 6–8 people. Pick a bar, have one drink, move on. Lively, local, unforgettable.", "booking_needed": False, "est_cost_aud": 60},
                "notes": ["Golden Gai bars open from 20:00", "Most bars charge a ¥500–¥1,000 table fee — normal and worth it"],
            },
            {
                "day_number": 9, "date": "2026-06-10", "location_base": "Tokyo — Departure",
                "morning": {"title": "Final morning in Shinjuku", "details": "Check out by 11am. Store luggage at the hotel (free service). Last matcha latte and pastry at Nespresso Boutique or Café de Crié in Shinjuku.", "booking_needed": False, "est_cost_aud": 20},
                "afternoon": {"title": "Last-minute shopping", "details": "Don Quijote (Don Ki) in Shinjuku for affordable souvenirs, snacks and cosmetics. Isetan Shinjuku for high-end gifts. Collect luggage by 17:00.", "booking_needed": False, "est_cost_aud": 80},
                "evening": {"title": "Narita Express to airport", "details": "Depart hotel by 17:30. N'EX from Shinjuku to Narita Terminal 2 — 80 mins, ¥3,070. Check in closes 60 mins before JQ11 departs at 20:30.", "booking_needed": False, "est_cost_aud": 45},
                "notes": ["Allow 3 hours before departure — Narita is large and security queues can be long", "Japan Post at the airport is excellent for shipping excess purchases home"],
            },
        ],
        "accommodation_suggestions": [
            {"area": "Shinjuku", "style": "Luxury", "notes": "Park Hyatt Tokyo — iconic 52nd-floor hotel, New York Bar, exceptional service. Book 3+ months ahead."},
            {"area": "Asakusa", "style": "Boutique", "notes": "Alternatively the Asakusa View Hotel gives direct access to temple walks and a more traditional feel."},
        ],
        "transport_notes": [
            "Get a Suica or Pasmo IC card at Narita airport — works on all Tokyo trains, buses, and convenience store purchases",
            "Narita Express (N'EX) is the fastest airport link — ¥3,070 each way, runs every 30 mins",
            "Tokyo Metro 48hr pass (¥1,500) covers all subway lines — good value if doing 4+ rides per day",
            "Taxis are expensive — use only for late-night returns when trains have stopped (after midnight)",
        ],
        "budget_summary": {
            "estimated_total_aud": 7800,
            "assumptions": [
                "Flights (Jetstar BNE-NRT return) ~AUD 1,400pp = AUD 2,800",
                "Park Hyatt Tokyo 8 nights ~AUD 650/night = AUD 5,200 (already booked)",
                "Daily food/transport budget ~AUD 120/day x 9 days = AUD 1,080",
                "Activities, entrance fees, shopping ~AUD 500",
                "Kaiseki dinner ~AUD 400",
                "Exchange rate assumed: 1 AUD = 100 JPY (check before travel)",
            ],
        },
        "packing_checklist": [
            "Portable Wi-Fi or SIM card (buy at airport — essential for navigation)",
            "Comfortable walking shoes (10,000+ steps daily)",
            "Compact umbrella (June is rainy season)",
            "Modest clothing for shrine visits",
            "Small backpack for day trips",
            "Power adapter (Japan uses Type A, same as AUS but 100V — charge slowly)",
            "Cash — many smaller restaurants and temples are cash-only",
            "Printed hotel address in Japanese (for taxis)",
        ],
        "risks_and_notes": [
            "June is the start of rainy season (tsuyu) — pack for intermittent rain but it rarely ruins a day",
            "Earthquake protocol: follow hotel/station instructions, move away from glass",
            "Tipping is not practiced in Japan — it can cause offence",
            "Many restaurants require reservations — book kaiseki and popular spots at least 4 weeks ahead",
            "Cash is king at markets, temples and smaller restaurants — carry ¥10,000 at all times",
        ],
    }
    rendered_md = f"# Tokyo — 10 Days in Japan\n\nA 9-night itinerary from Brisbane, 1–10 June 2026."

    itin = Itinerary(
        trip_id=trip.id,
        itinerary_json=itinerary_json,
        rendered_md=rendered_md,
        version=1,
    )
    db.add(itin)

    # ── Messages ──────────────────────────────────────────────────────────────
    messages = [
        Message(trip_id=trip.id, sender_type=SenderType.CLIENT.value, body="Hi! Really excited about this trip. One question — is June a good time to visit? I've heard it can be rainy.", is_read=True, created_at=datetime(2026, 3, 15, 9, 12)),
        Message(trip_id=trip.id, sender_type=SenderType.ADMIN.value, body="Great question! June is the start of rainy season (tsuyu) in Tokyo, but it doesn't mean rain all day — you'll typically get a few hours of sunshine. We've factored in indoor highlights like teamLab and the National Museum for those wetter days. Pack a compact umbrella and you'll be fine!", is_read=True, created_at=datetime(2026, 3, 15, 11, 30)),
        Message(trip_id=trip.id, sender_type=SenderType.CLIENT.value, body="Perfect, thank you! We're really looking forward to the kaiseki dinner — is there a particular restaurant you recommend?", is_read=True, created_at=datetime(2026, 3, 16, 14, 5)),
        Message(trip_id=trip.id, sender_type=SenderType.ADMIN.value, body="We love Kojyu in Ginza for first-timers — elegant, English-friendly staff, and the seasonal menu is consistently outstanding. I can make the reservation on your behalf if you'd like? Just confirm the date and I'll sort it.", is_read=False, created_at=datetime(2026, 3, 16, 16, 45)),
    ]
    for m in messages:
        db.add(m)

    db.commit()
    print(f"[seed] Demo trip created for {DEMO_EMAIL} (ref: {DEMO_REF})")
