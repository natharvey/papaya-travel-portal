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


SARAH_EMAIL = "sarah.cumming21@gmail.com"
SARAH_REF   = "SARAH2026"


def seed_sarah_trips(db: Session) -> None:
    """Create three realistic demo trips for Sarah Cumming. Idempotent."""
    if db.query(Client).filter(Client.email == SARAH_EMAIL).first():
        return  # already seeded

    # ── Client ────────────────────────────────────────────────────────────────
    client = Client(
        email=SARAH_EMAIL,
        name="Sarah Cumming",
        reference_code=SARAH_REF,
    )
    db.add(client)
    db.flush()

    # ════════════════════════════════════════════════════════════════════════
    # TRIP 1 — Airlie Beach & The Whitsundays, July 2026
    # ════════════════════════════════════════════════════════════════════════
    trip1 = Trip(
        client_id=client.id,
        title="Airlie Beach & The Whitsundays",
        origin_city="Brisbane",
        start_date=date(2026, 7, 2),
        end_date=date(2026, 7, 5),
        budget_range="3500",
        pace="relaxed",
        status=TripStatus.REVIEW.value,
        admin_notes="Short domestic getaway — Jetstar confirmed. Coral Sea Marina resort booked.",
    )
    db.add(trip1)
    db.flush()

    db.add(IntakeResponse(
        trip_id=trip1.id,
        travellers_count=2,
        interests=["Beaches & Snorkelling", "Sailing", "Wildlife", "Relaxation"],
        accommodation_style="Resort / Boutique Hotel",
        must_dos="Whitehaven Beach, sailing day trip, snorkelling the outer reef",
        must_avoid="Party crowds, budget hostels",
        constraints="Only 3 nights — keep it tight and special",
        notes="First trip away together just the two of us. Want it to feel romantic and a bit indulgent.",
        raw_json={},
    ))

    db.add(Flight(
        trip_id=trip1.id, leg_order=1,
        flight_number="JQ836", airline="Jetstar",
        departure_airport="BNE", arrival_airport="PPP",
        departure_time=datetime(2026, 7, 2, 12, 55),
        arrival_time=datetime(2026, 7, 2, 14, 40),
        terminal_departure="Domestic", terminal_arrival="",
        booking_ref="JQ-WH2607",
    ))
    db.add(Flight(
        trip_id=trip1.id, leg_order=2,
        flight_number="JQ835", airline="Jetstar",
        departure_airport="PPP", arrival_airport="BNE",
        departure_time=datetime(2026, 7, 5, 12, 5),
        arrival_time=datetime(2026, 7, 5, 13, 35),
        terminal_departure="", terminal_arrival="Domestic",
        booking_ref="JQ-WH2607",
    ))

    db.add(Stay(
        trip_id=trip1.id, stay_order=1,
        name="Coral Sea Marina Resort",
        address="Coral Sea Drive, Airlie Beach QLD 4802",
        check_in=datetime(2026, 7, 2, 14, 0),
        check_out=datetime(2026, 7, 5, 10, 0),
        confirmation_number="CSM-SC2607",
        notes="Deluxe marina-view room. Request top-floor corner for best sunset views. Pool and spa included.",
    ))

    db.add(Itinerary(
        trip_id=trip1.id,
        version=1,
        rendered_md="# Airlie Beach & The Whitsundays\n\nA dreamy 3-night escape to Queensland's island paradise.",
        itinerary_json={
            "trip_title": "Airlie Beach & The Whitsundays",
            "overview": "Three nights of island magic — sailing on turquoise waters, the silica sands of Whitehaven Beach, and coral reefs teeming with colour. A perfectly romantic Queensland escape.",
            "destinations": [
                {"name": "Airlie Beach", "nights": 3},
                {"name": "Whitsunday Islands (day)", "nights": 0},
            ],
            "day_plans": [
                {
                    "day_number": 1, "date": "2026-07-02", "location_base": "Airlie Beach",
                    "morning": {"title": "Arrival & Check-in", "details": "Land at Proserpine (PPP) at 2:40pm. Resort shuttle or taxi to Coral Sea Marina Resort (~25 mins, AUD 35). Check in and head straight to the pool.", "booking_needed": False, "est_cost_aud": 35},
                    "afternoon": {"title": "Airlie Beach Lagoon & Town Stroll", "details": "Walk the waterfront boardwalk to the famous Airlie Beach Lagoon — a free salt-water pool overlooking the Coral Sea. Grab a chilled coconut from the beach kiosk.", "booking_needed": False, "est_cost_aud": 10},
                    "evening": {"title": "Sunset dinner at Fish D'vine", "details": "Rum bar and seafood restaurant right on the main strip. Try the Moreton Bay bugs and the 'Rum Punch' cocktail. Outdoor seating, lively atmosphere.", "booking_needed": True, "est_cost_aud": 120},
                    "notes": ["Book Fish D'vine for 6:30pm — popular on Thursday nights", "July is peak season — pack a light layer for evenings"],
                },
                {
                    "day_number": 2, "date": "2026-07-03", "location_base": "Whitsunday Islands — Sailing Day",
                    "morning": {"title": "Whitehaven Beach Sailing Day", "details": "Board your sailing vessel at Coral Sea Marina at 8am. 2-hour sail to Whitehaven — arguably Australia's most beautiful beach. 7km of 98% pure silica sand that stays cool underfoot.", "booking_needed": True, "est_cost_aud": 280},
                    "afternoon": {"title": "Hill Inlet Lookout & Snorkelling", "details": "Walk to Hill Inlet for the iconic swirling sand/water view (worth every step). Afternoon snorkelling stop at one of the fringing coral reef sites — clownfish, parrotfish and sea turtles likely.", "booking_needed": False, "est_cost_aud": 0},
                    "evening": {"title": "Marina sundowner & resort dinner", "details": "Back at the marina by 5:30pm. Sundowner drinks at the marina bar, then dinner at the resort restaurant — catch of the day with a glass of Hunter Valley Semillon.", "booking_needed": False, "est_cost_aud": 140},
                    "notes": ["Apply reef-safe sunscreen only — regular sunscreen damages coral", "Bring an underwater camera or hire one on the boat", "Hill Inlet is best viewed at mid-tide — your skipper will time it"],
                },
                {
                    "day_number": 3, "date": "2026-07-04", "location_base": "Airlie Beach — Leisure Day",
                    "morning": {"title": "Kayaking or SUP on the bay", "details": "Hire a kayak or stand-up paddleboard from the marina (AUD 40/hr). Paddle out to nearby Coral Point for snorkelling in calm, clear water. Great for spotting rays and small sharks.", "booking_needed": False, "est_cost_aud": 80},
                    "afternoon": {"title": "Conway National Park walk", "details": "30-min drive to Conway National Park. The Whitsunday Ngaro Sea Trail lookout gives jaw-dropping panoramic views over the islands. Easy 2km walk.", "booking_needed": False, "est_cost_aud": 0},
                    "evening": {"title": "Farewell dinner at Capers on the Waterfront", "details": "One of the best restaurants in town — modern Australian menu with a focus on local seafood. Try the coral trout or the Queensland mud crab. Book the balcony table for harbour views.", "booking_needed": True, "est_cost_aud": 180},
                    "notes": ["Last night — a slightly indulgent dinner is well deserved", "Pack bags tonight — checkout is 10am tomorrow"],
                },
                {
                    "day_number": 4, "date": "2026-07-05", "location_base": "Departure",
                    "morning": {"title": "Checkout & final coffee", "details": "Checkout by 10am. Grab a final flat white at Denman Cellars Café on the main strip — best coffee in Airlie. Transfer to Proserpine Airport for JQ835 departing 12:05pm.", "booking_needed": False, "est_cost_aud": 15},
                    "afternoon": {"title": "Back in Brisbane by 1:35pm", "details": "Arrive Brisbane Domestic 1:35pm. Short, sweet, and absolutely worth it.", "booking_needed": False, "est_cost_aud": 0},
                    "evening": None,
                    "notes": ["Proserpine Airport is small — arrive 60 mins before departure is plenty"],
                },
            ],
            "transport_notes": [
                "Jetstar JQ836: BNE → PPP, departs 12:55pm, arrives 2:40pm — Thu 2 Jul",
                "Jetstar JQ835: PPP → BNE, departs 12:05pm, arrives 1:35pm — Sun 5 Jul",
                "Taxi from Proserpine Airport to Airlie Beach ~AUD 35, 25 mins",
                "No car hire needed — everything walkable or day-tour based in Airlie",
            ],
            "budget_summary": {
                "estimated_total_aud": 3200,
                "assumptions": [
                    "Flights (Jetstar BNE-PPP return x2) ~AUD 600",
                    "Coral Sea Marina Resort 3 nights ~AUD 350/night = AUD 1,050",
                    "Sailing day trip (Whitehaven) ~AUD 280pp = AUD 560",
                    "Food & drinks ~AUD 500",
                    "Activities & transport ~AUD 250",
                ],
            },
        },
    ))

    msgs1 = [
        Message(trip_id=trip1.id, sender_type=SenderType.ADMIN.value,
                body="Hi Sarah! Your Whitsundays itinerary is ready for review. We've got you on the Whitehaven sailing day on Friday — one of our absolute favourites. Let me know if you'd like any changes!",
                is_read=False, created_at=datetime(2026, 5, 20, 10, 0)),
        Message(trip_id=trip1.id, sender_type=SenderType.CLIENT.value,
                body="This looks amazing! Quick question — is July a good time to go? Weather-wise?",
                is_read=True, created_at=datetime(2026, 5, 20, 18, 30)),
        Message(trip_id=trip1.id, sender_type=SenderType.ADMIN.value,
                body="July is actually peak season for the Whitsundays — it's dry, sunny, and the water temperature is perfect for snorkelling (around 23°C). You've picked one of the best months of the year!",
                is_read=True, created_at=datetime(2026, 5, 21, 9, 15)),
    ]
    for m in msgs1:
        db.add(m)

    # ════════════════════════════════════════════════════════════════════════
    # TRIP 2 — Edinburgh & Aviemore, Christmas & New Year 2026/27
    # ════════════════════════════════════════════════════════════════════════
    trip2 = Trip(
        client_id=client.id,
        title="Edinburgh & Scottish Highlands — Christmas & New Year",
        origin_city="Brisbane",
        start_date=date(2026, 12, 20),
        end_date=date(2027, 1, 5),
        budget_range="12000",
        pace="relaxed",
        status=TripStatus.REVIEW.value,
        admin_notes="Staying with family in Edinburgh. Aviemore lodge booked for New Year. Qatar Airways via Doha.",
    )
    db.add(trip2)
    db.flush()

    db.add(IntakeResponse(
        trip_id=trip2.id,
        travellers_count=2,
        interests=["Culture & History", "Skiing & Snow Sports", "Food & Dining", "Whisky Distilleries", "Hogmanay Celebrations"],
        accommodation_style="Family home (Edinburgh) + Ski Lodge (Aviemore)",
        must_dos="Hogmanay in Edinburgh, skiing at CairnGorm Mountain, whisky distillery tour, Edinburgh Castle",
        must_avoid="Overly touristy experiences, chain restaurants",
        constraints="Family home in Edinburgh (no hotel needed there). Need a lodge in Aviemore for New Year period (28 Dec – 3 Jan).",
        notes="Partner has family in Edinburgh — this is a homecoming trip. First time skiing for me. Want to make New Year in Scotland feel really special.",
        raw_json={},
    ))

    # Outbound: BNE → DOH → EDI
    db.add(Flight(
        trip_id=trip2.id, leg_order=1,
        flight_number="QR908", airline="Qatar Airways",
        departure_airport="BNE", arrival_airport="DOH",
        departure_time=datetime(2026, 12, 20, 20, 30),
        arrival_time=datetime(2026, 12, 21, 5, 45),
        terminal_departure="International", terminal_arrival="D",
        booking_ref="QR-SC2612",
    ))
    db.add(Flight(
        trip_id=trip2.id, leg_order=2,
        flight_number="QR024", airline="Qatar Airways",
        departure_airport="DOH", arrival_airport="EDI",
        departure_time=datetime(2026, 12, 21, 8, 30),
        arrival_time=datetime(2026, 12, 21, 13, 15),
        terminal_departure="D", terminal_arrival="1",
        booking_ref="QR-SC2612",
    ))
    # Return: EDI → DOH → BNE
    db.add(Flight(
        trip_id=trip2.id, leg_order=3,
        flight_number="QR025", airline="Qatar Airways",
        departure_airport="EDI", arrival_airport="DOH",
        departure_time=datetime(2027, 1, 5, 14, 30),
        arrival_time=datetime(2027, 1, 5, 23, 55),
        terminal_departure="1", terminal_arrival="D",
        booking_ref="QR-SC2612",
    ))
    db.add(Flight(
        trip_id=trip2.id, leg_order=4,
        flight_number="QR909", airline="Qatar Airways",
        departure_airport="DOH", arrival_airport="BNE",
        departure_time=datetime(2027, 1, 6, 1, 50),
        arrival_time=datetime(2027, 1, 6, 23, 10),
        terminal_departure="D", terminal_arrival="International",
        booking_ref="QR-SC2612",
    ))

    db.add(Stay(
        trip_id=trip2.id, stay_order=1,
        name="Family Home — Edinburgh",
        address="Edinburgh, Scotland, UK",
        check_in=datetime(2026, 12, 21, 14, 0),
        check_out=datetime(2026, 12, 28, 10, 0),
        confirmation_number=None,
        notes="Staying with Sarah's family. No hotel needed for Edinburgh leg.",
    ))
    db.add(Stay(
        trip_id=trip2.id, stay_order=2,
        name="Macdonald Aviemore Resort — Pine Lodge",
        address="Aviemore, Cairngorms National Park, PH22 1PN, Scotland",
        check_in=datetime(2026, 12, 28, 15, 0),
        check_out=datetime(2027, 1, 3, 11, 0),
        confirmation_number="MAC-AV281226",
        notes="Pine lodge with log fire. Ski hire package included. 10 min drive to CairnGorm Mountain base station.",
    ))
    db.add(Stay(
        trip_id=trip2.id, stay_order=3,
        name="Family Home — Edinburgh",
        address="Edinburgh, Scotland, UK",
        check_in=datetime(2027, 1, 3, 14, 0),
        check_out=datetime(2027, 1, 5, 12, 0),
        confirmation_number=None,
        notes="Final 2 nights back in Edinburgh before the flight home.",
    ))

    db.add(Itinerary(
        trip_id=trip2.id,
        version=1,
        rendered_md="# Edinburgh & Scottish Highlands — Christmas & New Year\n\nA magical 16-night Scottish winter adventure.",
        itinerary_json={
            "trip_title": "Edinburgh & Scottish Highlands — Christmas & New Year",
            "overview": "A magical winter journey home — Christmas in Edinburgh with family, Hogmanay in the Cairngorms, and New Year skiing in one of Europe's most dramatic landscapes. Expect coal fires, single malt whisky, snow-dusted mountains and the warmest Scottish welcome.",
            "destinations": [
                {"name": "Edinburgh", "nights": 9},
                {"name": "Aviemore & Cairngorms", "nights": 6},
            ],
            "day_plans": [
                {
                    "day_number": 1, "date": "2026-12-20", "location_base": "Brisbane — Departure",
                    "morning": {"title": "Pack & head to airport", "details": "QR908 departs Brisbane International at 20:30. Check in 3 hours prior — Qatar Airways Business/Economy check-in at Terminal International.", "booking_needed": False, "est_cost_aud": 0},
                    "afternoon": None,
                    "evening": {"title": "Depart Brisbane", "details": "Board QR908 to Doha. Flight time approx 14 hours. Qatar Airways Doha lounge available on layover.", "booking_needed": False, "est_cost_aud": 0},
                    "notes": ["Qatar Airways luggage allowance — check your fare class for exact kg", "Download offline Google Maps for Edinburgh and Aviemore before you fly"],
                },
                {
                    "day_number": 2, "date": "2026-12-21", "location_base": "Doha → Edinburgh",
                    "morning": {"title": "Doha layover", "details": "Land in Doha (DOH) at 05:45. Layover until QR024 departs 08:30 — approx 2hr45 to explore the Hamad International Airport duty free (one of the world's best airport shopping experiences).", "booking_needed": False, "est_cost_aud": 50},
                    "afternoon": {"title": "Arrive Edinburgh", "details": "Land at Edinburgh Airport at 13:15. Collect bags and take the Airlink 100 bus to city centre (£4.50, 30 mins) or taxi to family home (~£25, 20 mins).", "booking_needed": False, "est_cost_aud": 35},
                    "evening": {"title": "Family reunion & welcome dinner", "details": "First evening with family. Settle in, recover from the flight. A home-cooked Scottish welcome — expect haggis, neeps & tatties or a hearty beef stew.", "booking_needed": False, "est_cost_aud": 0},
                    "notes": ["Body clock tip: try to stay awake until 9pm Edinburgh time", "Edinburgh in December is cold (3–7°C) — pack thermals, a good coat and waterproof boots"],
                },
                {
                    "day_number": 3, "date": "2026-12-22", "location_base": "Edinburgh",
                    "morning": {"title": "Edinburgh Castle", "details": "Visit the iconic castle on the Royal Mile (book online to skip queues — £19.50pp). See the Scottish Crown Jewels, the Stone of Destiny, and stunning city views from the battlements.", "booking_needed": True, "est_cost_aud": 75},
                    "afternoon": {"title": "Royal Mile & Christmas Market", "details": "Walk the Royal Mile from castle to Holyrood Palace. Edinburgh's Christmas Market on Princes Street is one of Europe's finest — mulled wine, handmade crafts, and incredible festive atmosphere.", "booking_needed": False, "est_cost_aud": 40},
                    "evening": {"title": "Dinner at The Witchery by the Castle", "details": "One of Edinburgh's most celebrated restaurants — Gothic decor, candles, impeccable Scottish produce. Try the venison or the hand-dived scallops. Book well in advance.", "booking_needed": True, "est_cost_aud": 250},
                    "notes": ["Book The Witchery at least 6 weeks ahead for December dates", "Edinburgh Castle gets very busy in the afternoons — go at opening (9:30am)"],
                },
                {
                    "day_number": 4, "date": "2026-12-23", "location_base": "Edinburgh",
                    "morning": {"title": "Scottish National Museum", "details": "Free entry. One of the UK's finest museums — Scottish history from the earliest times to present day. The Grand Gallery atrium is breathtaking at Christmas. Allow 3 hours.", "booking_needed": False, "est_cost_aud": 0},
                    "afternoon": {"title": "Leith & The Shore", "details": "Head to Leith (20 min walk or short bus). Edinburgh's former port district is now a thriving food and drink quarter. Visit the Royal Yacht Britannia (£18pp) then walk The Shore for pub lunch.", "booking_needed": False, "est_cost_aud": 80},
                    "evening": {"title": "Burns Supper experience or family dinner", "details": "Join a proper Burns Supper event in a local pub (often held in December) or enjoy a family dinner at home — haggis, whisky, traditional toasts.", "booking_needed": False, "est_cost_aud": 60},
                    "notes": ["The Shore in Leith has excellent seafood restaurants — The Kitchin is world-class if you can get a table"],
                },
                {
                    "day_number": 5, "date": "2026-12-24", "location_base": "Edinburgh — Christmas Eve",
                    "morning": {"title": "Arthur's Seat hike", "details": "An extinct volcano in the heart of the city — the 251m summit gives panoramic views across Edinburgh, the Firth of Forth and the Pentland Hills. 3km return, moderate difficulty.", "booking_needed": False, "est_cost_aud": 0},
                    "afternoon": {"title": "Whisky experience at The Scotch Whisky Experience", "details": "On the Royal Mile next to the castle. Guided tasting of four Scotch regions (Highland, Speyside, Islay, Lowland). Interactive distillery tour and the world's largest whisky collection on display.", "booking_needed": True, "est_cost_aud": 90},
                    "evening": {"title": "Christmas Eve with family", "details": "A relaxed Christmas Eve at home — the classic way. Mulled wine, board games, perhaps Midnight Mass at St Giles' Cathedral (free, beautiful carol service).", "booking_needed": False, "est_cost_aud": 0},
                    "notes": ["St Giles' Midnight Mass fills up — arrive by 11pm"],
                },
                {
                    "day_number": 6, "date": "2026-12-25", "location_base": "Edinburgh — Christmas Day",
                    "morning": {"title": "Christmas morning", "details": "Christmas at the family home. Gifts, morning coffee, and the classic Scottish tradition of a leisurely breakfast together.", "booking_needed": False, "est_cost_aud": 0},
                    "afternoon": {"title": "Christmas lunch & walk", "details": "Traditional Christmas lunch — turkey or Scottish beef roast. A late afternoon walk to work it off — Holyrood Park or the Water of Leith Walkway are both beautiful in winter.", "booking_needed": False, "est_cost_aud": 0},
                    "evening": {"title": "Relaxed family evening", "details": "Christmas films, the Queen's Speech (on BBC), an excellent single malt by the fire.", "booking_needed": False, "est_cost_aud": 0},
                    "notes": ["Almost everything in Edinburgh is closed Christmas Day — plan a self-sufficient day"],
                },
                {
                    "day_number": 7, "date": "2026-12-26", "location_base": "Edinburgh — Boxing Day",
                    "morning": {"title": "Boxing Day walk — Cramond Island", "details": "Drive or bus to Cramond (20 mins from centre). At low tide, walk the causeway to Cramond Island for wild coastal views and WWII fortifications. Check tide times before going.", "booking_needed": False, "est_cost_aud": 0},
                    "afternoon": {"title": "Stockbridge neighbourhood", "details": "Spend the afternoon in Stockbridge — Edinburgh's most charming suburb. Sunday market, independent boutiques, deli-cafes. Try The Stockbridge Restaurant for an early dinner.", "booking_needed": False, "est_cost_aud": 80},
                    "evening": {"title": "Tartan Noir evening", "details": "Ian Rankin's Edinburgh — end the day at Swany's bar in Marchmont (Inspector Rebus's local). A quiet pint and a look at the city through a different lens.", "booking_needed": False, "est_cost_aud": 30},
                    "notes": ["Cramond Island causeway floods — tide times are critical. BBC tide tables are accurate"],
                },
                {
                    "day_number": 8, "date": "2026-12-27", "location_base": "Edinburgh",
                    "morning": {"title": "Rosslyn Chapel", "details": "Made famous by The Da Vinci Code but remarkable in its own right — intricately carved medieval stonework. 30 min drive south of Edinburgh (no public bus on Boxing Day period — hire a car for the day, ~£50).", "booking_needed": True, "est_cost_aud": 30},
                    "afternoon": {"title": "Falkirk Kelpies & The Helix", "details": "On the way back, stop at the Kelpies — two 30-metre horse-head sculptures on the Forth & Clyde canal. Free to see from outside, guided tours available (~£7pp).", "booking_needed": False, "est_cost_aud": 20},
                    "evening": {"title": "Pre-Aviemore prep dinner", "details": "Final Edinburgh dinner — try Dishoom on St Andrew Square for Bombay-style cafe food. A favourite of locals and visitors alike. Book ahead.", "booking_needed": True, "est_cost_aud": 90},
                    "notes": ["Pack ski gear and warm clothes tonight — heading to Aviemore tomorrow", "Hire car for the day from Arnold Clark or Enterprise at Edinburgh Airport"],
                },
                {
                    "day_number": 9, "date": "2026-12-28", "location_base": "Edinburgh → Aviemore",
                    "morning": {"title": "Drive to Aviemore", "details": "Self-drive or hire car from Edinburgh to Aviemore — a stunning 3-hour drive through the Cairngorms. The A9 north of Pitlochry is one of Scotland's most dramatic roads, especially in winter with snow on the peaks.", "booking_needed": False, "est_cost_aud": 80},
                    "afternoon": {"title": "Check in — Macdonald Aviemore Pine Lodge", "details": "Check in at 3pm to your log fire lodge. Settle in, get the fire going. Drive to the CairnGorm Mountain base station (10 mins) to collect your hire ski gear and lift passes for the next 5 days.", "booking_needed": True, "est_cost_aud": 300},
                    "evening": {"title": "Aviemore welcome dinner", "details": "Dinner at The Old Bridge Inn — a classic Aviemore pub with open fire, real ales, and hearty Highland food. Try the venison burger or the Cullen skink (smoked haddock soup).", "booking_needed": False, "est_cost_aud": 70},
                    "notes": ["Pick up ski hire at CairnGorm Mountain — they'll fit boots there too", "Check ski conditions: ski.visitscotland.com"],
                },
                {
                    "day_number": 10, "date": "2026-12-29", "location_base": "Aviemore — Skiing Day 1",
                    "morning": {"title": "First ski run on CairnGorm Mountain", "details": "Scotland's largest ski area. For first-time skiers: book a 2-hour group lesson with Ski Scotland (£35pp). Start on the Ptarmigan runs — wide, gentle blue runs perfect for beginners.", "booking_needed": True, "est_cost_aud": 100},
                    "afternoon": {"title": "More runs & lunch on the mountain", "details": "Lunch at Ptarmigan Restaurant (highest restaurant in the UK at 1100m). Panoramic views across the Cairngorms. Afternoon back on the slopes — try the Day Lodge magic carpet lifts for confidence building.", "booking_needed": False, "est_cost_aud": 50},
                    "evening": {"title": "Après-ski at the lodge", "details": "Hot chocolates by the fire. Try a Speyside dram from the lodge's whisky selection — Glenfarclas or Aberlour work well after a cold day on the mountain.", "booking_needed": False, "est_cost_aud": 30},
                    "notes": ["Scottish skiing conditions vary — always check snow reports the night before", "Ski boots will be sore on day 1 — walk around in them a little before heading up"],
                },
                {
                    "day_number": 11, "date": "2026-12-30", "location_base": "Aviemore — Skiing Day 2",
                    "morning": {"title": "Cairngorms winter walk — Loch Morlich", "details": "Take a morning off skiing and walk the Loch Morlich circuit (5km, 1.5hrs) — a stunning frozen loch surrounded by Caledonian pines and the Cairngorm plateau above. Reindeer sometimes spotted nearby.", "booking_needed": False, "est_cost_aud": 0},
                    "afternoon": {"title": "Back to the slopes", "details": "Afternoon on the mountain. By day 2 you'll be finding your ski legs — try the Coire Cas blue runs for a longer, flowing descent. Ski patrol is always on hand.", "booking_needed": False, "est_cost_aud": 0},
                    "evening": {"title": "Dinner at Mountain Café, Aviemore", "details": "Best café in town — local produce, excellent brunch/dinner menu, great cake. Try the venison stew or the baked salmon. Bring cash as a backup — sometimes card reader is temperamental.", "booking_needed": False, "est_cost_aud": 70},
                    "notes": ["The Cairngorm Reindeer Centre offers guided herd walks — book in advance if interested (£20pp)"],
                },
                {
                    "day_number": 12, "date": "2026-12-31", "location_base": "Aviemore — Hogmanay / New Year's Eve",
                    "morning": {"title": "Morning ski — last runs of 2026", "details": "Get the early lift to catch the mountain in morning light. On clear days, visibility across the Cairngorms is extraordinary — you can see for 40 miles.", "booking_needed": False, "est_cost_aud": 0},
                    "afternoon": {"title": "New Year prep & rest", "details": "Back at the lodge by 2pm. Rest, warm up, get ready for the big night. Scotland takes Hogmanay seriously — it's bigger than Christmas.", "booking_needed": False, "est_cost_aud": 0},
                    "evening": {"title": "Hogmanay at Aviemore — Live Music & Fireworks", "details": "Aviemore's Hogmanay street party is one of the best in the Highlands. Live pipe band, bonfires, fireworks at midnight over the mountains. Wrap up warm — it will be cold, magical and unforgettable.", "booking_needed": False, "est_cost_aud": 50},
                    "notes": ["First footing tradition: be the first to cross a neighbour's threshold after midnight — bring coal, shortbread and whisky as gifts", "Temperatures can drop to -10°C — thermals are essential", "Midnight toast: raise a glass of single malt to 2027"],
                },
                {
                    "day_number": 13, "date": "2027-01-01", "location_base": "Aviemore — New Year's Day",
                    "morning": {"title": "Hogmanay lie-in — slow morning", "details": "New Year's Day. A gentler start — coffee, bacon rolls at the lodge, review the year that was.", "booking_needed": False, "est_cost_aud": 0},
                    "afternoon": {"title": "Whisky distillery tour — Glenfarclas", "details": "One of Scotland's finest family-owned distilleries, 40 mins from Aviemore. The 105 cask strength malt is legendary. Family tour and tasting £20pp. Reserve in advance.", "booking_needed": True, "est_cost_aud": 60},
                    "evening": {"title": "Lodge dinner — cook in", "details": "New Year's evening in the lodge. Cook a simple Highland dinner — venison sausages, roast potatoes, the last of the whisky. A perfect, quiet first evening of 2027.", "booking_needed": False, "est_cost_aud": 40},
                    "notes": ["Glenfarclas is open on 1 January — confirm when booking", "Buy a bottle of Glenfarclas Family Casks as a souvenir — a truly special dram"],
                },
                {
                    "day_number": 14, "date": "2027-01-02", "location_base": "Aviemore — Final ski day",
                    "morning": {"title": "Final day on the mountain", "details": "Last full day of skiing. By now you'll be comfortable on blue runs — try the Cas run (red, intermediate) for a challenge. Return ski hire equipment by 4pm.", "booking_needed": False, "est_cost_aud": 0},
                    "afternoon": {"title": "Carrbridge & Landmark Forest Adventure", "details": "Quick detour to Carrbridge — the oldest stone bridge in the Highlands (1717). Walk the village and the famous Landmark Forest Adventure Park nearby.", "booking_needed": False, "est_cost_aud": 20},
                    "evening": {"title": "Aviemore farewell dinner", "details": "Back to The Old Bridge Inn for a farewell pint and Highland steak. Raise a glass to the mountains.", "booking_needed": False, "est_cost_aud": 70},
                    "notes": ["Return ski hire at base station, not the car — they'll confirm pickup point"],
                },
                {
                    "day_number": 15, "date": "2027-01-03", "location_base": "Aviemore → Edinburgh",
                    "morning": {"title": "Check out & drive back to Edinburgh", "details": "Check out by 11am. 3-hour scenic drive back to Edinburgh on the A9. Stop at Pitlochry — a charming Highland town with a salmon ladder and excellent woollen goods shops.", "booking_needed": False, "est_cost_aud": 30},
                    "afternoon": {"title": "Back in Edinburgh — Princes Street", "details": "Arrive Edinburgh by 3pm. Afternoon on Princes Street for last-minute shopping. Jenners (now a hotel but still iconic), and the independent shops of Grassmarket.", "booking_needed": False, "est_cost_aud": 80},
                    "evening": {"title": "Final family dinner", "details": "Last evening with family. A meaningful, unhurried dinner at home or at a local favourite. Toast the whole trip.", "booking_needed": False, "est_cost_aud": 0},
                    "notes": ["Pack everything tonight — flight is mid-afternoon tomorrow"],
                },
                {
                    "day_number": 16, "date": "2027-01-04", "location_base": "Edinburgh",
                    "morning": {"title": "Farewell morning", "details": "Final morning in Edinburgh. Walk to your favourite café for a last flat white and a croissant. Buy a box of Tunnock's Tea Cakes for the flight.", "booking_needed": False, "est_cost_aud": 15},
                    "afternoon": {"title": "Airport & departure", "details": "QR025 departs Edinburgh at 14:30. Check in at Edinburgh Airport 3 hours prior (11:30am). Airlink 100 bus from city centre or taxi.", "booking_needed": False, "est_cost_aud": 35},
                    "evening": {"title": "Doha layover → Brisbane", "details": "Arrive Doha 23:55. Connect to QR909 departing 01:50. Arrive Brisbane 23:10 on 6 January.", "booking_needed": False, "est_cost_aud": 0},
                    "notes": ["Edinburgh Airport security can be slow in school holiday periods — allow extra time", "Qatar Airways lounge access available in Doha if included in your fare"],
                },
            ],
            "transport_notes": [
                "Qatar Airways QR908: BNE → DOH — departs 20:30 on 20 Dec",
                "Qatar Airways QR024: DOH → EDI — departs 08:30 on 21 Dec, arrives 13:15",
                "Qatar Airways QR025: EDI → DOH — departs 14:30 on 5 Jan",
                "Qatar Airways QR909: DOH → BNE — departs 01:50 on 6 Jan, arrives 23:10",
                "Edinburgh: excellent public transport. Airlink 100 bus (£4.50) connects airport to city in 30 mins",
                "Aviemore: hire car recommended for the Highlands leg (~£50/day from Edinburgh Airport)",
            ],
            "budget_summary": {
                "estimated_total_aud": 11500,
                "assumptions": [
                    "Qatar Airways return flights BNE-EDI x2 ~AUD 4,500",
                    "Macdonald Aviemore Pine Lodge 6 nights ~AUD 400/night = AUD 2,400",
                    "Edinburgh accommodation: family home (nil cost)",
                    "Ski hire & lift passes 5 days x2 ~AUD 800",
                    "Food & dining across 16 nights ~AUD 1,800",
                    "Activities (castle, whisky, distilleries) ~AUD 600",
                    "Car hire & transport ~AUD 400",
                ],
            },
        },
    ))

    msgs2 = [
        Message(trip_id=trip2.id, sender_type=SenderType.ADMIN.value,
                body="Hi Sarah! Your Scotland Christmas itinerary is ready — 16 incredible days from Edinburgh to the Cairngorms. We've included a full Hogmanay experience in Aviemore and the Glenfarclas distillery for New Year's Day. Take a look and let me know your thoughts!",
                is_read=False, created_at=datetime(2026, 9, 15, 9, 0)),
        Message(trip_id=trip2.id, sender_type=SenderType.CLIENT.value,
                body="Nat is a first-time skier — is CairnGorm the right mountain for beginners?",
                is_read=True, created_at=datetime(2026, 9, 15, 19, 45)),
        Message(trip_id=trip2.id, sender_type=SenderType.ADMIN.value,
                body="Absolutely! CairnGorm has a dedicated beginner area with magic carpet lifts and gentle blue runs. We've booked in a group lesson for day 1 which is the perfect way to start. By day 3 you'll both be gliding down confidently — it's incredibly rewarding!",
                is_read=True, created_at=datetime(2026, 9, 16, 8, 30)),
    ]
    for m in msgs2:
        db.add(m)

    # ════════════════════════════════════════════════════════════════════════
    # TRIP 3 — Japan Ski Trip, February 2027
    # ════════════════════════════════════════════════════════════════════════
    trip3 = Trip(
        client_id=client.id,
        title="Japan Ski & Tokyo — 14 Days",
        origin_city="Brisbane",
        start_date=date(2027, 2, 5),
        end_date=date(2027, 2, 19),
        budget_range="14000",
        pace="moderate",
        status=TripStatus.REVIEW.value,
        admin_notes="Via Incheon (ICN) on Korean Air. Niseko skiing + Tokyo city time. JR Pass recommended.",
    )
    db.add(trip3)
    db.flush()

    db.add(IntakeResponse(
        trip_id=trip3.id,
        travellers_count=2,
        interests=["Skiing & Snow Sports", "Onsen", "Japanese Culture", "Food & Dining", "City Exploration"],
        accommodation_style="Ski chalet (Niseko) + Boutique Hotel (Tokyo)",
        must_dos="Skiing at Niseko Grand Hirafu, outdoor onsen in the snow, ramen in Sapporo, Shibuya and Harajuku in Tokyo",
        must_avoid="Overly busy group tours, generic tourist traps",
        constraints="Two weeks total. Mix of ski resort time and city exploration.",
        notes="We've both been to Tokyo before (Nat's demo trip). Want more Japan skiing this time. Happy to be adventurous with food.",
        raw_json={},
    ))

    # BNE → ICN → CTS (New Chitose — Hokkaido)
    db.add(Flight(
        trip_id=trip3.id, leg_order=1,
        flight_number="KE123", airline="Korean Air",
        departure_airport="BNE", arrival_airport="ICN",
        departure_time=datetime(2027, 2, 5, 8, 30),
        arrival_time=datetime(2027, 2, 5, 17, 45),
        terminal_departure="International", terminal_arrival="2",
        booking_ref="KE-SC0227",
    ))
    db.add(Flight(
        trip_id=trip3.id, leg_order=2,
        flight_number="KE5761", airline="Korean Air",
        departure_airport="ICN", arrival_airport="CTS",
        departure_time=datetime(2027, 2, 5, 20, 30),
        arrival_time=datetime(2027, 2, 5, 22, 15),
        terminal_departure="2", terminal_arrival="",
        booking_ref="KE-SC0227",
    ))
    # CTS → HND (Haneda — Tokyo)
    db.add(Flight(
        trip_id=trip3.id, leg_order=3,
        flight_number="NH776", airline="ANA",
        departure_airport="CTS", arrival_airport="HND",
        departure_time=datetime(2027, 2, 14, 11, 30),
        arrival_time=datetime(2027, 2, 14, 13, 20),
        terminal_departure="", terminal_arrival="3",
        booking_ref="ANA-SC0227",
    ))
    # HND → ICN → BNE
    db.add(Flight(
        trip_id=trip3.id, leg_order=4,
        flight_number="KE2105", airline="Korean Air",
        departure_airport="HND", arrival_airport="ICN",
        departure_time=datetime(2027, 2, 19, 9, 15),
        arrival_time=datetime(2027, 2, 19, 12, 0),
        terminal_departure="3", terminal_arrival="2",
        booking_ref="KE-SC0227",
    ))
    db.add(Flight(
        trip_id=trip3.id, leg_order=5,
        flight_number="KE124", airline="Korean Air",
        departure_airport="ICN", arrival_airport="BNE",
        departure_time=datetime(2027, 2, 19, 14, 30),
        arrival_time=datetime(2027, 2, 20, 2, 45),
        terminal_departure="2", terminal_arrival="International",
        booking_ref="KE-SC0227",
    ))

    db.add(Stay(
        trip_id=trip3.id, stay_order=1,
        name="Niseko Northern Resort An'nupuri",
        address="Niseko Higashiyama, Abuta-gun, Hokkaido 048-1511, Japan",
        check_in=datetime(2027, 2, 5, 22, 0),
        check_out=datetime(2027, 2, 10, 10, 0),
        confirmation_number="NNR-SC0227",
        notes="Traditional ryokan-style ski resort. Outdoor onsen with mountain views. Ski-in/ski-out access to An'nupuri resort.",
    ))
    db.add(Stay(
        trip_id=trip3.id, stay_order=2,
        name="AYA Niseko",
        address="204 Aza-Yamada, Kutchan, Abuta-gun, Hokkaido 044-0081, Japan",
        check_in=datetime(2027, 2, 10, 14, 0),
        check_out=datetime(2027, 2, 13, 10, 0),
        confirmation_number="AYA-SC0227",
        notes="Boutique ski hotel in the heart of Hirafu village. Slope-side, excellent restaurant. Walking distance to Grand Hirafu lifts.",
    ))
    db.add(Stay(
        trip_id=trip3.id, stay_order=3,
        name="Andaz Tokyo Toranomon Hills",
        address="1-23-4 Toranomon, Minato-ku, Tokyo 105-0001, Japan",
        check_in=datetime(2027, 2, 14, 16, 0),
        check_out=datetime(2027, 2, 19, 11, 0),
        confirmation_number="ANDAZ-SC0227",
        notes="Contemporary luxury hotel, 51st floor. Rooftop bar with Mt Fuji views on clear days. Centrally located for Shibuya, Ginza and Roppongi.",
    ))

    db.add(Itinerary(
        trip_id=trip3.id,
        version=1,
        rendered_md="# Japan Ski & Tokyo — 14 Days\n\nNiseko powder and Tokyo neon — Japan's ultimate winter adventure.",
        itinerary_json={
            "trip_title": "Japan Ski & Tokyo — 14 Days",
            "overview": "Japan in February is extraordinary — Hokkaido's legendary powder snow at Niseko, outdoor onsens steaming in the cold air, Sapporo ramen, and then the electric energy of Tokyo in winter. This is Japan at its most vivid.",
            "destinations": [
                {"name": "Niseko, Hokkaido", "nights": 8},
                {"name": "Sapporo (day trip)", "nights": 0},
                {"name": "Tokyo", "nights": 5},
            ],
            "day_plans": [
                {
                    "day_number": 1, "date": "2027-02-05", "location_base": "Brisbane → Incheon → Niseko",
                    "morning": {"title": "Depart Brisbane", "details": "KE123 departs Brisbane International at 08:30. Check in 3 hours prior. Korean Air business lounge access if applicable.", "booking_needed": False, "est_cost_aud": 0},
                    "afternoon": {"title": "Incheon layover", "details": "Arrive Incheon (ICN) 17:45. Transfer to domestic terminal for KE5761 to New Chitose (CTS) departing 20:30. Incheon has an excellent transit hotel and spa if you need a shower.", "booking_needed": False, "est_cost_aud": 0},
                    "evening": {"title": "Arrive Hokkaido", "details": "Arrive New Chitose (CTS) 22:15. Pre-arranged resort shuttle to Niseko An'nupuri (~1.5hrs). Check in, warm up, first glimpse of the snow-covered mountains.", "booking_needed": True, "est_cost_aud": 60},
                    "notes": ["Book Niseko resort shuttle in advance — essential for late arrivals", "New Chitose to Niseko can be -15°C at night — have a warm layer accessible in hand luggage"],
                },
                {
                    "day_number": 2, "date": "2027-02-06", "location_base": "Niseko — Ski Day 1",
                    "morning": {"title": "First morning on Hokkaido powder", "details": "Niseko is famous for Japan's finest powder snow — an average of 15 metres falls annually. Take the An'nupuri gondola from the hotel. For intermediates, head to Hirafu's King runs. For beginners, An'nupuri's gentle slopes are ideal.", "booking_needed": False, "est_cost_aud": 0},
                    "afternoon": {"title": "Grand Hirafu exploration", "details": "The Niseko United pass covers all four resorts. Transfer across to Grand Hirafu — Niseko's largest and liveliest resort. Try the Peak run from the top of the Hirafu gondola (1,308m) on a clear day.", "booking_needed": False, "est_cost_aud": 0},
                    "evening": {"title": "Onsen under the stars", "details": "Return to An'nupuri by 4pm. Soak in the outdoor onsen — rotemburo — surrounded by falling snow. Temperature contrast is extraordinary. Towels and yukata provided by the resort.", "booking_needed": False, "est_cost_aud": 0},
                    "notes": ["Niseko United 5-day pass ~¥50,000 (AUD ~$500) — excellent value covering all four resorts", "Powder days happen fast — check Snow-Forecast.com every morning"],
                },
                {
                    "day_number": 3, "date": "2027-02-07", "location_base": "Niseko — Powder Day",
                    "morning": {"title": "Fresh tracks — first lift up", "details": "If snowfall overnight, be on the first gondola (8am). Fresh powder tracks in Niseko's trees (glades skiing) is a once-in-a-lifetime experience. Hirafu's West Mountain glades are world-famous.", "booking_needed": False, "est_cost_aud": 0},
                    "afternoon": {"title": "Ski lesson or freeride", "details": "Book a half-day lesson with Niseko Adventure Centre (excellent English-speaking instructors) or free-ride the open terrain on Annupuri. Lunch at Onsen Dining at the An'nupuri summit.", "booking_needed": True, "est_cost_aud": 150},
                    "evening": {"title": "Ramen dinner in Hirafu village", "details": "Walk down to Hirafu village (10 mins from slopes). Niseko Ramen Kazahana — rich Hokkaido miso ramen, the best warming post-ski meal imaginable. Often queues — arrive at 6pm.", "booking_needed": False, "est_cost_aud": 30},
                    "notes": ["The best powder is found in the trees on Hirafu and An'nupuri — ask a local or instructor for the current conditions report"],
                },
                {
                    "day_number": 4, "date": "2027-02-08", "location_base": "Niseko — Rest Day & Sapporo",
                    "morning": {"title": "Day trip to Sapporo", "details": "Catch the resort shuttle or JR train from Kutchan to Sapporo (~1.5hrs). Visit the famous Sapporo Beer Museum (free entry, tastings from ¥200). Walk the Odori Park snow sculptures — remnants of the Sapporo Snow Festival.", "booking_needed": False, "est_cost_aud": 40},
                    "afternoon": {"title": "Sapporo Ramen Alley & Tanuki Koji", "details": "Lunch at Sapporo Ramen Alley — a narrow lane of eight ramen shops, each with a different specialty. Hokkaido butter corn miso ramen is unmissable. Explore Tanuki Koji covered shopping arcade for retro goods and local snacks.", "booking_needed": False, "est_cost_aud": 30},
                    "evening": {"title": "Genghis Khan BBQ dinner", "details": "Sapporo's most famous dish — Jingisukan (Genghis Khan) — is lamb cooked on a dome-shaped grill. Try Daruma, the original since 1954. Back on the train to Niseko by 9pm.", "booking_needed": True, "est_cost_aud": 70},
                    "notes": ["JR train Kutchan → Sapporo 1hr20 — buy tickets at Kutchan station", "Daruma restaurant often has queues — arrive early (5:30pm opening)"],
                },
                {
                    "day_number": 5, "date": "2027-02-09", "location_base": "Niseko — Ski Day 3",
                    "morning": {"title": "Backcountry intro tour (optional)", "details": "For the adventurous: a guided backcountry tour from Niseko Adventure Centre into the terrain beyond the resort boundary. Avalanche safety gear provided. Powder turns in pristine untouched snow — extraordinary.", "booking_needed": True, "est_cost_aud": 350},
                    "afternoon": {"title": "Ski the full Niseko United circuit", "details": "Ski or snowboard across all four resorts in one afternoon: An'nupuri → Niseko Village → Grand Hirafu → Hanazono. The traverse is signposted and achievable in a half-day for intermediates.", "booking_needed": False, "est_cost_aud": 0},
                    "evening": {"title": "Izakaya night in Hirafu", "details": "Hirafu village has a lively après-ski scene. Try Bang Bang izakaya for grilled skewers, sake and cold Sapporo. A social, buzzy atmosphere mixing locals and international skiers.", "booking_needed": False, "est_cost_aud": 60},
                    "notes": ["The backcountry tour requires reasonable intermediate skiing ability — confirm with guide beforehand"],
                },
                {
                    "day_number": 6, "date": "2027-02-10", "location_base": "Move to AYA Niseko, Hirafu",
                    "morning": {"title": "Check out An'nupuri, check in AYA Niseko", "details": "Check out of An'nupuri Resort by 10am. Short transfer to AYA Niseko in Hirafu village — ski-in/ski-out boutique hotel. Check in at 2pm.", "booking_needed": False, "est_cost_aud": 0},
                    "afternoon": {"title": "Afternoon ski — Hirafu home runs", "details": "AYA is slope-side on Hirafu — walk out and ski from the front door. Spend the afternoon exploring the runs closest to the village for easy access.", "booking_needed": False, "est_cost_aud": 0},
                    "evening": {"title": "AYA Restaurant dinner", "details": "AYA's in-house restaurant is excellent — modern Japanese-Western fusion with Hokkaido produce. Try the snow crab or the Wagyu beef. A step up from the village izakayas.", "booking_needed": True, "est_cost_aud": 180},
                    "notes": ["AYA's ski storage is heated — leave boots in the rack overnight so they're warm for morning"],
                },
                {
                    "day_number": 7, "date": "2027-02-11", "location_base": "Niseko — Ski Day 5",
                    "morning": {"title": "Hanazono Resort & powder glades", "details": "Take the Hanazono shuttle (free from Hirafu) to explore Niseko's quietest resort. Hanazono has the deepest, most sheltered powder runs and far fewer skiers.", "booking_needed": False, "est_cost_aud": 0},
                    "afternoon": {"title": "Night skiing at Grand Hirafu", "details": "Grand Hirafu offers some of Japan's best night skiing — illuminated runs open until 8:30pm. Skiing under the stars with the valley lit up below is magical.", "booking_needed": False, "est_cost_aud": 0},
                    "evening": {"title": "Niseko's famous après-ski", "details": "Niseko has an unexpectedly international après scene. Try Wild Bill's in Hirafu for live music and cocktails, then Gyu+ for Japanese BBQ (Wagyu beef grilled tableside).", "booking_needed": False, "est_cost_aud": 90},
                    "notes": ["Night skiing lift pass is ~¥2,500 extra — worth it for the experience"],
                },
                {
                    "day_number": 8, "date": "2027-02-12", "location_base": "Niseko — Final ski day",
                    "morning": {"title": "Last powder morning", "details": "Final morning on the mountain. Get the first lift up and make the most of the Niseko powder one last time. Take photos from the peak — Mt Yotei (the Fuji of Hokkaido) visible on clear days.", "booking_needed": False, "est_cost_aud": 0},
                    "afternoon": {"title": "Ski equipment return & pack", "details": "Return hire equipment at the resort ski shop by 3pm. Pack bags for Tokyo tomorrow. Afternoon soak in the onsen — a farewell to Hokkaido.", "booking_needed": False, "est_cost_aud": 0},
                    "evening": {"title": "Farewell Niseko dinner", "details": "Best meal in Niseko — book a table at Kamimura restaurant in Hirafu. French-Japanese fusion, 8-course degustation, wine pairing. One of the finest restaurants in all of Japan.", "booking_needed": True, "est_cost_aud": 400},
                    "notes": ["Kamimura is booked months in advance — confirm reservation before departure from Australia"],
                },
                {
                    "day_number": 9, "date": "2027-02-13", "location_base": "Niseko → Sapporo day",
                    "morning": {"title": "Check out & Sapporo stop", "details": "Check out AYA Niseko by 10am. Bus to Kutchan then train to Sapporo. Visit the beautiful Hokkaido Shrine if time allows. Walk the snow-covered Maruyama Park.", "booking_needed": False, "est_cost_aud": 20},
                    "afternoon": {"title": "Sapporo — Susukino food market", "details": "Susukino is Sapporo's entertainment district — excellent for fresh Hokkaido seafood. Try the crab market for king crab and sea urchin (uni) at astonishing freshness. Lunch at one of the stalls.", "booking_needed": False, "est_cost_aud": 80},
                    "evening": {"title": "New Chitose Airport & overnight flight", "details": "Transfer to New Chitose Airport (CTS). ANA NH776 departs 11:30am on Feb 14 — one-night hotel near airport or early check-in lounge rest.", "booking_needed": False, "est_cost_aud": 0},
                    "notes": ["CTS Airport has excellent Hokkaido shopping — buy white chocolate, fresh dairy sweets and sea urchin crackers as gifts"],
                },
                {
                    "day_number": 10, "date": "2027-02-14", "location_base": "Sapporo → Tokyo — Valentine's Day",
                    "morning": {"title": "Fly to Tokyo — Valentine's Day arrival", "details": "ANA NH776 departs New Chitose (CTS) at 11:30am, arrives Tokyo Haneda (HND) 13:20. Take the Keikyu Line from HND to Toranomon (40 mins, ¥610). Check in to Andaz Tokyo Toranomon Hills.", "booking_needed": False, "est_cost_aud": 10},
                    "afternoon": {"title": "Andaz check-in & rooftop", "details": "Andaz Tokyo is on floors 47–52 of Toranomon Hills tower. Stunning city views from the lobby bar. Settle in and take in the Tokyo skyline.", "booking_needed": False, "est_cost_aud": 0},
                    "evening": {"title": "Valentine's dinner — Sushi Saito", "details": "A bucket-list reservation — Sushi Saito is consistently ranked in the world's top sushi restaurants. Chef Saito is a master of Edomae sushi. Omakase only (~¥30,000–¥50,000pp). Book months in advance.", "booking_needed": True, "est_cost_aud": 700},
                    "notes": ["Sushi Saito requires a Japanese-speaking intermediary to book — your Papaya travel consultant will handle this reservation", "Dress code: smart casual — no strong perfume (interferes with the fish)"],
                },
                {
                    "day_number": 11, "date": "2027-02-15", "location_base": "Tokyo — Shibuya & Harajuku",
                    "morning": {"title": "Meiji Shrine & Yoyogi Park", "details": "Start at the serene Meiji Jingu shrine (free). The forested walk in winter is beautifully still. Check if any traditional ceremonies are happening — weddings are common on weekends.", "booking_needed": False, "est_cost_aud": 0},
                    "afternoon": {"title": "Harajuku & Omotesando", "details": "Harajuku's Takeshita Street — always entertaining. Then the upscale boulevard of Omotesando for architecture (Tadao Ando's Omotesando Hills) and people-watching.", "booking_needed": False, "est_cost_aud": 60},
                    "evening": {"title": "Shibuya crossing & dinner", "details": "Hit the famous scramble at peak hour (6-7pm). Dinner at Fuunji ramen in Shinjuku — tsukemen (dipping ramen) style, rich and intensely flavoured. One of Tokyo's cult ramen spots.", "booking_needed": False, "est_cost_aud": 50},
                    "notes": ["Takeshita Street is chaotic on weekends — go mid-morning for the best experience"],
                },
                {
                    "day_number": 12, "date": "2027-02-16", "location_base": "Tokyo — Tsukiji & Shinjuku",
                    "morning": {"title": "Tsukiji outer market breakfast", "details": "The classic Tokyo morning. Arrive before 8am. Fresh tuna on rice, scallop skewers, tamagoyaki (Japanese omelette). Tamago Yaki Yamamoto is the best stall for egg custard.", "booking_needed": False, "est_cost_aud": 40},
                    "afternoon": {"title": "Ginza & teamLab Planets", "details": "Walk Ginza, then head to teamLab Planets in Toyosu — the immersive digital art experience. Book ahead (¥3,200pp). Smaller and more intense than teamLab Borderless.", "booking_needed": True, "est_cost_aud": 70},
                    "evening": {"title": "Golden Gai bar crawl", "details": "Shinjuku's famous network of tiny bars. Pick one with a theme you like — there's a whisky bar, a jazz bar, a film bar, even a David Bowie bar. One drink per bar, then move on.", "booking_needed": False, "est_cost_aud": 60},
                    "notes": ["teamLab Planets is barefoot — leave shoes at the entrance lockers", "Golden Gai bars start filling up by 9pm — arrive earlier for a seat"],
                },
                {
                    "day_number": 13, "date": "2027-02-17", "location_base": "Tokyo — Day Trip to Nikko",
                    "morning": {"title": "Tobu Limited Express to Nikko", "details": "Catch the Tobu Spacia limited express from Asakusa (¥1,360, 2hrs). Nikko in winter is magical — snow-dusted shrines and frozen waterfalls. Fewer tourists than spring/autumn.", "booking_needed": False, "est_cost_aud": 30},
                    "afternoon": {"title": "Tosho-gu & Kegon Falls frozen", "details": "Tosho-gu shrine complex (¥1,300) — the gilded mausoleum of Tokugawa Ieyasu. Then Kegon Falls, which can be partially frozen in February — extraordinary sight from the viewing platform.", "booking_needed": False, "est_cost_aud": 25},
                    "evening": {"title": "Return to Tokyo — Asakusa dinner", "details": "Back in Tokyo by 6:30pm. Dinner in Asakusa at Komagata Dozeu — a traditional eel and loach restaurant operating since 1801. Japan's oldest continuously operating restaurant.", "booking_needed": True, "est_cost_aud": 80},
                    "notes": ["February Nikko is cold (-5°C) but stunning — dress in full ski layers", "Kegon Falls lift to lower viewing platform: ¥570pp"],
                },
                {
                    "day_number": 14, "date": "2027-02-18", "location_base": "Tokyo — Final full day",
                    "morning": {"title": "Shinjuku Gyoen in winter", "details": "Shinjuku Gyoen in winter is quiet and beautiful. Camellias and plum blossoms start appearing in February. ¥500 entry.", "booking_needed": False, "est_cost_aud": 8},
                    "afternoon": {"title": "Akihabara & last Tokyo shopping", "details": "Electronics, anime, retro games in Akihabara. Don Quijote for last-minute cosmetics and snacks. Isetan Shinjuku for high-end Japanese gifts.", "booking_needed": False, "est_cost_aud": 150},
                    "evening": {"title": "Farewell omakase — Andaz Rooftop", "details": "Farewell dinner at the Andaz Tokyo rooftop bar — cocktails and small plates with a 52nd-floor panorama of the city. One last look at the Tokyo skyline before tomorrow's flight.", "booking_needed": True, "est_cost_aud": 180},
                    "notes": ["Pack bags tonight — Andaz checkout is 11am, flight departs 09:15", "Japan Post at Haneda Airport is excellent for shipping excess shopping home"],
                },
                {
                    "day_number": 15, "date": "2027-02-19", "location_base": "Tokyo — Departure",
                    "morning": {"title": "Checkout & Haneda Airport", "details": "Checkout by 7am. Keikyu Line from Toranomon to Haneda Airport (HND) — 40 mins. KE2105 to Incheon departs 09:15 — check in by 07:15.", "booking_needed": False, "est_cost_aud": 10},
                    "afternoon": {"title": "Incheon → Brisbane", "details": "KE124 departs Incheon 14:30. Arrive Brisbane on 20 February at 02:45. Long flight — Korean Air has excellent in-flight dining and entertainment.", "booking_needed": False, "est_cost_aud": 0},
                    "evening": None,
                    "notes": ["Allow 90 mins minimum at Haneda for international check-in and immigration", "Korean Air duty free on board — excellent whisky and cosmetics selection"],
                },
            ],
            "transport_notes": [
                "Korean Air KE123: BNE → ICN, departs 08:30 on 5 Feb",
                "Korean Air KE5761: ICN → CTS, departs 20:30 on 5 Feb, arrives 22:15",
                "ANA NH776: CTS → HND, departs 11:30 on 14 Feb, arrives 13:20",
                "Korean Air KE2105: HND → ICN, departs 09:15 on 19 Feb",
                "Korean Air KE124: ICN → BNE, departs 14:30 on 19 Feb, arrives 02:45 on 20 Feb",
                "JR Pass (14-day) recommended for Tokyo day trips — purchase before leaving Australia",
                "Niseko resort shuttle: book via hotel or Niseko Adventure Centre",
                "IC card (Suica) essential for Tokyo — get one at Haneda Airport",
            ],
            "budget_summary": {
                "estimated_total_aud": 13500,
                "assumptions": [
                    "Korean Air/ANA flights BNE-CTS-HND-BNE x2 ~AUD 5,000",
                    "Niseko An'nupuri 5 nights ~AUD 400/night = AUD 2,000",
                    "AYA Niseko 3 nights ~AUD 500/night = AUD 1,500",
                    "Andaz Tokyo 5 nights ~AUD 550/night = AUD 2,750",
                    "Niseko United ski pass 7 days x2 ~AUD 1,000",
                    "Food & dining across 14 nights ~AUD 2,500 (inc. Sushi Saito & Kamimura)",
                    "Activities, transport, shopping ~AUD 1,500",
                ],
            },
        },
    ))

    msgs3 = [
        Message(trip_id=trip3.id, sender_type=SenderType.ADMIN.value,
                body="Sarah, your Japan ski & Tokyo itinerary is ready! 8 nights in Niseko for legendary Hokkaido powder, then 5 nights in Tokyo at the Andaz. We've managed to pencil in a Sushi Saito reservation for Valentine's Day — one of the hardest restaurants in the world to get into. Review when you're ready!",
                is_read=False, created_at=datetime(2026, 10, 5, 10, 0)),
        Message(trip_id=trip3.id, sender_type=SenderType.CLIENT.value,
                body="Sushi Saito for Valentine's Day?! That's incredible. How on earth did you manage that?",
                is_read=True, created_at=datetime(2026, 10, 5, 20, 15)),
        Message(trip_id=trip3.id, sender_type=SenderType.ADMIN.value,
                body="We have a trusted local contact in Tokyo who handles these reservations — it takes a Japanese-speaking intermediary. We put in the request the moment you confirmed Japan as the destination! Still pending final confirmation but looking very good.",
                is_read=True, created_at=datetime(2026, 10, 6, 8, 45)),
        Message(trip_id=trip3.id, sender_type=SenderType.CLIENT.value,
                body="Amazing. One more question — should we get travel insurance? And do you recommend the JR Pass?",
                is_read=True, created_at=datetime(2026, 10, 6, 19, 30)),
        Message(trip_id=trip3.id, sender_type=SenderType.ADMIN.value,
                body="Absolutely yes to travel insurance — we recommend Cover-More or NIB for Japan, make sure it covers skiing/snow sports specifically. For the JR Pass: yes, the 14-day pass (~AUD $650pp) is worth it — it'll cover your Tokyo day trips to Nikko and the Asakusa lines. Buy it before you leave Australia as it's cheaper.",
                is_read=False, created_at=datetime(2026, 10, 7, 9, 0)),
    ]
    for m in msgs3:
        db.add(m)

    db.commit()
    print(f"[seed] Sarah Cumming demo trips created for {SARAH_EMAIL} (ref: {SARAH_REF})")
