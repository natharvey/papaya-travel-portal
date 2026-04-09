import { ComposableMap, Geographies, Geography, Marker, useMap } from 'react-simple-maps'
import AIRPORTS from '../data/airports'
import type { Flight } from '../types'

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

interface FlightMapProps {
  flights: Flight[]
  originCity: string
}

interface Arc {
  from: [number, number]
  to: [number, number]
  curve: number  // positive = curve above, negative = curve below, 0 = straight
}

interface MarkerPoint {
  coords: [number, number]
  label: string
  isOrigin: boolean
}

function getBounds(points: [number, number][]): { center: [number, number]; zoom: number } {
  if (points.length === 0) return { center: [0, 20], zoom: 1 }
  if (points.length === 1) return { center: points[0], zoom: 3 }

  const lons = points.map(p => p[0])
  const lats = points.map(p => p[1])
  const minLon = Math.min(...lons)
  const maxLon = Math.max(...lons)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)

  const centerLon = (minLon + maxLon) / 2
  const centerLat = (minLat + maxLat) / 2

  const lonSpan = maxLon - minLon
  const latSpan = maxLat - minLat
  const span = Math.max(lonSpan, latSpan)

  let zoom = 1
  if (span < 10) zoom = 6
  else if (span < 20) zoom = 4
  else if (span < 40) zoom = 3
  else if (span < 80) zoom = 2
  else zoom = 1.2

  return { center: [centerLon, centerLat], zoom }
}

// Renders a quadratic bezier arc between two projected points.
// curve > 0 bows upward (negative SVG y), curve < 0 bows downward.
function CurvedArc({ from, to, curve }: { from: [number, number]; to: [number, number]; curve: number }) {
  const { projection } = useMap()

  const p1 = projection(from)
  const p2 = projection(to)
  if (!p1 || !p2) return null

  const [x1, y1] = p1
  const [x2, y2] = p2

  let d: string
  if (curve === 0) {
    d = `M ${x1} ${y1} L ${x2} ${y2}`
  } else {
    // Perpendicular control point offset
    const mx = (x1 + x2) / 2
    const my = (y1 + y2) / 2
    const dx = x2 - x1
    const dy = y2 - y1
    const len = Math.sqrt(dx * dx + dy * dy) || 1
    // Perpendicular unit vector (rotated 90°), then scaled by curve amount
    const px = (-dy / len) * curve
    const py = (dx / len) * curve
    d = `M ${x1} ${y1} Q ${mx + px} ${my + py} ${x2} ${y2}`
  }

  return (
    <path
      d={d}
      fill="none"
      stroke="#f97316"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeDasharray="6 3"
    />
  )
}

