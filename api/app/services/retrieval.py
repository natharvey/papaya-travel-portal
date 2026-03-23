from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import text, or_, func

from app.models import DestinationCard


def retrieve_destination_cards(
    db: Session,
    destinations: list[str],
    interests: list[str],
    limit: int = 5,
) -> list[DestinationCard]:
    """
    Retrieve relevant destination cards using a combination of:
    1. Destination name matching (case-insensitive)
    2. Tag matching against interests
    3. Full-text search on raw_text (Postgres only; falls back on SQLite)
    Returns up to `limit` unique DestinationCard objects.
    """
    results: list[DestinationCard] = []
    seen_ids: set = set()

    def add_cards(cards):
        for card in cards:
            if card.id not in seen_ids:
                seen_ids.add(card.id)
                results.append(card)

    # 1. Direct destination name matching
    if destinations:
        for dest in destinations:
            if not dest:
                continue
            matches = (
                db.query(DestinationCard)
                .filter(
                    func.lower(DestinationCard.destination).contains(func.lower(dest))
                    | func.lower(DestinationCard.raw_text).contains(func.lower(dest))
                )
                .limit(limit)
                .all()
            )
            add_cards(matches)
            if len(results) >= limit:
                return results[:limit]

    # 2. Interest/tag matching
    if interests and len(results) < limit:
        for interest in interests:
            if not interest:
                continue
            matches = (
                db.query(DestinationCard)
                .filter(
                    func.lower(DestinationCard.raw_text).contains(func.lower(interest))
                )
                .limit(limit)
                .all()
            )
            add_cards(matches)
            if len(results) >= limit:
                return results[:limit]

    # 3. Postgres full-text search fallback
    if len(results) < limit:
        try:
            all_terms = " ".join(filter(None, destinations + interests))
            if all_terms:
                fts_results = db.execute(
                    text(
                        "SELECT id FROM destination_cards "
                        "WHERE to_tsvector('english', raw_text) @@ plainto_tsquery('english', :query) "
                        "LIMIT :limit"
                    ),
                    {"query": all_terms, "limit": limit},
                ).fetchall()
                ids = [r[0] for r in fts_results]
                if ids:
                    cards = db.query(DestinationCard).filter(DestinationCard.id.in_(ids)).all()
                    add_cards(cards)
        except Exception:
            # SQLite or other DB doesn't support FTS this way — already covered above
            pass

    # 4. If still not enough, return most recently added cards as fallback
    if len(results) < limit:
        fallback = (
            db.query(DestinationCard)
            .filter(DestinationCard.id.notin_(seen_ids))
            .limit(limit - len(results))
            .all()
        )
        add_cards(fallback)

    return results[:limit]
