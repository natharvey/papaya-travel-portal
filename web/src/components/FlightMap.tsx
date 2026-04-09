import { geoNaturalEarth1 } from 'd3-geo'
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps'
import AIRPORTS from '../data/airports'
import type { Flight } from '../types'

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'
const MAP_WIDTH = 900
const MAP_HEIGHT = 420

interface FlightMapProps {
  flights: Flight[]
  originCity: string
}

interface Arc {
  from: [number, number]
  to: [number, number]
  curve: number  // positive = curve above, negative = curve below, 0 = straight
  isReturn: boolean
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

// Build a d3 projection that matches react-simple-maps' internal geoNaturalEarth1 setup
function buildProjection(center: [number, number], zoom: number) {
  return geoNaturalEarth1()
    .rotate([-center[0], -center[1], 0])
    .translate([MAP_WIDTH / 2, MAP_HEIGHT / 2])
    .scale(160 * zoom)
}

// Compute SVG path string for a quadratic bezier arc.
// curveFactor is a fraction of the segment length (e.g. 0.35 = bow 35% of length).
// Positive bows "left" of travel direction, negative bows "right".
function arcPath(
  from: [number, number],
  to: [number, number],
  curveFactor: number,
  proj: ReturnType<typeof buildProjection>
): string | null {
  const p1 = proj(from)
  const p2 = proj(to)
  if (!p1 || !p2) return null

  const [x1, y1] = p1
  const [x2, y2] = p2

  if (curveFactor === 0) {
    return `M ${x1} ${y1} L ${x2} ${y2}`
  }

  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.sqrt(dx * dx + dy * dy) || 1
  const curve = len * curveFactor   // proportional to segment length
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  const px = (-dy / len) * curve
  const py = (dx / len) * curve
  return `M ${x1} ${y1} Q ${mx + px} ${my + py} ${x2} ${y2}`
}

export default function FlightMap({ flights }: FlightMapProps) {
  if (!flights || flights.length === 0) return null

  const sorted = [...flights].sort((a, b) => a.leg_order - b.leg_order)

  // First pass — collect all valid legs with a route key
  const legs: { from: [number, number]; to: [number, number]; key: string; reverseKey: string }[] = []

  sorted.forEach(flight => {
    const dep = flight.departure_airport.toUpperCase()
    const arr = flight.arrival_airport.toUpperCase()
    const fromCoords = AIRPORTS[dep]
    const toCoords = AIRPORTS[arr]
    if (!fromCoords || !toCoords) return
    const key = `${dep}-${arr}`
    const reverseKey = `${arr}-${dep}`
    legs.push({ from: fromCoords, to: toCoords, key, reverseKey })
  })

  // Second pass — assign curve factor for bidirectional pairs
  const seen = new Set<string>()
  const arcs: Arc[] = []

  legs.forEach(leg => {
    const hasReturn = legs.some(l => l.key === leg.reverseKey)
    if (hasReturn) {
      // Outbound bows left (+), return bows right (-)
      if (!seen.has(leg.key) && !seen.has(leg.reverseKey)) {
        seen.add(leg.key)
        arcs.push({ from: leg.from, to: leg.to, curve: 0.3, isReturn: false })
      } else if (!seen.has(leg.key)) {
        seen.add(leg.key)
        // Same positive factor — reversed travel direction naturally bows the opposite way
        arcs.push({ from: leg.from, to: leg.to, curve: 0.3, isReturn: true })
      }
    } else {
      arcs.push({ from: leg.from, to: leg.to, curve: 0, isReturn: false })
    }
  })

  // Build unique markers — use uppercase keys to avoid duplicates
  const markerMap = new Map<string, MarkerPoint>()
  sorted.forEach((flight, i) => {
    const dep = flight.departure_airport.toUpperCase()
    const arr = flight.arrival_airport.toUpperCase()
    const fromCoords = AIRPORTS[dep]
    const toCoords = AIRPORTS[arr]
    if (!fromCoords || !toCoords) return
    if (!markerMap.has(dep)) {
      markerMap.set(dep, { coords: fromCoords, label: dep, isOrigin: i === 0 })
    }
    if (!markerMap.has(arr)) {
      markerMap.set(arr, { coords: toCoords, label: arr, isOrigin: false })
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
  const proj = buildProjection(center, zoom)

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
        width={MAP_WIDTH}
        height={MAP_HEIGHT}
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
        {arcs.map((arc, i) => {
          const d = arcPath(arc.from, arc.to, arc.curve, proj)
          if (!d) return null
          return (
            <path
              key={i}
              d={d}
              fill="none"
              stroke={arc.isReturn ? '#60a5fa' : '#f97316'}
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeDasharray={arc.isReturn ? '3 4' : '6 3'}
            />
          )
        })}

        {/* Airport markers */}
        {markers.map((marker, mi) => {
          const centerLon = allPoints.reduce((s, p) => s + p[0], 0) / allPoints.length
          const centerLat = allPoints.reduce((s, p) => s + p[1], 0) / allPoints.length

          // Check if any other marker is close in longitude — alternate vertical offset
          const CLOSE_DEG = 8
          const nearbyIndex = markers.findIndex((m, i) =>
            i !== mi && Math.abs(m.coords[0] - marker.coords[0]) < CLOSE_DEG &&
            Math.abs(m.coords[1] - marker.coords[1]) < CLOSE_DEG
          )
          const toRight = marker.coords[0] >= centerLon
          // If there's a nearby airport, alternate label above/below based on which has higher lat
          let dy: number
          if (nearbyIndex !== -1) {
            const neighbour = markers[nearbyIndex]
            dy = marker.coords[1] >= neighbour.coords[1] ? -10 : 18
          } else {
            dy = marker.coords[1] >= centerLat ? -10 : 16
          }
          const dx = toRight ? 8 : -8
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
          <svg width="18" height="4"><line x1="0" y1="2" x2="18" y2="2" stroke="#f97316" strokeWidth="2" strokeDasharray="6 3" /></svg>
          Outbound
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>
          <svg width="18" height="4"><line x1="0" y1="2" x2="18" y2="2" stroke="#60a5fa" strokeWidth="2" strokeDasharray="3 4" /></svg>
          Return
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
