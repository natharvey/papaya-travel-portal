import { useEffect, useRef, useState, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
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

const DEST_COLORS = ['#f97316', '#3b82f6', '#8b5cf6', '#10b981', '#ef4444', '#f59e0b', '#06b6d4', '#ec4899']

const PERIOD_COLORS: Record<string, string> = {
  morning:   '#f59e0b',
  afternoon: '#3b82f6',
  evening:   '#6d28d9',
}
const PERIOD_LABELS: Record<string, string> = {
  morning: 'AM',
  afternoon: 'PM',
  evening: 'EVE',
}

async function geocodeCity(name: string): Promise<[number, number] | null> {
  const token = import.meta.env.VITE_MAPBOX_TOKEN
  if (!token) return null
  try {
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(name)}.json?types=place,locality,region,country&limit=1&access_token=${token}`
    )
    const data = await res.json()
    if (data.features?.length > 0) return data.features[0].center as [number, number]
  } catch { /* ignore */ }
  return null
}

async function getDrivingRoute(from: [number, number], to: [number, number]): Promise<[number, number][] | null> {
  const token = import.meta.env.VITE_MAPBOX_TOKEN
  if (!token) return null
  try {
    const res = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/driving/${from[0]},${from[1]};${to[0]},${to[1]}?geometries=geojson&access_token=${token}`
    )
    const data = await res.json()
    if (data.routes?.length > 0) return data.routes[0].geometry.coordinates as [number, number][]
  } catch { /* ignore */ }
  return null
}

