"""
Generate 3 options of 3-photo hero panels for 3 itineraries.
Layout matches the live app: 1 large photo left, 2 stacked right.
Sorted by likes. Queries use mood+light specifics and share colour temperature per set.
"""
import httpx, html

UNSPLASH_KEY = "3mHue-YVc3h9xBcqx_XbTGDIYpfg4_VOoa6M-ZHbltA"

# 3 itineraries, each with 3 options.
# Each option is a list of 3 queries [left, top-right, bottom-right]
# Rule: queries within a set share warm or cool colour temperature (anchored by left photo)
ITINERARIES = [
    {
        "label": "Japan — Tokyo + Kyoto",
        "options": [
            {
                "name": "Option 1 — Warm golden (temples + dusk)",
                "queries": [
                    "Kyoto temple golden hour dusk warm",
                    "Mount Fuji sunrise pink sky",
                    "Tokyo skyline dusk orange warm",
                ]
            },
            {
                "name": "Option 2 — Cool morning mist",
                "queries": [
                    "Japan cherry blossom misty morning",
                    "Kyoto bamboo forest morning light",
                    "Japan mountain mist fog cool",
                ]
            },
            {
                "name": "Option 3 — Rich colour + atmosphere",
                "queries": [
                    "Kyoto geisha district lanterns warm dusk",
                    "Japan autumn foliage red orange",
                    "Tokyo shibuya aerial warm light",
                ]
            },
        ]
    },
    {
        "label": "Greece — Athens + Santorini",
        "options": [
            {
                "name": "Option 1 — Warm mediterranean light",
                "queries": [
                    "Santorini caldera sunset golden hour",
                    "Athens Acropolis golden hour warm sky",
                    "Greece island whitewash blue dome warm",
                ]
            },
            {
                "name": "Option 2 — Cool blue aegean",
                "queries": [
                    "Santorini blue dome white village cool sky",
                    "Greece turquoise sea cliffs aerial",
                    "Santorini infinity pool aegean blue",
                ]
            },
            {
                "name": "Option 3 — Sunrise + dramatic light",
                "queries": [
                    "Santorini sunrise pink sky dramatic",
                    "Greece ancient ruins blue sky dramatic",
                    "Santorini village steps warm morning",
                ]
            },
        ]
    },
    {
        "label": "Morocco — Marrakech + Fes",
        "options": [
            {
                "name": "Option 1 — Rich warm desert palette",
                "queries": [
                    "Morocco Sahara desert dunes golden hour silhouette",
                    "Marrakech rooftop terrace warm sunset",
                    "Fes tannery aerial warm colour",
                ]
            },
            {
                "name": "Option 2 — Architecture + warm light",
                "queries": [
                    "Morocco riad courtyard warm light",
                    "Marrakech medina alley golden light",
                    "Morocco geometric tiles warm orange",
                ]
            },
            {
                "name": "Option 3 — Atlas + landscape",
                "queries": [
                    "Morocco Atlas mountains sunrise warm",
                    "Morocco camel caravan desert dusk",
                    "Marrakech ancient city walls golden",
                ]
            },
        ]
    },
]

def fetch_best(query: str) -> str | None:
    """Fetch the single highest-liked landscape photo for a query."""
    try:
        resp = httpx.get(
            "https://api.unsplash.com/search/photos",
            params={
                "query": query,
                "per_page": 20,
                "orientation": "landscape",
                "content_filter": "high",
                "order_by": "relevant",
            },
            headers={"Authorization": f"Client-ID {UNSPLASH_KEY}"},
            timeout=10,
        )
        resp.raise_for_status()
        results = resp.json().get("results", [])
        results = [p for p in results if p.get("width", 0) / max(p.get("height", 1), 1) >= 1.4]
        if not results:
            return None
        # Sort by likes descending, then resolution as tiebreaker
        results.sort(key=lambda p: (p.get("likes", 0), p["width"] * p["height"]), reverse=True)
        p = results[0]
        likes = p.get("likes", 0)
        print(f"        ↳ likes={likes:,}  ratio={p['width']/p['height']:.2f}")
        return p["urls"]["regular"]
    except Exception as e:
        print(f"  ERROR: {query} — {e}")
        return None

FALLBACK = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>"

def panel_html(option: dict, itinerary_label: str) -> str:
    queries = option["queries"]
    print(f"    {option['name']}")
    urls = []
    for q in queries:
        print(f"      fetching: {q}")
        url = fetch_best(q) or FALLBACK
        urls.append((q, url))

    left_q, left_url       = urls[0]
    top_right_q, top_url   = urls[1]
    bot_right_q, bot_url   = urls[2]

    return f"""
    <div style="margin-bottom:32px">
      <div style="font-size:13px;font-weight:700;color:#666;margin-bottom:10px">{html.escape(option['name'])}</div>
      <!-- Hero panel — matches live app layout -->
      <div style="display:grid;grid-template-columns:2fr 1fr;grid-template-rows:160px 160px;gap:3px;border-radius:12px;overflow:hidden;max-width:780px">
        <div style="grid-row:1/3;position:relative;overflow:hidden">
          <img src="{left_url}" style="width:100%;height:100%;object-fit:cover"/>
          <div style="position:absolute;bottom:6px;left:8px;background:rgba(0,0,0,.55);color:white;font-size:10px;padding:2px 7px;border-radius:4px">L — "{html.escape(left_q)}"</div>
        </div>
        <div style="position:relative;overflow:hidden">
          <img src="{top_url}" style="width:100%;height:100%;object-fit:cover"/>
          <div style="position:absolute;bottom:6px;left:8px;background:rgba(0,0,0,.55);color:white;font-size:10px;padding:2px 7px;border-radius:4px">TR — "{html.escape(top_right_q)}"</div>
        </div>
        <div style="position:relative;overflow:hidden">
          <img src="{bot_url}" style="width:100%;height:100%;object-fit:cover"/>
          <div style="position:absolute;bottom:6px;left:8px;background:rgba(0,0,0,.55);color:white;font-size:10px;padding:2px 7px;border-radius:4px">BR — "{html.escape(bot_right_q)}"</div>
        </div>
      </div>
    </div>"""

sections = []
for itin in ITINERARIES:
    print(f"\n{itin['label']}")
    option_panels = []
    for opt in itin["options"]:
        option_panels.append(panel_html(opt, itin["label"]))
    sections.append(f"""
    <div style="background:white;border:1px solid #e5e7eb;border-radius:14px;padding:28px;margin-bottom:36px">
      <h2 style="margin:0 0 22px;font-size:20px;color:#111">{html.escape(itin['label'])}</h2>
      {''.join(option_panels)}
    </div>""")

HTML = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Papaya — Hero Panel Review v2</title>
  <style>
    body {{ font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f3f4f6;padding:32px;max-width:900px;margin:0 auto }}
    h1   {{ font-size:26px;margin-bottom:6px }}
    p    {{ color:#6b7280;font-size:14px;margin-bottom:32px }}
  </style>
</head>
<body>
  <h1>Hero Panel Review — v2</h1>
  <p>Sorted by likes. Mood+light queries. Each set shares a warm or cool colour temperature. Atmospheric single people/wildlife allowed.</p>
  {''.join(sections)}
</body>
</html>"""

out = "/Users/natharvey/Desktop/papaya_hero_review2.html"
with open(out, "w") as f:
    f.write(HTML)
print(f"\nDone → {out}")
