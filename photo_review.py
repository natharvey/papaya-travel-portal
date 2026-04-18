"""
Fetch Unsplash hero photo candidates for 10 realistic trips using the same
query logic as the live app, then write a review HTML.
"""
import httpx, base64, html, json

UNSPLASH_KEY = "3mHue-YVc3h9xBcqx_XbTGDIYpfg4_VOoa6M-ZHbltA"

TRIPS = [
    {"label": "1 — Japan: Tokyo + Kyoto",          "destinations": ["Tokyo", "Kyoto"]},
    {"label": "2 — Thailand: Bangkok + Chiang Mai", "destinations": ["Bangkok", "Chiang Mai"]},
    {"label": "3 — Indonesia: Bali + Lombok",       "destinations": ["Bali", "Lombok"]},
    {"label": "4 — Spain: Barcelona + Mallorca",    "destinations": ["Barcelona", "Mallorca"]},
    {"label": "5 — Italy: Rome + Amalfi Coast",     "destinations": ["Rome", "Amalfi Coast"]},
    {"label": "6 — Greece: Athens + Santorini",     "destinations": ["Athens", "Santorini"]},
    {"label": "7 — Vietnam: Hanoi + Hoi An",        "destinations": ["Hanoi", "Hoi An"]},
    {"label": "8 — Morocco: Marrakech + Fes",       "destinations": ["Marrakech", "Fes"]},
    {"label": "9 — Sri Lanka: Colombo + Ella + Galle", "destinations": ["Colombo", "Ella", "Galle"]},
    {"label": "10 — USA: New York + New Orleans",   "destinations": ["New York", "New Orleans"]},
]

LABELS = "ABCDEFGH"

def fetch_candidates(destination: str, n: int = 5) -> list[dict]:
    """Exact same logic as _unsplash_hero_results in client.py"""
    try:
        resp = httpx.get(
            "https://api.unsplash.com/search/photos",
            params={
                "query": f"{destination} landscape scenery",
                "per_page": n * 3,  # fetch extra to survive ratio filter
                "orientation": "landscape",
                "content_filter": "high",
                "order_by": "relevant",
            },
            headers={"Authorization": f"Client-ID {UNSPLASH_KEY}"},
            timeout=10,
        )
        resp.raise_for_status()
        results = resp.json().get("results", [])
        results = [p for p in results if p.get("height", 1) > 0 and p.get("width", 0) / p.get("height", 1) >= 1.5]
        results.sort(key=lambda p: (p["width"] / max(p["height"], 1), p["width"] * p["height"]), reverse=True)
        return results[:n]
    except Exception as e:
        print(f"  ERROR fetching {destination}: {e}")
        return []

# ── Build HTML ────────────────────────────────────────────────────────────────

rows = []
for trip in TRIPS:
    print(f"Fetching: {trip['label']}")
    dest_blocks = []
    for dest in trip["destinations"]:
        print(f"  {dest}…")
        photos = fetch_candidates(dest)
        photo_html = ""
        for i, p in enumerate(photos):
            url = p["urls"]["regular"]
            label = LABELS[i]
            ratio = round(p["width"] / max(p["height"], 1), 2)
            photo_html += f"""
            <div style="flex:1;min-width:180px;max-width:240px">
              <img src="{url}" style="width:100%;height:140px;object-fit:cover;border-radius:6px;display:block"/>
              <div style="font-size:12px;margin-top:4px;color:#555">
                <strong style="font-size:14px;color:#111">{label}</strong>
                &nbsp;{ratio}:1
              </div>
              <div style="font-size:10px;color:#888;margin-top:2px">"{dest} landscape scenery"</div>
            </div>"""

        dest_blocks.append(f"""
        <div style="margin-bottom:20px">
          <div style="font-size:13px;font-weight:700;color:#444;margin-bottom:8px;text-transform:uppercase;letter-spacing:.05em">{html.escape(dest)}</div>
          <div style="display:flex;gap:10px;flex-wrap:wrap">{photo_html}</div>
        </div>""")

    rows.append(f"""
    <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:24px;margin-bottom:28px">
      <h2 style="margin:0 0 18px;font-size:18px;color:#111">{html.escape(trip['label'])}</h2>
      {''.join(dest_blocks)}
    </div>""")

HTML = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Papaya — Hero Photo Review</title>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           background:#f9fafb; padding:32px; max-width:1100px; margin:0 auto; }}
    h1   {{ font-size:24px; margin-bottom:6px; }}
    p    {{ color:#6b7280; margin-bottom:28px; font-size:14px; }}
  </style>
</head>
<body>
  <h1>Hero Photo Review</h1>
  <p>Each photo is fetched using the live query: <code>"[destination] landscape scenery"</code>, landscape orientation, ≥1.5:1 ratio — exactly as the app does it. Label each photo Good / Bad and note why.</p>
  {''.join(rows)}
</body>
</html>"""

out = "/Users/natharvey/Desktop/papaya_photo_review.html"
with open(out, "w") as f:
    f.write(HTML)
print(f"\nDone → {out}")