function buildArc(from: [number, number], to: [number, number], steps = 80): [number, number][] {
  const pts: [number, number][] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const lng = from[0] + (to[0] - from[0]) * t
    const lat = from[1] + (to[1] - from[1]) * t + Math.sin(Math.PI * t) * Math.abs(to[1] - from[1]) * 0.3
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

function makeActivityMarkerEl(period: string): HTMLDivElement {
  const el = document.createElement('div')
  const color = PERIOD_COLORS[period] || '#6b7280'
  const label = PERIOD_LABELS[period] || period.slice(0, 3).toUpperCase()
  el.style.cssText = `
    background: ${color}; color: white;
    border: 2px solid white; border-radius: 12px;
    padding: 2px 7px; font-size: 10px; font-weight: 700;
    white-space: nowrap; box-shadow: 0 2px 6px rgba(0,0,0,0.28);
    cursor: pointer; font-family: inherit; letter-spacing: 0.03em;
    transition: transform 0.12s, box-shadow 0.12s;
    display: none;
  `
  el.textContent = label
  el.onmouseenter = () => { el.style.transform = 'scale(1.12)'; el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.35)' }
  el.onmouseleave = () => { el.style.transform = ''; el.style.boxShadow = '0 2px 6px rgba(0,0,0,0.28)' }
  return el
}

function makeStayMarkerEl(): HTMLDivElement {
  const el = document.createElement('div')
  el.style.cssText = `
    background: white; border: 2.5px solid #10b981; border-radius: 8px;
    width: 26px; height: 26px; display: none;
    align-items: center; justify-content: center;
    font-size: 13px; box-shadow: 0 2px 8px rgba(0,0,0,0.22); cursor: pointer;
    transition: transform 0.12s;
  `
  el.style.display = 'none'
  el.textContent = '🏨'
  el.onmouseenter = () => { el.style.transform = 'scale(1.15)' }
  el.onmouseleave = () => { el.style.transform = '' }
  return el
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

  const [loading, setLoading] = useState(true)
  const [ready, setReady] = useState(false)

  const locationCoords = useRef<Map<string, [number, number]>>(new Map())
  const dayLocation = useRef<Map<number, string>>(new Map())
  const allCoords = useRef<[number, number][]>([])
  // day_number → bounding coords for fitBounds
  const dayBoundsCoords = useRef<Map<number, [number, number][]>>(new Map())

  const clearDestMarkers = useCallback(() => {
    destMarkersRef.current.forEach(m => m.remove())
    destMarkersRef.current = []
  }, [])

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
    map.current.addControl(new mapboxgl.AttributionControl({ compact: true }))
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
        const coords = await geocodeCity(dest.name)
        resolvedDests.push({ name: dest.name, coords, nights: dest.nights })
      }

      // Build day → location mapping
      dayPlans.forEach(dp => {
        dayLocation.current.set(dp.day_number, dp.location_base)
      })

      // Compute day ranges per location
      const locationDayRange = new Map<string, { min: number; max: number }>()
      dayPlans.forEach(dp => {
        const key = dp.location_base.toLowerCase()
        const existing = locationDayRange.get(key)
        if (!existing) {
          locationDayRange.set(key, { min: dp.day_number, max: dp.day_number })
        } else {
          existing.min = Math.min(existing.min, dp.day_number)
          existing.max = Math.max(existing.max, dp.day_number)
        }
      })

      // Build stops
      interface Stop { name: string; coords: [number, number]; color: string; dayRange: string; firstDay: number; isOrigin: boolean }
      const stops: Stop[] = []
      stops.push({ name: originCity, coords: originCoords, color: '#2d4a5a', dayRange: 'Home', firstDay: 0, isOrigin: true })
      locationCoords.current.set(originCity.toLowerCase(), originCoords)

      let dc = 1
      resolvedDests.forEach((dest, i) => {
        if (!dest.coords) { dc += dest.nights; return }
        const range = locationDayRange.get(dest.name.toLowerCase())
        const firstDay = range?.min ?? dc
        const lastDay = range?.max ?? (dc + dest.nights - 1)
        stops.push({
          name: dest.name,
          coords: dest.coords,
          color: DEST_COLORS[i % DEST_COLORS.length],
          dayRange: firstDay === lastDay ? `Day ${firstDay}` : `Days ${firstDay}–${lastDay}`,
          firstDay,
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
          const costStr = block.est_cost_aud != null ? ` · ~A$${block.est_cost_aud}` : ''
          const popup = new mapboxgl.Popup({ offset: 14, closeButton: false, maxWidth: '240px' })
            .setHTML(`
              <div style="font-family:inherit;padding:4px 2px">
                <div style="font-size:10px;font-weight:700;color:${PERIOD_COLORS[period]};text-transform:uppercase;letter-spacing:0.06em;margin-bottom:3px">${period}${costStr}</div>
                <div style="font-weight:700;font-size:13px;color:#1a2a3a;margin-bottom:4px">${block.title}</div>
                <div style="font-size:11px;color:#6b7280;line-height:1.4">${block.details?.slice(0, 100)}${(block.details?.length || 0) > 100 ? '…' : ''}</div>
                ${block.place_id ? `<a href="https://www.google.com/maps/place/?q=place_id:${block.place_id}" target="_blank" rel="noopener" style="font-size:11px;color:#3b82f6;text-decoration:none;display:block;margin-top:6px">View on Google Maps →</a>` : ''}
              </div>
            `)

          const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
            .setLngLat(coords)
            .setPopup(popup)
            .addTo(map.current!)

          // Click: fly in close
          el.addEventListener('click', (e) => {
            e.stopPropagation()
            map.current?.flyTo({ center: coords, zoom: 15, duration: 700, essential: true })
            marker.togglePopup()
          })

          dayMarkers.push(marker)
        })

        activityMarkersRef.current.set(dp.day_number, dayMarkers)

        // Bounds for this day: activity coords + stay coords (added below)
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
        const popup = new mapboxgl.Popup({ offset: 14, closeButton: false, maxWidth: '220px' })
          .setHTML(`
            <div style="font-family:inherit;padding:4px 2px">
              <div style="font-size:10px;font-weight:700;color:#10b981;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:3px">Accommodation</div>
              <div style="font-weight:700;font-size:13px;color:#1a2a3a;margin-bottom:4px">${stay.name}</div>
              <div style="font-size:11px;color:#6b7280">${nights} night${nights !== 1 ? 's' : ''}</div>
              ${stay.website ? `<a href="${stay.website}" target="_blank" rel="noopener" style="font-size:11px;color:#3b82f6;text-decoration:none;display:block;margin-top:6px">View hotel →</a>` : ''}
            </div>
          `)
        const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat(coords)
          .setPopup(popup)
          .addTo(map.current!)
        el.addEventListener('click', (e) => {
          e.stopPropagation()
          map.current?.flyTo({ center: coords, zoom: 15, duration: 700, essential: true })
          marker.togglePopup()
        })
        stayMarkersRef.current.set(stay.id, marker)
      })

      // ── Draw transport routes ────────────────────────────────────────────
      const firstDest = stops.find(s => !s.isOrigin)
      const hasOriginLeg = legs.some(l =>
        l.from.toLowerCase() === originCity.toLowerCase() ||
        l.to.toLowerCase() === originCity.toLowerCase()
      )
      if (firstDest && !hasOriginLeg && map.current) {
        const arcCoords = buildArc(originCoords, firstDest.coords)
        const sourceId = `route-origin-${firstDest.name}`.replace(/[\s/]/g, '-')
        map.current.addSource(sourceId, {
          type: 'geojson',
          data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: arcCoords } },
        })
        map.current.addLayer({
          id: sourceId, type: 'line', source: sourceId,
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
          const route = await getDrivingRoute(fromStop.coords, toStop.coords)
          coordinates = route || [fromStop.coords, toStop.coords]
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
        const el = document.createElement('div')
        if (stop.isOrigin) {
          el.style.cssText = `width:12px;height:12px;background:#2d4a5a;border:2.5px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.25);`
        } else {
          el.style.cssText = `
            background:${stop.color};color:white;
            border:2.5px solid white;border-radius:20px;
            padding:3px 10px;font-size:11px;font-weight:700;
            white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.22);
            cursor:pointer;font-family:inherit;letter-spacing:0.01em;
            transition:transform 0.15s, box-shadow 0.15s;
          `
          el.textContent = stop.dayRange
          el.addEventListener('click', () => onDaySelect(stop.firstDay))
        }
        const popup = new mapboxgl.Popup({ offset: 12, closeButton: false })
          .setHTML(`<div style="font-family:inherit;padding:4px 2px"><div style="font-weight:700;font-size:13px;color:#1a2a3a">${stop.name}</div><div style="font-size:11px;color:#6b7280;margin-top:2px">${stop.dayRange}</div></div>`)
        const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat(stop.coords)
          .setPopup(popup)
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
      map.current?.remove()
      map.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Day selection: show/hide activity + stay markers, zoom ─────────────────
  useEffect(() => {
    if (!ready || !map.current) return

    // Hide all activity markers
    activityMarkersRef.current.forEach(markers => {
      markers.forEach(m => {
        if (m) (m.getElement() as HTMLElement).style.display = 'none'
      })
    })

    // Hide all stay markers
    stayMarkersRef.current.forEach(m => {
      ;(m.getElement() as HTMLElement).style.display = 'none'
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
      if (m) (m.getElement() as HTMLElement).style.display = 'flex'
    })

    // Find stay for this night and show its marker
    const dayPlan = (itinerary.day_plans || []).find(dp => dp.day_number === selectedDayNum)
    const stayForNight = dayPlan ? getStayForDay(dayPlan, stays) : null
    let stayCoords: [number, number] | null = null
    if (stayForNight) {
      const stayMarker = stayMarkersRef.current.get(stayForNight.id)
      if (stayMarker) {
        ;(stayMarker.getElement() as HTMLElement).style.display = 'flex'
        if (stayForNight.longitude && stayForNight.latitude) {
          stayCoords = [stayForNight.longitude, stayForNight.latitude]
        }
      }
    }

    // Compute bounds: activity coords + stay coords
    const boundsCoords: [number, number][] = [...(dayBoundsCoords.current.get(selectedDayNum) || [])]
    if (stayCoords) boundsCoords.push(stayCoords)

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

    // Hide activity + stay markers
    activityMarkersRef.current.forEach(markers => markers.forEach(m => {
      if (m) (m.getElement() as HTMLElement).style.display = 'none'
    }))
    stayMarkersRef.current.forEach(m => {
      ;(m.getElement() as HTMLElement).style.display = 'none'
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

  return (
    <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--color-border)', marginBottom: 24 }}>
      <div ref={mapContainer} style={{ height: 340, width: '100%' }} />
      {loading && (
        <div style={{ position: 'absolute', inset: 0, background: '#f0f4f8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#6b7280' }}>
          Loading map…
        </div>
      )}
      {ready && (
        <button
          onClick={handleResetView}
          style={{
            position: 'absolute', bottom: 12, right: 12,
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
      {ready && (
        <div style={{ position: 'absolute', bottom: 12, left: 12, display: 'flex', gap: 6 }}>
          {Object.entries(PERIOD_COLORS).map(([period, color]) => (
            <div key={period} style={{ background: 'white', border: `1.5px solid ${color}`, borderRadius: 8, padding: '4px 8px', fontSize: 10, fontWeight: 700, color, fontFamily: 'inherit', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
              {PERIOD_LABELS[period]} {period.charAt(0).toUpperCase() + period.slice(1)}
            </div>
          ))}
          <div style={{ background: 'white', border: '1.5px solid #10b981', borderRadius: 8, padding: '4px 8px', fontSize: 10, fontWeight: 700, color: '#10b981', fontFamily: 'inherit', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
            🏨 Stay
          </div>
        </div>
      )}
    </div>
  )
}
