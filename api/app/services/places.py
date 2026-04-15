"""
Google Places API (New) — hotel geocoding and enrichment.
Called in background thread after a stay is saved/updated.
"""
import os
import logging
import httpx
from concurrent.futures import ThreadPoolExecutor, as_completed

log = logging.getLogger(__name__)

PLACES_API_KEY = os.getenv("GOOGLE_PLACES_API_KEY", "")

PLACES_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"


def _search_place(query: str) -> dict | None:
    """Text search via Places API (New). Returns first result or None."""
    if not PLACES_API_KEY:
        log.warning("GOOGLE_PLACES_API_KEY not set — skipping Places enrichment")
        return None
    try:
        resp = httpx.post(
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


def _verify_hotel(suggestion: dict) -> dict | None:
    """
    Verify a hotel suggestion against Google Places.
    Returns enriched suggestion dict if found, None if not verified.
    """
    query = f"{suggestion['name']} {suggestion['destination']}"
    place = _search_place(query)
    if not place:
        return None

    photos = place.get("photos", [])
    photo_ref = photos[0].get("name") if photos else None
    place_id = place.get("id")

    # Must have at least a place_id to be considered verified
    if not place_id:
        return None

    photo_url = (
        f"https://places.googleapis.com/v1/{photo_ref}/media?maxHeightPx=480&maxWidthPx=640&key={PLACES_API_KEY}"
        if photo_ref else None
    )
    maps_url = f"https://www.google.com/maps/place/?q=place_id:{place_id}"

    location = place.get("location", {})
    return {
        **suggestion,
        "place_id": place_id,
        "lat": location.get("latitude"),
        "lng": location.get("longitude"),
        "photo_url": photo_url,
        "rating": place.get("rating") or suggestion.get("rating"),
        "address": place.get("formattedAddress"),
        "website": place.get("websiteUri"),
        "google_maps_url": maps_url,
    }


def verify_hotel_suggestions(suggestions: list[dict], max_results: int = 8) -> list[dict]:
    """
    Verify a list of AI-generated hotel suggestions against Google Places in parallel.
    Returns only verified suggestions (up to max_results), enriched with Places data.
    """
    if not suggestions:
        return []

    verified = []
    with ThreadPoolExecutor(max_workers=6) as executor:
        futures = {executor.submit(_verify_hotel, s): s for s in suggestions}
        for future in as_completed(futures):
            result = future.result()
            if result is not None:
                verified.append(result)
            if len(verified) >= max_results:
                # Cancel remaining futures once we have enough
                for f in futures:
                    f.cancel()
                break

    # Preserve original destination grouping order
    dest_order = {s["destination"]: i for i, s in enumerate(suggestions)}
    verified.sort(key=lambda s: (dest_order.get(s["destination"], 99), s["destination"]))

    return verified[:max_results]


def geocode_itinerary_activities(itinerary_data: dict) -> dict:
    """
    Geocode every activity block in the itinerary using Google Places Text Search.
    Adds lat, lng, place_id to each morning/afternoon/evening block that has a title.
    Returns updated itinerary_data dict (does not mutate in-place).
    Runs in a background thread — failures are silently skipped per block.
    """
    import copy
    data = copy.deepcopy(itinerary_data)
    day_plans = data.get("day_plans", [])

    def _geocode_block(block: dict, location_base: str) -> dict:
        if not block or not block.get("title"):
            return block
        query = f"{block['title']} {location_base}"
        place = _search_place(query)
        if place:
            location = place.get("location", {})
            lat = location.get("latitude")
            lng = location.get("longitude")
            place_id = place.get("id")
            if lat and lng:
                block = {**block, "lat": lat, "lng": lng, "place_id": place_id}
        return block

    # Geocode all blocks in parallel
    tasks = []  # (day_idx, period, block, location_base)
    for di, day in enumerate(day_plans):
        loc = day.get("location_base", "")
        for period in ("morning", "afternoon", "evening"):
            block = day.get(period)
            if block and block.get("title"):
                tasks.append((di, period, block, loc))

    if not tasks:
        return data

    with ThreadPoolExecutor(max_workers=6) as executor:
        future_map = {
            executor.submit(_geocode_block, task[2], task[3]): (task[0], task[1])
            for task in tasks
        }
        for future in as_completed(future_map):
            di, period = future_map[future]
            try:
                result = future.result()
                data["day_plans"][di][period] = result
            except Exception as e:
                log.warning("Activity geocode failed for day %d %s: %s", di, period, e)

    geocoded = sum(
        1 for day in data["day_plans"]
        for period in ("morning", "afternoon", "evening")
        if day.get(period) and day[period].get("lat")
    )
    log.info("Activity geocoding: %d/%d blocks geocoded", geocoded, len(tasks))
    return data


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
