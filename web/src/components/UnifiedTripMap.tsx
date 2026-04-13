import { useEffect, useRef, useState, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import type { ItineraryJSON, Stay } from '../types'

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
  const markersRef = useRef<mapboxgl.Marker[]>([])
  const [loading, setLoading] = useState(true)
  const [ready, setReady] = useState(false)

  // location name → coords (populated after geocoding)
  const locationCoords = useRef<Map<string, [number, number]>>(new Map())
  // day number → location name
  const dayLocation = useRef<Map<number, string>>(new Map())
  // all stop coords for fitBounds
  const allCoords = useRef<[number, number][]>([])

  const clearMarkers = useCallback(() => {
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []
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

      // ── Geocode origin + destinations ──
      const originCoords = await geocodeCity(originCity)
      if (!originCoords) { setLoading(false); return }

      const resolvedDests: { name: string; coords: [number, number] | null; nights: number }[] = []
      for (const dest of destinations) {
        const coords = await geocodeCity(dest.name)
        resolvedDests.push({ name: dest.name, coords, nights: dest.nights })
      }

      // Build day → location mapping
      let dayCount = 1
      resolvedDests.forEach(d => {
        for (let i = 0; i < d.nights; i++) {
          dayLocation.current.set(dayCount + i, d.name)
        }
        dayCount += d.nights
      })

      // Build stops list
      interface Stop { name: string; coords: [number, number]; color: string; dayRange: string; firstDay: number; isOrigin: boolean }
      const stops: Stop[] = []
      stops.push({ name: originCity, coords: originCoords, color: '#2d4a5a', dayRange: 'Home', firstDay: 0, isOrigin: true })
      locationCoords.current.set(originCity.toLowerCase(), originCoords)

      let dc = 1
      resolvedDests.forEach((dest, i) => {
        if (!dest.coords) { dc += dest.nights; return }
        const endDay = dc + dest.nights - 1
        stops.push({
          name: dest.name,
          coords: dest.coords,
          color: DEST_COLORS[i % DEST_COLORS.length],
          dayRange: dest.nights === 1 ? `Day ${dc}` : `Days ${dc}–${endDay}`,
          firstDay: dc,
          isOrigin: false,
        })
        locationCoords.current.set(dest.name.toLowerCase(), dest.coords)
        dc += dest.nights
      })

      // Fit bounds to destination coords only (not origin, which may be on a different continent)
      const destCoords = stops.filter(s => !s.isOrigin).map(s => s.coords)
      allCoords.current = destCoords.length > 0 ? destCoords : stops.map(s => s.coords)
      const stayPins = stays.filter(s => s.latitude && s.longitude)
      stayPins.forEach(s => allCoords.current.push([s.longitude!, s.latitude!]))

      // ── Draw transport routes ──
      // Auto-add origin → first destination flight arc if no leg covers that route
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

      // ── Markers: day-range pill labels for destinations, dot for origin ──
      clearMarkers()
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
        markersRef.current.push(marker)
      })

      // Hotel pins
      stayPins.forEach(stay => {
        if (!map.current) return
        const el = document.createElement('div')
        el.style.cssText = `background:white;border:2px solid #10b981;border-radius:6px;width:20px;height:20px;display:flex;align-items:center;justify-content:center;font-size:11px;box-shadow:0 2px 6px rgba(0,0,0,0.2);cursor:pointer;`
        el.textContent = '🏨'
        new mapboxgl.Marker({ element: el })
          .setLngLat([stay.longitude!, stay.latitude!])
          .setPopup(new mapboxgl.Popup({ offset: 12, closeButton: false })
            .setHTML(`<div style="font-family:inherit;padding:4px 2px"><div style="font-weight:700;font-size:13px">${stay.name}</div></div>`))
          .addTo(map.current!)
      })

      // Fit bounds to full trip
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
      clearMarkers()
      map.current?.remove()
      map.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fly to selected day's location ─────────────────────────────────────────
  useEffect(() => {
    if (!ready || !map.current || selectedDayNum < 1) return
    const locName = dayLocation.current.get(selectedDayNum)
    if (!locName) return
    const coords = locationCoords.current.get(locName.toLowerCase())
    if (!coords) return
    map.current.flyTo({ center: coords, zoom: 8, duration: 900, essential: true })
  }, [selectedDayNum, ready])

  function handleResetView() {
    if (!map.current || allCoords.current.length === 0) return
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
    </div>
  )
}
