import { useEffect, useRef, useState, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import type { ItineraryJSON, Stay, TransportLeg } from '../types'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || ''

const TRANSPORT_COLORS: Record<string, string> = {
  flight: '#f97316',
  drive: '#3b82f6',
  train: '#8b5cf6',
  bus: '#10b981',
  ferry: '#06b6d4',
  cruise: '#06b6d4',
  transfer: '#6b7280',
}

const TRANSPORT_ICONS: Record<string, string> = {
  flight: '✈',
  drive: '🚗',
  train: '🚂',
  bus: '🚌',
  ferry: '⛴',
  cruise: '🚢',
  transfer: '🚐',
}

const DEST_COLORS = ['#f97316', '#3b82f6', '#8b5cf6', '#10b981', '#ef4444', '#f59e0b', '#06b6d4', '#ec4899']

async function geocodeCity(name: string): Promise<[number, number] | null> {
  const token = import.meta.env.VITE_MAPBOX_TOKEN
  if (!token) return null
  try {
    const query = encodeURIComponent(name)
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?types=place,locality,region,country&limit=1&access_token=${token}`
    )
    const data = await res.json()
    if (data.features && data.features.length > 0) {
      return data.features[0].center as [number, number]
    }
  } catch { /* ignore */ }
  return null
}

async function getDrivingRoute(from: [number, number], to: [number, number]): Promise<[number, number][] | null> {
  const token = import.meta.env.VITE_MAPBOX_TOKEN
  if (!token) return null
  try {
    const coords = `${from[0]},${from[1]};${to[0]},${to[1]}`
    const res = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?geometries=geojson&access_token=${token}`
    )
    const data = await res.json()
    if (data.routes && data.routes.length > 0) {
      return data.routes[0].geometry.coordinates as [number, number][]
    }
  } catch { /* ignore */ }
  return null
}

// Great circle arc between two points (for flights)
function buildArc(from: [number, number], to: [number, number], steps = 64): [number, number][] {
  const points: [number, number][] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const lng = from[0] + (to[0] - from[0]) * t
    const lat = from[1] + (to[1] - from[1]) * t
    // Add arc height using sine curve
    const arcHeight = Math.sin(Math.PI * t) * Math.abs(to[0] - from[0]) * 0.15
    points.push([lng, lat + arcHeight])
  }
  return points
}

// Straight line for trains/ferries/bus
function buildStraightLine(from: [number, number], to: [number, number]): [number, number][] {
  return [from, to]
}

interface ResolvedStop {
  name: string
  coords: [number, number]
  color: string
  dayRange: string
  isOrigin: boolean
  isStay?: boolean
  stayData?: Stay
}

interface ItineraryMapProps {
  itinerary: ItineraryJSON
  originCity: string
  stays: Stay[]
}

