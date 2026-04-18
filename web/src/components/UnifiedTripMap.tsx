import { useEffect, useRef, useState, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { Maximize2, Minimize2, ChevronLeft, ChevronRight } from 'lucide-react'
import type { ItineraryJSON, Stay, DayPlan, DayBlock } from '../types'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || ''

const TRANSPORT_COLORS: Record<string, string> = {
  flight:   '#f97316',
  drive:    '#3b82f6',
  train:    '#8b5cf6',
  bus:      '#10b981',
  ferry:    '#06b6d4',
  cruise:   '#06b6d4',
  transfer: '#6b7280',
}

const DEST_COLORS = ['#F07332', '#2D4A5A', '#2A9D5C', '#E8A020', '#D45E1E', '#1E7096', '#6B7C5E', '#8B6914']

const PERIOD_COLORS: Record<string, string> = {
  morning:   '#F07332',
  afternoon: '#2D4A5A',
  evening:   '#E8A020',
}


// Fixed IDs for the activity-to-stay route layer (only one active at a time)
const ROUTE_SOURCE_ID = 'activity-route'
const ROUTE_LAYER_ID  = 'activity-route'

async function geocodeCity(name: string, countryCode?: string): Promise<[number, number] | null> {
  const token = import.meta.env.VITE_MAPBOX_TOKEN
  if (!token) return null
  try {
    const countryParam = countryCode ? `&country=${countryCode.toLowerCase()}` : ''
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(name)}.json?types=place,locality,region,country&limit=1${countryParam}&access_token=${token}`
    )
    const data = await res.json()
    if (data.features?.length > 0) return data.features[0].center as [number, number]
  } catch { /* ignore */ }
  return null
}

interface RouteData { coords: [number, number][]; durationSecs: number }

async function getRouteData(
  from: [number, number],
  to: [number, number],
  profile: 'walking' | 'driving',
): Promise<RouteData | null> {
  const token = import.meta.env.VITE_MAPBOX_TOKEN
  if (!token) return null
  try {
    const res = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/${profile}/${from[0]},${from[1]};${to[0]},${to[1]}?geometries=geojson&access_token=${token}`
    )
    const data = await res.json()
    if (data.routes?.length > 0) {
      return {
        coords: data.routes[0].geometry.coordinates as [number, number][],
        durationSecs: data.routes[0].duration as number,
      }
    }
  } catch { /* ignore */ }
  return null
}

function buildArc(from: [number, number], to: [number, number], steps = 80, bias = 1): [number, number][] {
  const pts: [number, number][] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const lng = from[0] + (to[0] - from[0]) * t
    const lat = from[1] + (to[1] - from[1]) * t + bias * Math.sin(Math.PI * t) * Math.abs(to[1] - from[1]) * 0.3
    pts.push([lng, lat])
  }
  return pts
}

function getStayForDay(day: DayPlan, stays: Stay[]): Stay | null {
  if (!day.date) return null
  const dayDate = new Date(day.date + 'T12:00:00Z')
  return stays.find(stay => {
    const checkIn = new Date(stay.check_in)
    const checkOut = new Date(stay.check_out)
    return checkIn <= dayDate && dayDate < checkOut
  }) ?? null
}

// Returns ALL stays that overlap with a given calendar day (covers transition days
// where a client checks out of one hotel and into another on the same day).
function getStaysForDay(day: DayPlan, stays: Stay[]): Stay[] {
  if (!day.date) return []
  const dayStart = new Date(day.date + 'T00:00:00Z')
  const dayEnd   = new Date(day.date + 'T23:59:59Z')
  return stays.filter(stay => {
    const checkIn  = new Date(stay.check_in)
    const checkOut = new Date(stay.check_out)
    return checkIn <= dayEnd && checkOut > dayStart
  })
}