export default function FlightMap({ flights }: FlightMapProps) {
  if (!flights || flights.length === 0) return null

  const sorted = [...flights].sort((a, b) => a.leg_order - b.leg_order)

  // First pass — collect all valid legs with a route key
  const legs: { from: [number, number]; to: [number, number]; key: string; reverseKey: string }[] = []

  sorted.forEach(flight => {
    const fromCoords = AIRPORTS[flight.departure_airport.toUpperCase()]
    const toCoords = AIRPORTS[flight.arrival_airport.toUpperCase()]
    if (!fromCoords || !toCoords) return
    const key = `${flight.departure_airport}-${flight.arrival_airport}`
    const reverseKey = `${flight.arrival_airport}-${flight.departure_airport}`
    legs.push({ from: fromCoords, to: toCoords, key, reverseKey })
  })

  // Second pass — assign curve direction for bidirectional pairs
  const seen = new Map<string, number>() // key → curve assigned
  const arcs: Arc[] = []

  legs.forEach(leg => {
    const hasReturn = legs.some(l => l.key === leg.reverseKey)
    if (hasReturn) {
      // Curve outbound up, return down — check which direction we've seen
      if (!seen.has(leg.key) && !seen.has(leg.reverseKey)) {
        seen.set(leg.key, 40)
        arcs.push({ from: leg.from, to: leg.to, curve: 40 })
      } else if (!seen.has(leg.key)) {
        seen.set(leg.key, -40)
        arcs.push({ from: leg.from, to: leg.to, curve: -40 })
      }
    } else {
      arcs.push({ from: leg.from, to: leg.to, curve: 0 })
    }
  })

  // Build unique markers
  const markerMap = new Map<string, MarkerPoint>()
  sorted.forEach((flight, i) => {
    const fromCoords = AIRPORTS[flight.departure_airport.toUpperCase()]
    const toCoords = AIRPORTS[flight.arrival_airport.toUpperCase()]
    if (!fromCoords || !toCoords) return
    if (!markerMap.has(flight.departure_airport)) {
      markerMap.set(flight.departure_airport, { coords: fromCoords, label: flight.departure_airport, isOrigin: i === 0 })
    }
    if (!markerMap.has(flight.arrival_airport)) {
      markerMap.set(flight.arrival_airport, { coords: toCoords, label: flight.arrival_airport, isOrigin: false })
    }
  })

  if (arcs.length === 0) {
    return (
      <div style={{
        background: '#F8FAFC', border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius)', padding: '20px', textAlign: 'center',
        fontSize: '13px', color: 'var(--color-text-muted)',
      }}>
        Airport codes not recognised — map unavailable for these flights.
      </div>
    )
  }

  const allPoints = Array.from(markerMap.values()).map(m => m.coords)
  const { center, zoom } = getBounds(allPoints)
  const markers = Array.from(markerMap.values())

  return (
    <div style={{
      background: 'linear-gradient(135deg, #0f1f3d 0%, #1a3a6b 100%)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
      position: 'relative',
    }}>
      <ComposableMap
        projection="geoNaturalEarth1"
        projectionConfig={{ center, scale: 160 * zoom }}
        width={900}
        height={420}
        style={{ width: '100%', height: 'auto' }}
      >
        <Geographies geography={GEO_URL}>
          {({ geographies }) =>
            geographies.map(geo => (
              <Geography
                key={(geo as any).rsmKey}
                geography={geo}
                fill="#1e3a5f"
                stroke="#2d5a8e"
                strokeWidth={0.5}
                style={{ default: { outline: 'none' }, hover: { outline: 'none' }, pressed: { outline: 'none' } }}
              />
            ))
          }
        </Geographies>

        {/* Flight arcs — curved for return pairs, straight for one-way */}
        {arcs.map((arc, i) => (
          <CurvedArc key={i} from={arc.from} to={arc.to} curve={arc.curve} />
        ))}

        {/* Airport markers */}
        {markers.map(marker => {
          const centerLon = allPoints.reduce((s, p) => s + p[0], 0) / allPoints.length
          const centerLat = allPoints.reduce((s, p) => s + p[1], 0) / allPoints.length
          const toRight = marker.coords[0] >= centerLon
          const toNorth = marker.coords[1] >= centerLat
          const dx = toRight ? 8 : -8
          const dy = toNorth ? -10 : 16
          const anchor = toRight ? 'start' : 'end'
          return (
            <Marker key={marker.label} coordinates={marker.coords}>
              <circle
                r={marker.isOrigin ? 5 : 4}
                fill={marker.isOrigin ? '#f97316' : '#ffffff'}
                stroke={marker.isOrigin ? '#fff' : '#f97316'}
                strokeWidth={1.5}
              />
              <text
                textAnchor={anchor}
                dx={dx}
                dy={dy}
                style={{
                  fontSize: '9px',
                  fontFamily: 'inherit',
                  fontWeight: 700,
                  fill: '#ffffff',
                  letterSpacing: '0.5px',
                }}
              >
                {marker.label}
              </text>
            </Marker>
          )
        })}
      </ComposableMap>

      {/* Legend */}
      <div style={{
        position: 'absolute', bottom: '12px', right: '14px',
        display: 'flex', gap: '14px', alignItems: 'center',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>
          <svg width="18" height="4"><line x1="0" y1="2" x2="18" y2="2" stroke="#f97316" strokeWidth="2" strokeDasharray="4 2" /></svg>
          Route
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>
          <svg width="10" height="10"><circle cx="5" cy="5" r="4" fill="#f97316" stroke="#fff" strokeWidth="1.5" /></svg>
          Origin
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>
          <svg width="10" height="10"><circle cx="5" cy="5" r="3.5" fill="white" stroke="#f97316" strokeWidth="1.5" /></svg>
          Stop
        </span>
      </div>
    </div>
  )
}