export default function ItineraryMap({ itinerary, originCity, stays }: ItineraryMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [noData, setNoData] = useState(false)
  const markersRef = useRef<mapboxgl.Marker[]>([])

  const legs: TransportLeg[] = itinerary.transport_legs || []
  const destinations = itinerary.destinations || []

  const clearMarkers = useCallback(() => {
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []
  }, [])

  useEffect(() => {
    if (!mapContainer.current || map.current) return

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      projection: 'globe' as any,
      zoom: 1.5,
      center: [20, 20],
      interactive: expanded,
      attributionControl: false,
    })

    map.current.addControl(new mapboxgl.AttributionControl({ compact: true }))

    map.current.on('load', async () => {
      if (!map.current) return

      // Fog for globe atmosphere
      map.current.setFog({
        color: 'rgb(240, 245, 250)',
        'high-color': 'rgb(180, 210, 240)',
        'horizon-blend': 0.08,
        'space-color': 'rgb(15, 30, 60)',
        'star-intensity': 0.15,
      })

      // Resolve coordinates for all stops
      const originCoords = await geocodeCity(originCity)
      if (!originCoords) {
        setLoading(false)
        setNoData(true)
        return
      }

      const resolvedDests: { name: string; coords: [number, number] | null }[] = []
      for (const dest of destinations) {
        const coords = await geocodeCity(dest.name)
        resolvedDests.push({ name: dest.name, coords })
      }

      const validDests = resolvedDests.filter(d => d.coords !== null)
      if (validDests.length === 0) {
        setLoading(false)
        setNoData(true)
        return
      }

      // Build stop list for timeline and markers
      const stops: ResolvedStop[] = []
      stops.push({
        name: originCity,
        coords: originCoords,
        color: '#2d4a5a',
        dayRange: 'Home',
        isOrigin: true,
      })

      let dayCount = 1
      destinations.forEach((dest, i) => {
        const resolved = resolvedDests.find(r => r.name === dest.name)
        if (!resolved?.coords) return
        const endDay = dayCount + dest.nights - 1
        stops.push({
          name: dest.name,
          coords: resolved.coords,
          color: DEST_COLORS[i % DEST_COLORS.length],
          dayRange: dest.nights === 1 ? `Day ${dayCount}` : `Days ${dayCount}–${endDay}`,
          isOrigin: false,
        })
        dayCount += dest.nights
      })

      // Add stay pins if they have coordinates
      const stayPins = stays.filter(s => s.latitude && s.longitude)

      // Draw routes based on transport legs
      for (const leg of legs) {
        const fromStop = stops.find(s => s.name.toLowerCase() === leg.from.toLowerCase())
          || (leg.from.toLowerCase() === originCity.toLowerCase() ? stops[0] : null)
        const toStop = stops.find(s => s.name.toLowerCase() === leg.to.toLowerCase())
          || (leg.to.toLowerCase() === originCity.toLowerCase() ? stops[0] : null)

        if (!fromStop?.coords || !toStop?.coords) continue

        const color = TRANSPORT_COLORS[leg.mode] || '#6b7280'
        const sourceId = `route-${leg.from}-${leg.to}`.replace(/\s/g, '-')

        let coordinates: [number, number][]

        if (leg.mode === 'drive') {
          const route = await getDrivingRoute(fromStop.coords, toStop.coords)
          coordinates = route || buildStraightLine(fromStop.coords, toStop.coords)
        } else if (leg.mode === 'flight') {
          coordinates = buildArc(fromStop.coords, toStop.coords)
        } else {
          coordinates = buildStraightLine(fromStop.coords, toStop.coords)
        }

        if (!map.current) return

        map.current.addSource(sourceId, {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates },
          },
        })

        const isDashed = leg.mode !== 'drive'
        map.current.addLayer({
          id: sourceId,
          type: 'line',
          source: sourceId,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': color,
            'line-width': leg.mode === 'drive' ? 3 : 2,
            'line-opacity': 0.8,
            ...(isDashed ? { 'line-dasharray': leg.mode === 'flight' ? [2, 3] : [4, 3] } : {}),
          },
        })
      }

      // Add destination markers
      clearMarkers()
      stops.forEach(stop => {
        if (!map.current) return
        const el = document.createElement('div')
        el.style.cssText = `
          background: ${stop.color};
          border: 2.5px solid white;
          border-radius: 50%;
          width: ${stop.isOrigin ? '14px' : '18px'};
          height: ${stop.isOrigin ? '14px' : '18px'};
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          cursor: pointer;
        `

        const popup = new mapboxgl.Popup({ offset: 12, closeButton: false })
          .setHTML(`
            <div style="font-family: inherit; padding: 4px 2px;">
              <div style="font-weight: 700; font-size: 13px; color: #1a2a3a;">${stop.name}</div>
              <div style="font-size: 11px; color: #6b7280; margin-top: 2px;">${stop.dayRange}</div>
            </div>
          `)

        const marker = new mapboxgl.Marker(el)
          .setLngLat(stop.coords)
          .setPopup(popup)
          .addTo(map.current)

        markersRef.current.push(marker)
      })

      // Add hotel pins for confirmed stays
      stayPins.forEach(stay => {
        if (!map.current) return
        const el = document.createElement('div')
        el.style.cssText = `
          background: white;
          border: 2.5px solid #10b981;
          border-radius: 6px;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.25);
          cursor: pointer;
        `
        el.textContent = '🏨'

        const nights = Math.round(
          (new Date(stay.check_out).getTime() - new Date(stay.check_in).getTime()) / 86400000
        )
        const popup = new mapboxgl.Popup({ offset: 12, closeButton: false })
          .setHTML(`
            <div style="font-family: inherit; padding: 4px 2px;">
              <div style="font-weight: 700; font-size: 13px; color: #1a2a3a;">${stay.name}</div>
              <div style="font-size: 11px; color: #6b7280; margin-top: 2px;">${nights} night${nights !== 1 ? 's' : ''}</div>
              ${stay.website ? `<a href="${stay.website}" target="_blank" rel="noopener noreferrer" style="font-size: 11px; color: #f97316; text-decoration: none; display: block; margin-top: 4px;">Book direct →</a>` : ''}
            </div>
          `)

        const marker = new mapboxgl.Marker(el)
          .setLngLat([stay.longitude!, stay.latitude!])
          .setPopup(popup)
          .addTo(map.current)

        markersRef.current.push(marker)
      })

      // Fit map to show all stops
      const allCoords: [number, number][] = stops.map(s => s.coords)
      stayPins.forEach(s => allCoords.push([s.longitude!, s.latitude!]))

      if (allCoords.length > 1) {
        const bounds = allCoords.reduce(
          (b, c) => b.extend(c),
          new mapboxgl.LngLatBounds(allCoords[0], allCoords[0])
        )
        map.current.fitBounds(bounds, { padding: 80, maxZoom: 8, duration: 1200 })
      }

      setLoading(false)
    })

    return () => {
      clearMarkers()
      map.current?.remove()
      map.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Toggle interactivity when expanded
  useEffect(() => {
    if (!map.current) return
    if (expanded) {
      map.current.scrollZoom.enable()
      map.current.dragPan.enable()
      map.current.touchZoomRotate.enable()
    } else {
      map.current.scrollZoom.disable()
      map.current.dragPan.disable()
      map.current.touchZoomRotate.disable()
    }
  }, [expanded])

  if (!legs.length && !destinations.length) return null

  return (
    <div style={{ marginBottom: 28 }}>
      {/* Timeline strip */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        overflowX: 'auto',
        paddingBottom: 12,
        marginBottom: 12,
        scrollbarWidth: 'none',
      }}>
        {legs.map((leg, i) => {
          const isFirst = i === 0
          const isLast = i === legs.length - 1
          const destIndex = destinations.findIndex(
            d => d.name.toLowerCase() === leg.to.toLowerCase()
          )
          const color = destIndex >= 0 ? DEST_COLORS[destIndex % DEST_COLORS.length] : '#6b7280'
          const isHomeLeg = isFirst || isLast

          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              {/* Origin / from label */}
              {isFirst && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 8, background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>📍</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{leg.from}</span>
                </div>
              )}

              {/* Transport connector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 6px' }}>
                <div style={{ width: 20, height: 1.5, background: 'var(--color-border)' }} />
                <div title={`${TRANSPORT_ICONS[leg.mode]} ${leg.duration}${leg.notes ? ' — ' + leg.notes : ''}`}
                  style={{ fontSize: 14, cursor: 'default', lineHeight: 1 }}>
                  {TRANSPORT_ICONS[leg.mode] || '→'}
                </div>
                <div style={{ width: 20, height: 1.5, background: 'var(--color-border)' }} />
              </div>

              {/* Destination pill */}
              {!isHomeLeg ? (
                <div style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  background: `${color}18`,
                  border: `1.5px solid ${color}40`,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color, whiteSpace: 'nowrap' }}>{leg.to}</div>
                  {(() => {
                    const dest = destinations.find(d => d.name.toLowerCase() === leg.to.toLowerCase())
                    if (!dest) return null
                    let startDay = 1
                    for (let j = 0; j < destIndex; j++) startDay += destinations[j].nights
                    const endDay = startDay + dest.nights - 1
                    return (
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 1, whiteSpace: 'nowrap' }}>
                        {dest.nights === 1 ? `Day ${startDay}` : `Days ${startDay}–${endDay}`}
                      </div>
                    )
                  })()}
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 8, background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>📍</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{leg.to}</span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Map */}
      <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--color-border)' }}>
        <div
          ref={mapContainer}
          style={{ height: expanded ? 500 : 300, width: '100%', transition: 'height 0.3s ease' }}
        />

        {loading && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(135deg, #e8f0f5 0%, #d4e4ef 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, color: '#6b7280',
          }}>
            Loading map…
          </div>
        )}

        {!loading && !noData && (
          <button
            onClick={() => setExpanded(e => !e)}
            style={{
              position: 'absolute', bottom: 12, right: 12,
              background: 'white', border: '1px solid var(--color-border)',
              borderRadius: 8, padding: '7px 14px',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
              color: 'var(--color-text)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {expanded ? '↙ Collapse map' : '↗ View full map'}
          </button>
        )}
      </div>

      {/* Transport notes */}
      {itinerary.transport_notes && itinerary.transport_notes.length > 0 && (
        <div style={{ marginTop: 12, padding: '12px 16px', background: 'var(--color-bg)', borderRadius: 8, border: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            Transport notes
          </div>
          {itinerary.transport_notes.map((note, i) => (
            <div key={i} style={{ fontSize: 13, color: 'var(--color-text)', lineHeight: 1.5, paddingLeft: 8, borderLeft: '2px solid var(--color-border)', marginTop: i > 0 ? 6 : 0 }}>
              {note}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