// Icon SVGs for each period (Lucide-style, 15×15 rendered at 24×24 viewBox)
const MORNING_SVG = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v8"/><path d="m4.93 10.93 1.41 1.41"/><path d="M2 18h2"/><path d="M20 18h2"/><path d="m19.07 10.93-1.41 1.41"/><path d="M22 22H2"/><path d="M16 18a4 4 0 0 0-8 0"/></svg>`
const AFTERNOON_SVG = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4" fill="white" stroke="none"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`
const EVENING_SVG = `<svg width="15" height="15" viewBox="0 0 24 24" fill="white" stroke="none"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`
const STAY_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`

const PERIOD_ICONS: Record<string, string> = {
  morning: MORNING_SVG,
  afternoon: AFTERNOON_SVG,
  evening: EVENING_SVG,
}

// Dot marker — outer el is controlled by Mapbox (never touch its transform).
// Hover is applied to the inner visual div only.
function makeIconDotEl(color: string, iconSvg: string): HTMLDivElement {
  const el = document.createElement('div')
  el.style.cssText = 'cursor: pointer; visibility: hidden; pointer-events: none; line-height: 0;'

  const inner = document.createElement('div')
  inner.style.cssText = `
    width: 32px; height: 32px; border-radius: 50%;
    background: ${color}; border: 2.5px solid white;
    box-shadow: 0 2px 8px rgba(0,0,0,0.25);
    display: flex; align-items: center; justify-content: center;
    transition: transform 0.12s;
  `
  inner.innerHTML = iconSvg
  el.appendChild(inner)

  el.onmouseenter = () => { inner.style.transform = 'scale(1.2) translateY(-2px)' }
  el.onmouseleave = () => { inner.style.transform = '' }
  return el
}

function makeActivityMarkerEl(period: string): HTMLDivElement {
  const color = PERIOD_COLORS[period] || '#6b7280'
  const icon = PERIOD_ICONS[period] || AFTERNOON_SVG
  return makeIconDotEl(color, icon)
}

function makeStayMarkerEl(): HTMLDivElement {
  return makeIconDotEl('#10b981', STAY_SVG)
}

function makeSuggestedHotelMarkerEl(): HTMLDivElement {
  const el = document.createElement('div')
  el.style.cssText = 'cursor: pointer; visibility: hidden; pointer-events: none; line-height: 0;'

  const inner = document.createElement('div')
  inner.style.cssText = `
    width: 34px; height: 34px; border-radius: 50%;
    background: linear-gradient(135deg, #92400e, #b45309);
    border: 2.5px solid #d4a017;
    box-shadow: 0 0 0 2px rgba(212,160,23,0.35), 0 2px 10px rgba(180,83,9,0.35);
    display: flex; align-items: center; justify-content: center;
    transition: transform 0.12s;
  `
  inner.innerHTML = STAY_SVG
  el.appendChild(inner)

  el.onmouseenter = () => { inner.style.transform = 'scale(1.2) translateY(-2px)' }
  el.onmouseleave = () => { inner.style.transform = '' }
  return el
}

function formatMinutes(secs: number): string {
  const mins = Math.round(secs / 60)
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

interface Props {
  itinerary: ItineraryJSON
  originCity: string
  stays: Stay[]
  selectedDayNum: number
  onDaySelect: (dayNum: number) => void
}

export default function UnifiedTripMap({ itinerary, originCity, stays, selectedDayNum, onDaySelect }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const destMarkersRef = useRef<mapboxgl.Marker[]>([])
  // day_number → [morning, afternoon, evening] markers (null if no coords)
  const activityMarkersRef = useRef<Map<number, (mapboxgl.Marker | null)[]>>(new Map())
  // stay.id → marker
  const stayMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map())
  // destination (lowercase) → suggested hotel marker
  const suggestedMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map())

  const [loading, setLoading] = useState(true)
  const [ready, setReady] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const allPopupsRef = useRef<mapboxgl.Popup[]>([])

  function closeAllPopups() {
    allPopupsRef.current.forEach(p => { try { p.remove() } catch { /* ignore */ } })
  }

  const locationCoords = useRef<Map<string, [number, number]>>(new Map())
  const dayLocation = useRef<Map<number, string>>(new Map())
  const allCoords = useRef<[number, number][]>([])
  // day_number → bounding coords for fitBounds
  const dayBoundsCoords = useRef<Map<number, [number, number][]>>(new Map())

  // ── Route state ─────────────────────────────────────────────────────────────
  const [routeMode, setRouteMode] = useState<'walking' | 'driving'>('walking')
  const [routeTimes, setRouteTimes] = useState<{ walking: number | null; driving: number | null } | null>(null)
  // When a marker is clicked, store stay + activity coords to trigger route fetch
  const [activeRoute, setActiveRoute] = useState<{ stay: [number, number]; activity: [number, number] } | null>(null)
  // Cache both route results so mode toggle doesn't refetch
  const routeDataCache = useRef<{ walking: RouteData | null; driving: RouteData | null } | null>(null)
  // Latest stays + itinerary accessible from inside map click handlers
  const staysRef = useRef(stays)
  const itineraryRef = useRef(itinerary)

  // Keep refs in sync so click handlers always use latest data
  useEffect(() => { staysRef.current = stays }, [stays])
  useEffect(() => { itineraryRef.current = itinerary }, [itinerary])

  const clearDestMarkers = useCallback(() => {
    destMarkersRef.current.forEach(m => m.remove())
    destMarkersRef.current = []
  }, [])

  // Clear the activity-to-stay route layer from the map
  function clearRouteLayer() {
    if (!map.current) return
    if (map.current.getLayer(ROUTE_LAYER_ID))   map.current.removeLayer(ROUTE_LAYER_ID)
    if (map.current.getSource(ROUTE_SOURCE_ID)) map.current.removeSource(ROUTE_SOURCE_ID)
  }

  // Draw the route layer for a given set of coords + mode
  function addRouteLayer(coords: [number, number][], mode: 'walking' | 'driving') {
    if (!map.current) return
    const color = mode === 'walking' ? '#10b981' : '#3b82f6'
    map.current.addSource(ROUTE_SOURCE_ID, {
      type: 'geojson',
      data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } },
    })
    map.current.addLayer({
      id: ROUTE_LAYER_ID, type: 'line', source: ROUTE_SOURCE_ID,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': color,
        'line-width': 3,
        'line-opacity': 0.9,
        ...(mode === 'walking' ? { 'line-dasharray': [1.5, 2.5] } : {}),
      },
    })
  }

  // ── Resize map when fullscreen toggles ──────────────────────────────────────
  useEffect(() => {
    if (!map.current) return
    const t = setTimeout(() => map.current?.resize(), 50)
    return () => clearTimeout(t)
  }, [fullscreen])

  // ── Fetch both routes when activeRoute changes ───────────────────────────────
  useEffect(() => {
    if (!ready || !map.current) return
    clearRouteLayer()
    routeDataCache.current = null

    if (!activeRoute) {
      setRouteTimes(null)
      return
    }

    const { stay, activity } = activeRoute
    Promise.all([
      getRouteData(stay, activity, 'walking'),
      getRouteData(stay, activity, 'driving'),
    ]).then(([walkData, driveData]) => {
      routeDataCache.current = { walking: walkData, driving: driveData }
      setRouteTimes({
        walking:  walkData?.durationSecs  ?? null,
        driving:  driveData?.durationSecs ?? null,
      })
      // Draw whichever mode is currently selected (read from DOM state — use callback form)
      setRouteMode(current => {
        const data = current === 'walking' ? walkData : driveData
        clearRouteLayer()
        if (data) addRouteLayer(data.coords, current)
        return current
      })
    })
  }, [activeRoute, ready]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Redraw from cache when mode toggle changes ───────────────────────────────
  useEffect(() => {
    if (!ready || !map.current || !routeDataCache.current) return
    clearRouteLayer()
    const data = routeMode === 'walking'
      ? routeDataCache.current.walking
      : routeDataCache.current.driving
    if (data) addRouteLayer(data.coords, routeMode)
  }, [routeMode, ready]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Initialize map ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainer.current || map.current) return
    if (!mapboxgl.accessToken) { setLoading(false); return }

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/light-v11',
        zoom: 1.5,
        center: [20, 20],
        interactive: true,
        attributionControl: false,
      })
    } catch (e) {
      console.warn('UnifiedTripMap: failed to init Mapbox:', e)
      return
    }
    map.current.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right')
    map.current.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-left')

    map.current.on('load', async () => {
      if (!map.current) return
      const legs = itinerary.transport_legs || []
      const destinations = itinerary.destinations || []
      const dayPlans = itinerary.day_plans || []

      // ── Geocode origin + destinations ──
      const originCoords = await geocodeCity(originCity)
      if (!originCoords) { setLoading(false); return }

      const resolvedDests: { name: string; coords: [number, number] | null; nights: number }[] = []
      for (const dest of destinations) {
        const coords = await geocodeCity(dest.name, dest.country_code)
        resolvedDests.push({ name: dest.name, coords, nights: dest.nights })
      }

      // Build day → location mapping
      dayPlans.forEach(dp => {
        dayLocation.current.set(dp.day_number, dp.location_base)
      })

      // Compute day lists per location (for non-contiguous range display)
      const locationDays = new Map<string, number[]>()
      dayPlans.forEach(dp => {
        const key = dp.location_base.toLowerCase()
        const existing = locationDays.get(key)
        if (!existing) locationDays.set(key, [dp.day_number])
        else existing.push(dp.day_number)
      })

      function formatDayRanges(days: number[]): string {
        if (!days.length) return ''
        const sorted = [...new Set(days)].sort((a, b) => a - b)
        const ranges: string[] = []
        let start = sorted[0], end = sorted[0]
        for (let i = 1; i < sorted.length; i++) {
          if (sorted[i] === end + 1) { end = sorted[i] }
          else { ranges.push(start === end ? `${start}` : `${start}–${end}`); start = end = sorted[i] }
        }
        ranges.push(start === end ? `${start}` : `${start}–${end}`)
        return ranges.join(', ')
      }

      // Build stops
      interface Stop { name: string; coords: [number, number]; color: string; dayRange: string; firstDay: number; maxDay: number; isOrigin: boolean }
      const stops: Stop[] = []
      stops.push({ name: originCity, coords: originCoords, color: '#2d4a5a', dayRange: 'Home', firstDay: 0, maxDay: 0, isOrigin: true })
      locationCoords.current.set(originCity.toLowerCase(), originCoords)

      let dc = 1
      resolvedDests.forEach((dest, i) => {
        if (!dest.coords) { dc += dest.nights; return }
        const days = locationDays.get(dest.name.toLowerCase())
        const firstDay = days ? Math.min(...days) : dc
        const lastDay = days ? Math.max(...days) : (dc + dest.nights - 1)
        stops.push({
          name: dest.name,
          coords: dest.coords,
          color: DEST_COLORS[i % DEST_COLORS.length],
          dayRange: days ? formatDayRanges(days) : (firstDay === lastDay ? `${firstDay}` : `${firstDay}–${lastDay}`),
          firstDay,
          maxDay: lastDay,
          isOrigin: false,
        })
        locationCoords.current.set(dest.name.toLowerCase(), dest.coords)
        dc += dest.nights
      })

      const destCoords = stops.filter(s => !s.isOrigin).map(s => s.coords)
      allCoords.current = destCoords.length > 0 ? destCoords : stops.map(s => s.coords)

      // ── Activity markers (hidden initially) ──────────────────────────────
      dayPlans.forEach(dp => {
        const periods: Array<'morning' | 'afternoon' | 'evening'> = ['morning', 'afternoon', 'evening']
        const dayMarkers: (mapboxgl.Marker | null)[] = []
        const dayCoords: [number, number][] = []

        periods.forEach(period => {
          const block: DayBlock | null = dp[period] as DayBlock | null
          if (!block?.lat || !block?.lng) { dayMarkers.push(null); return }

          const coords: [number, number] = [block.lng, block.lat]
          dayCoords.push(coords)

          const el = makeActivityMarkerEl(period)
          const costStr = block.est_cost_aud != null ? `~A$${block.est_cost_aud}` : ''
          const detailsPreview = (block.details || '').slice(0, 120) + ((block.details?.length || 0) > 120 ? '…' : '')
          const popup = new mapboxgl.Popup({ offset: 16, closeButton: true, maxWidth: '280px', className: 'papaya-popup' })
            .setHTML(`
              <div>
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:7px">
                  <span style="font-size:10px;font-weight:700;color:${PERIOD_COLORS[period]};text-transform:uppercase;letter-spacing:0.08em">${period}</span>
                  ${costStr ? `<span style="font-size:10px;color:#94a3b8">·</span><span style="font-size:10px;font-weight:600;color:#64748b">${costStr}</span>` : ''}
                </div>
                <div style="font-weight:700;font-size:14px;color:#0f172a;line-height:1.3;margin-bottom:7px">${block.title}</div>
                <div style="font-size:12px;color:#64748b;line-height:1.6">${detailsPreview}</div>
                ${block.place_id ? `<a href="https://www.google.com/maps/place/?q=place_id:${block.place_id}" target="_blank" rel="noopener" style="font-size:12px;color:#3b82f6;text-decoration:none;display:block;margin-top:10px;font-weight:600">View on Google Maps →</a>` : ''}
              </div>
            `)
          allPopupsRef.current.push(popup)

          const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
            .setLngLat(coords)
            .addTo(map.current!)

          el.addEventListener('click', (e) => {
            e.stopPropagation()
            const wasOpen = popup.isOpen()
            closeAllPopups()
            if (!wasOpen) {
              popup.setLngLat(coords).addTo(map.current!)
              map.current?.flyTo({ center: coords, zoom: 15, duration: 700, essential: true })
            }

            // Trigger route draw — confirmed stay first, fall back to suggested hotel
            const currentStay = getStayForDay(dp, staysRef.current)
            if (currentStay?.latitude && currentStay?.longitude) {
              setActiveRoute({
                stay: [currentStay.longitude, currentStay.latitude],
                activity: coords,
              })
            } else {
              const dest = dp.location_base?.toLowerCase()
              const suggestion = dest
                ? (itineraryRef.current.hotel_suggestions || []).find(
                    s => s.destination?.toLowerCase() === dest && s.lat && s.lng
                  )
                : null
              if (suggestion?.lat && suggestion?.lng) {
                setActiveRoute({ stay: [suggestion.lng, suggestion.lat], activity: coords })
              } else {
                setActiveRoute(null)
              }
            }
          })

          dayMarkers.push(marker)
        })

        activityMarkersRef.current.set(dp.day_number, dayMarkers)

        if (dayCoords.length > 0) {
          dayBoundsCoords.current.set(dp.day_number, dayCoords)
        }
      })

      // ── Stay markers (hidden initially, one per confirmed stay) ───────────
      stays.forEach(stay => {
        if (!stay.latitude || !stay.longitude) return
        const coords: [number, number] = [stay.longitude, stay.latitude]
        const el = makeStayMarkerEl()
        const nights = Math.round((new Date(stay.check_out).getTime() - new Date(stay.check_in).getTime()) / 86400000)
        const popup = new mapboxgl.Popup({ offset: 16, closeButton: true, maxWidth: '260px', className: 'papaya-popup' })
          .setHTML(`
            <div>
              <div style="font-size:10px;font-weight:700;color:#10b981;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:7px">Accommodation</div>
              <div style="font-weight:700;font-size:14px;color:#0f172a;line-height:1.3;margin-bottom:6px">${stay.name}</div>
              <div style="font-size:12px;color:#64748b">${nights} night${nights !== 1 ? 's' : ''}</div>
              ${stay.website ? `<a href="${stay.website}" target="_blank" rel="noopener" style="font-size:12px;color:#3b82f6;text-decoration:none;display:block;margin-top:10px;font-weight:600">View hotel →</a>` : ''}
            </div>
          `)
        allPopupsRef.current.push(popup)
        const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat(coords)
          .addTo(map.current!)
        el.addEventListener('click', (e) => {
          e.stopPropagation()
          const wasOpen = popup.isOpen()
          closeAllPopups()
          if (!wasOpen) {
            popup.setLngLat(coords).addTo(map.current!)
            map.current?.flyTo({ center: coords, zoom: 15, duration: 700, essential: true })
          }
        })
        stayMarkersRef.current.set(stay.id, marker)
      })

      // ── Suggested hotel markers (gold rim, one per destination) ───────────
      ;(itinerary.hotel_suggestions || []).forEach(suggestion => {
        if (!suggestion.lat || !suggestion.lng) return
        const dest = suggestion.destination?.toLowerCase() || ''
        if (suggestedMarkersRef.current.has(dest)) return // first suggestion per dest only
        const coords: [number, number] = [suggestion.lng, suggestion.lat]
        const el = makeSuggestedHotelMarkerEl()
        const price = suggestion.price_per_night_aud ? `~$${suggestion.price_per_night_aud.toLocaleString()} AUD/night` : ''
        const popup = new mapboxgl.Popup({ offset: 16, closeButton: true, maxWidth: '280px', className: 'papaya-popup' })
          .setHTML(`
            <div>
              <div style="font-size:10px;font-weight:700;color:#b45309;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:7px">Top Suggestion</div>
              <div style="font-weight:700;font-size:14px;color:#0f172a;line-height:1.3;margin-bottom:3px">${suggestion.name}</div>
              <div style="font-size:12px;color:#78350f;margin-bottom:5px">${suggestion.area} · ${suggestion.style}</div>
              ${price ? `<div style="font-size:12px;font-weight:700;color:#92400e;margin-bottom:8px">${price}</div>` : ''}
              <div style="display:flex;gap:10px;margin-top:6px">
                <a href="${suggestion.booking_com_search}" target="_blank" rel="noopener" style="font-size:12px;color:#d4a017;text-decoration:none;font-weight:700">Book →</a>
                <a href="${suggestion.google_maps_url}" target="_blank" rel="noopener" style="font-size:12px;color:#d4a017;text-decoration:none;font-weight:600">Maps →</a>
              </div>
              <div style="margin-top:8px;font-size:10px;color:#b45309">Not yet booked</div>
            </div>
          `)
        allPopupsRef.current.push(popup)
        const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat(coords)
          .addTo(map.current!)
        el.addEventListener('click', (e) => {
          e.stopPropagation()
          const wasOpen = popup.isOpen()
          closeAllPopups()
          if (!wasOpen) {
            popup.setLngLat(coords).addTo(map.current!)
            map.current?.flyTo({ center: coords, zoom: 15, duration: 700, essential: true })
          }
        })
        suggestedMarkersRef.current.set(dest, marker)
      })

      // ── Draw transport routes ────────────────────────────────────────────
      const destStops = stops.filter(s => !s.isOrigin)
      const firstDest = destStops[0]
      const lastDest = destStops[destStops.length - 1]

      // Separate checks: does a real leg depart from origin / arrive at origin?
      const hasOutboundLeg = legs.some(l => l.from.toLowerCase() === originCity.toLowerCase())
      const hasReturnLeg   = legs.some(l => l.to.toLowerCase()   === originCity.toLowerCase())

      // Generic outbound arc (origin → first destination) when no real outbound leg
      if (firstDest && !hasOutboundLeg && map.current) {
        const arcCoords = buildArc(originCoords, firstDest.coords)
        map.current.addSource('route-generic-outbound', {
          type: 'geojson',
          data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: arcCoords } },
        })
        map.current.addLayer({
          id: 'route-generic-outbound', type: 'line', source: 'route-generic-outbound',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': TRANSPORT_COLORS.flight, 'line-width': 2.5, 'line-opacity': 0.7, 'line-dasharray': [2, 2.5] },
        })
      }

      // Generic return arc — depart from whichever destination has the highest last day
      const returnDeparture = destStops.length > 0
        ? destStops.reduce((best, s) => s.maxDay > best.maxDay ? s : best, destStops[0])
        : null
      if (returnDeparture && !hasReturnLeg && map.current) {
        const arcCoords = buildArc(returnDeparture.coords, originCoords, 80, -1)
        map.current.addSource('route-generic-return', {
          type: 'geojson',
          data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: arcCoords } },
        })
        map.current.addLayer({
          id: 'route-generic-return', type: 'line', source: 'route-generic-return',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': TRANSPORT_COLORS.flight, 'line-width': 2.5, 'line-opacity': 0.7, 'line-dasharray': [2, 2.5] },
        })
      }

      for (const leg of legs) {
        const fromStop = stops.find(s => s.name.toLowerCase() === leg.from.toLowerCase())
          || (leg.from.toLowerCase() === originCity.toLowerCase() ? stops[0] : null)
        const toStop = stops.find(s => s.name.toLowerCase() === leg.to.toLowerCase())
          || (leg.to.toLowerCase() === originCity.toLowerCase() ? stops[0] : null)
        if (!fromStop?.coords || !toStop?.coords) continue

        const color = TRANSPORT_COLORS[leg.mode] || '#6b7280'
        const sourceId = `route-${leg.from}-${leg.to}`.replace(/[\s/]/g, '-')
        let coordinates: [number, number][]
        if (leg.mode === 'drive') {
          const route = await getRouteData(fromStop.coords, toStop.coords, 'driving')
          coordinates = route?.coords || [fromStop.coords, toStop.coords]
        } else if (leg.mode === 'flight') {
          coordinates = buildArc(fromStop.coords, toStop.coords)
        } else {
          coordinates = [fromStop.coords, toStop.coords]
        }

        if (!map.current) return
        map.current.addSource(sourceId, {
          type: 'geojson',
          data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } },
        })
        map.current.addLayer({
          id: sourceId, type: 'line', source: sourceId,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': color,
            'line-width': leg.mode === 'drive' ? 3 : 2.5,
            'line-opacity': 0.85,
            ...(leg.mode !== 'drive' ? { 'line-dasharray': leg.mode === 'flight' ? [2, 2.5] : [4, 3] } : {}),
          },
        })
      }

      // ── Destination markers ──────────────────────────────────────────────
      clearDestMarkers()
      stops.forEach(stop => {
        if (!map.current) return
        let el: HTMLDivElement
        if (stop.isOrigin) {
          el = document.createElement('div')
          el.style.cssText = `width:12px;height:12px;background:#2d4a5a;border:2.5px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.25);`
        } else {
          // Destination chip: floating pill label above a small color dot.
          // Outer el is Mapbox-controlled — never apply transforms to it.
          // Hover applied to inner wrapper only.
          el = document.createElement('div')
          el.style.cssText = 'cursor:pointer;line-height:0;display:flex;flex-direction:column;align-items:center;'
          const destInner = document.createElement('div')
          destInner.style.cssText = 'display:flex;flex-direction:column;align-items:center;transition:transform 0.15s;'
          destInner.innerHTML = `
            <div style="
              display:flex;align-items:center;gap:6px;
              background:white;
              border-radius:100px;
              padding:5px 10px 5px 6px;
              box-shadow:0 2px 10px rgba(0,0,0,0.18);
              white-space:nowrap;
              margin-bottom:5px;
            ">
              <span style="
                background:${stop.color};color:white;
                border-radius:100px;padding:2px 7px;
                font-size:10px;font-weight:800;
                font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
                line-height:1.5;letter-spacing:0.02em;
              ">${stop.dayRange}</span>
              <span style="
                font-size:12px;font-weight:700;color:#1a2a3a;
                font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
                line-height:1;
              ">${stop.name}</span>
            </div>
            <div style="
              width:10px;height:10px;border-radius:50%;
              background:${stop.color};border:2.5px solid white;
              box-shadow:0 1px 4px rgba(0,0,0,0.25);
            "></div>
          `
          el.appendChild(destInner)
          el.addEventListener('click', () => onDaySelect(stop.firstDay))
          el.onmouseenter = () => { destInner.style.transform = 'scale(1.06) translateY(-2px)' }
          el.onmouseleave = () => { destInner.style.transform = '' }

          // Hide pill label at low zoom, show dot only
          const pill = destInner.querySelector('div') as HTMLDivElement | null
          const updatePillVisibility = () => {
            if (!map.current || !pill) return
            pill.style.display = map.current.getZoom() >= 6 ? 'flex' : 'none'
          }
          updatePillVisibility()
          map.current!.on('zoom', updatePillVisibility)
        }
        const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat(stop.coords)
          .addTo(map.current!)
        destMarkersRef.current.push(marker)
      })

      // Fit to full trip on load
      if (allCoords.current.length > 1) {
        const bounds = allCoords.current.reduce(
          (b, c) => b.extend(c),
          new mapboxgl.LngLatBounds(allCoords.current[0], allCoords.current[0])
        )
        map.current.fitBounds(bounds, { padding: 60, maxZoom: 7, duration: 0 })
      }

      setLoading(false)
      setReady(true)
    })

    return () => {
      clearDestMarkers()
      activityMarkersRef.current.forEach(markers => markers.forEach(m => m?.remove()))
      stayMarkersRef.current.forEach(m => m.remove())
      suggestedMarkersRef.current.forEach(m => m.remove())
      map.current?.remove()
      map.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Day selection: show/hide activity + stay markers, zoom ─────────────────
  useEffect(() => {
    if (!ready || !map.current) return

    // Clear any active route and popups when the day changes
    closeAllPopups()
    clearRouteLayer()
    routeDataCache.current = null
    setActiveRoute(null)
    setRouteTimes(null)

    // Hide all activity markers
    activityMarkersRef.current.forEach(markers => {
      markers.forEach(m => {
        if (m) {
          const el = m.getElement() as HTMLElement
          el.style.visibility = 'hidden'
          el.style.pointerEvents = 'none'
        }
      })
    })

    // Hide all stay markers
    stayMarkersRef.current.forEach(m => {
      const el = m.getElement() as HTMLElement
      el.style.visibility = 'hidden'
      el.style.pointerEvents = 'none'
    })

    // Hide all suggested hotel markers
    suggestedMarkersRef.current.forEach(m => {
      const el = m.getElement() as HTMLElement
      el.style.visibility = 'hidden'
      el.style.pointerEvents = 'none'
    })

    if (selectedDayNum < 1) {
      // Reset to full trip view
      if (allCoords.current.length > 1) {
        const bounds = allCoords.current.reduce(
          (b, c) => b.extend(c),
          new mapboxgl.LngLatBounds(allCoords.current[0], allCoords.current[0])
        )
        map.current.fitBounds(bounds, { padding: 60, maxZoom: 7, duration: 900 })
      }
      return
    }

    // Show activity markers for selected day
    const dayMarkers = activityMarkersRef.current.get(selectedDayNum) || []
    dayMarkers.forEach(m => {
      if (m) {
        const el = m.getElement() as HTMLElement
        el.style.visibility = 'visible'
        el.style.pointerEvents = 'auto'
      }
    })

    // Show all stays that overlap with this day (handles transition days with two hotels)
    const dayPlan = (itinerary.day_plans || []).find(dp => dp.day_number === selectedDayNum)
    const staysForDay = dayPlan ? getStaysForDay(dayPlan, stays) : []
    const stayCoordsList: [number, number][] = []
    staysForDay.forEach(stay => {
      const stayMarker = stayMarkersRef.current.get(stay.id)
      if (stayMarker) {
        const el = stayMarker.getElement() as HTMLElement
        el.style.visibility = 'visible'
        el.style.pointerEvents = 'auto'
        if (stay.longitude && stay.latitude) {
          stayCoordsList.push([stay.longitude, stay.latitude])
        }
      }
    })

    // Show suggested hotel marker for this day's destination (only if no confirmed stay)
    const suggestedCoordsList: [number, number][] = []
    if (dayPlan && staysForDay.length === 0) {
      const dest = dayPlan.location_base?.toLowerCase()
      const suggestedMarker = dest ? suggestedMarkersRef.current.get(dest) : undefined
      if (suggestedMarker) {
        const el = suggestedMarker.getElement() as HTMLElement
        el.style.visibility = 'visible'
        el.style.pointerEvents = 'auto'
        const lngLat = suggestedMarker.getLngLat()
        suggestedCoordsList.push([lngLat.lng, lngLat.lat])
      }
    }

    // Compute bounds: activity coords + stay coords + suggested hotel
    const boundsCoords: [number, number][] = [
      ...(dayBoundsCoords.current.get(selectedDayNum) || []),
      ...stayCoordsList,
      ...suggestedCoordsList,
    ]

    if (boundsCoords.length === 0) {
      // No geocoded activities — fall back to fly to destination city
      const locName = dayLocation.current.get(selectedDayNum)
      if (locName) {
        const coords = locationCoords.current.get(locName.toLowerCase())
        if (coords) map.current.flyTo({ center: coords, zoom: 13, duration: 900, essential: true })
      }
      return
    }

    if (boundsCoords.length === 1) {
      map.current.flyTo({ center: boundsCoords[0], zoom: 14, duration: 900, essential: true })
    } else {
      const bounds = boundsCoords.reduce(
        (b, c) => b.extend(c),
        new mapboxgl.LngLatBounds(boundsCoords[0], boundsCoords[0])
      )
      map.current.fitBounds(bounds, { padding: 70, maxZoom: 14, duration: 900 })
    }
  }, [selectedDayNum, ready]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleResetView() {
    if (!map.current || allCoords.current.length === 0) return

    clearRouteLayer()
    routeDataCache.current = null
    setActiveRoute(null)
    setRouteTimes(null)

    // Hide activity + stay markers
    activityMarkersRef.current.forEach(markers => markers.forEach(m => {
      if (m) {
        const el = m.getElement() as HTMLElement
        el.style.visibility = 'hidden'
        el.style.pointerEvents = 'none'
      }
    }))
    stayMarkersRef.current.forEach(m => {
      const el = m.getElement() as HTMLElement
      el.style.visibility = 'hidden'
      el.style.pointerEvents = 'none'
    })
    suggestedMarkersRef.current.forEach(m => {
      const el = m.getElement() as HTMLElement
      el.style.visibility = 'hidden'
      el.style.pointerEvents = 'none'
    })

    if (allCoords.current.length === 1) {
      map.current.flyTo({ center: allCoords.current[0], zoom: 5, duration: 900 })
    } else {
      const bounds = allCoords.current.reduce(
        (b, c) => b.extend(c),
        new mapboxgl.LngLatBounds(allCoords.current[0], allCoords.current[0])
      )
      map.current.fitBounds(bounds, { padding: 60, maxZoom: 7, duration: 900 })
    }
  }

  if (!itinerary.destinations?.length && !itinerary.transport_legs?.length) return null

  const dayPlans = itinerary.day_plans || []
  const totalDays = dayPlans.length
  const canPrev = selectedDayNum > 1
  const canNext = selectedDayNum < totalDays

  return (
    <>
      {/* Popup CSS overrides */}
      <style>{`
        .papaya-popup .mapboxgl-popup-content {
          border-radius: 12px;
          padding: 14px 16px;
          box-shadow: 0 8px 30px rgba(0,0,0,0.18);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          border: 1px solid rgba(0,0,0,0.07);
        }
        .papaya-popup .mapboxgl-popup-close-button {
          font-size: 16px;
          color: #94a3b8;
          top: 8px;
          right: 10px;
          background: none;
          border: none;
          cursor: pointer;
        }
        .papaya-popup .mapboxgl-popup-close-button:hover {
          color: #475569;
        }
        .papaya-popup .mapboxgl-popup-tip {
          border-top-color: white;
        }
      `}</style>

      <div style={{
        position: fullscreen ? 'fixed' : 'relative',
        inset: fullscreen ? 0 : undefined,
        zIndex: fullscreen ? 1000 : undefined,
        borderRadius: fullscreen ? 0 : 12,
        overflow: 'hidden',
        border: fullscreen ? 'none' : '1px solid var(--color-border)',
        marginBottom: fullscreen ? 0 : 24,
        background: '#f0f4f8',
      }}>
        <div ref={mapContainer} style={{ height: fullscreen ? '100%' : 340, width: '100%', minHeight: fullscreen ? '100vh' : undefined }} />

        {loading && (
          <div style={{ position: 'absolute', inset: 0, background: '#f0f4f8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#6b7280' }}>
            Loading map…
          </div>
        )}

        {/* Fullscreen expand/minimize button */}
        {ready && (
          <button
            onClick={() => setFullscreen(fs => !fs)}
            title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            style={{
              position: 'absolute', top: 12, right: 12,
              background: 'white', border: '1px solid rgba(0,0,0,0.12)',
              borderRadius: 8, width: 34, height: 34,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.14)',
              color: '#374151',
            }}
          >
            {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        )}

        {/* Route travel time toggle — appears when an activity with a stay is clicked */}
        {ready && routeTimes && (
          <div style={{
            position: 'absolute', top: 12, right: fullscreen ? 56 : 54,
            background: 'white', borderRadius: 10, padding: '6px 8px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
            display: 'flex', gap: 4, alignItems: 'center',
            fontFamily: 'inherit',
          }}>
            <button
              onClick={() => setRouteMode('walking')}
              style={{
                border: routeMode === 'walking' ? '1.5px solid #10b981' : '1.5px solid #e5e7eb',
                background: routeMode === 'walking' ? '#f0fdf4' : 'white',
                borderRadius: 7, padding: '4px 10px', fontSize: 11, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
                color: routeMode === 'walking' ? '#10b981' : '#6b7280',
                display: 'flex', alignItems: 'center', gap: 4,
                transition: 'all 0.15s',
              }}
            >
              🚶 {routeTimes.walking != null ? formatMinutes(routeTimes.walking) : '—'}
            </button>
            <button
              onClick={() => setRouteMode('driving')}
              style={{
                border: routeMode === 'driving' ? '1.5px solid #3b82f6' : '1.5px solid #e5e7eb',
                background: routeMode === 'driving' ? '#eff6ff' : 'white',
                borderRadius: 7, padding: '4px 10px', fontSize: 11, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
                color: routeMode === 'driving' ? '#3b82f6' : '#6b7280',
                display: 'flex', alignItems: 'center', gap: 4,
                transition: 'all 0.15s',
              }}
            >
              🚗 {routeTimes.driving != null ? formatMinutes(routeTimes.driving) : '—'}
            </button>
          </div>
        )}

        {/* Full trip view button */}
        {ready && (
          <button
            onClick={handleResetView}
            style={{
              position: 'absolute', bottom: 36, right: 10,
              background: 'white', border: '1px solid var(--color-border)',
              borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
              color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 5,
              fontFamily: 'inherit',
            }}
          >
            ↙ Full trip view
          </button>
        )}

        {/* Fullscreen day prev/next nav */}
        {fullscreen && ready && selectedDayNum >= 1 && (
          <div style={{
            position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)',
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'white', borderRadius: 12, padding: '8px 14px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
            fontFamily: 'inherit',
          }}>
            <button
              onClick={() => canPrev && onDaySelect(selectedDayNum - 1)}
              disabled={!canPrev}
              style={{
                background: 'none', border: 'none', cursor: canPrev ? 'pointer' : 'default',
                color: canPrev ? '#374151' : '#cbd5e1', padding: '2px 4px',
                display: 'flex', alignItems: 'center',
              }}
            >
              <ChevronLeft size={18} />
            </button>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', minWidth: 60, textAlign: 'center' }}>
              Day {selectedDayNum} <span style={{ fontWeight: 400, color: '#94a3b8' }}>/ {totalDays}</span>
            </span>
            <button
              onClick={() => canNext && onDaySelect(selectedDayNum + 1)}
              disabled={!canNext}
              style={{
                background: 'none', border: 'none', cursor: canNext ? 'pointer' : 'default',
                color: canNext ? '#374151' : '#cbd5e1', padding: '2px 4px',
                display: 'flex', alignItems: 'center',
              }}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>
    </>
  )
}
