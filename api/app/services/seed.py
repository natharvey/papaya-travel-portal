import os
import json
import glob
from sqlalchemy.orm import Session

from app.models import DestinationCard

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
