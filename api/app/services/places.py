"""
Google Places API (New) — hotel geocoding and enrichment.
Called in background thread after a stay is saved/updated.
"""
import os
import logging
import requests

log = logging.getLogger(__name__)

PLACES_API_KEY = os.getenv("GOOGLE_PLACES_API_KEY", "")

PLACES_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"


def _search_place(query: str) -> dict | None:
    """Text search via Places API (New). Returns first result or None."""
    if not PLACES_API_KEY:
        log.warning("GOOGLE_PLACES_API_KEY not set — skipping Places enrichment")
        return None
    try:
        resp = requests.post(
            PLACES_SEARCH_URL,
            json={"textQuery": query, "maxResultCount": 1},
            headers={
                "Content-Type": "application/json",
                "X-Goog-Api-Key": PLACES_API_KEY,
                "X-Goog-FieldMask": (
                    "places.id,"
                    "places.location,"
                    "places.rating,"
                    "places.websiteUri,"
                    "places.photos,"
                    "places.formattedAddress"
                ),
            },
            timeout=8,
        )
        resp.raise_for_status()
        data = resp.json()
        places = data.get("places", [])
        return places[0] if places else None
    except Exception as e:
        log.warning("Places text search failed for %r: %s", query, e)
        return None


def enrich_stay(stay, db) -> None:
    """
    Geocode and enrich a Stay record using Google Places.
    Updates: latitude, longitude, google_place_id, website, photo_reference, rating.
    Commits changes to db.
    """
    query = stay.name
    if stay.address:
        query = f"{stay.name}, {stay.address}"

    place = _search_place(query)
    if not place:
        return

    location = place.get("location", {})
    lat = location.get("latitude")
    lng = location.get("longitude")
    place_id = place.get("id")
    rating = place.get("rating")
    website = place.get("websiteUri")
    photos = place.get("photos", [])
    photo_ref = photos[0].get("name") if photos else None

    if lat:
        stay.latitude = lat
    if lng:
        stay.longitude = lng
    if place_id:
        stay.google_place_id = place_id
    if rating:
        stay.rating = rating
    if website:
        stay.website = website
    if photo_ref:
        stay.photo_reference = photo_ref

    try:
        db.commit()
        log.info("Enriched stay %s (%s) — lat=%s lng=%s rating=%s", stay.id, stay.name, lat, lng, rating)
    except Exception as e:
        log.warning("Failed to commit stay enrichment for %s: %s", stay.id, e)
        db.rollback()
