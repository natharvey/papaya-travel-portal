import { useEffect, useRef, useState, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import type { DayPlan } from '../types'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || ''

// Match the location palette used in ItineraryTimeline
const LOCATION_COLORS = [
  '#F07332', // orange (primary)
  '#3B82F6', // blue
  '#8B5CF6', // purple
  '#10B981', // green
  '#EF4444', // red
  '#F59E0B', // amber
  '#06B6D4', // cyan
  '#EC4899', // pink
]

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

interface Props {
  dayPlans: DayPlan[]
}

export default function DayMap({ dayPlans }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<mapboxgl.Marker[]>([])
  const [loading, setLoading] = useState(true)

  const clearMarkers = useCallback(() => {
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []
  }, [])

  useEffect(() => {
    if (!mapContainer.current || map.current) return
    if (!mapboxgl.accessToken) { setLoading(false); return }

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/light-v11',
        zoom: 2,
        center: [100, 10],
        interactive: true,
        attributionControl: false,
      })
    } catch (e) {
      console.warn('DayMap: failed to init Mapbox:', e)
      return
    }
    map.current.addControl(new mapboxgl.AttributionControl({ compact: true }))

    map.current.on('load', async () => {
      if (!map.current) return

      // Build unique locations in order
      const locationOrder: string[] = []
      dayPlans.forEach(d => {
        if (!locationOrder.includes(d.location_base)) locationOrder.push(d.location_base)
      })

      // Geocode each unique location
      const coordsMap = new Map<string, [number, number]>()
      await Promise.all(locationOrder.map(async loc => {
        const coords = await geocodeCity(loc)
        if (coords) coordsMap.set(loc, coords)
      }))

      if (coordsMap.size === 0) { setLoading(false); return }

      clearMarkers()

      // Group days by location
      const daysByLocation = new Map<string, DayPlan[]>()
      dayPlans.forEach(d => {
        if (!daysByLocation.has(d.location_base)) daysByLocation.set(d.location_base, [])
        daysByLocation.get(d.location_base)!.push(d)
      })

      // Add a marker per location
      locationOrder.forEach((loc, locIdx) => {
        const coords = coordsMap.get(loc)
        if (!coords || !map.current) return
        const color = LOCATION_COLORS[locIdx % LOCATION_COLORS.length]
        const days = daysByLocation.get(loc) ?? []
        const dayNums = days.map(d => d.day_number)
        const dayLabel = dayNums.length === 1
          ? `Day ${dayNums[0]}`
          : `Days ${dayNums[0]}–${dayNums[dayNums.length - 1]}`

        // Circle marker with day range label
        const el = document.createElement('div')
        el.style.cssText = `
          background: ${color};
          color: white;
          border: 2.5px solid white;
          border-radius: 20px;
          padding: 3px 9px;
          font-size: 11px;
          font-weight: 700;
          white-space: nowrap;
          box-shadow: 0 2px 8px rgba(0,0,0,0.22);
          cursor: pointer;
          font-family: inherit;
          letter-spacing: 0.01em;
        `
        el.textContent = dayLabel

        const popup = new mapboxgl.Popup({ offset: 10, closeButton: false })
          .setHTML(`
            <div style="font-family:inherit;padding:4px 2px">
              <div style="font-weight:700;font-size:13px;color:#1a2a3a">${loc}</div>
              <div style="font-size:11px;color:#6b7280;margin-top:2px">${dayLabel}</div>
            </div>
          `)

        const marker = new mapboxgl.Marker(el)
          .setLngLat(coords)
          .setPopup(popup)
          .addTo(map.current!)
        markersRef.current.push(marker)
      })

      // Fit to all pinned locations
      const allCoords = [...coordsMap.values()]
      if (allCoords.length > 1) {
        const bounds = allCoords.reduce(
          (b, c) => b.extend(c),
          new mapboxgl.LngLatBounds(allCoords[0], allCoords[0])
        )
        map.current.fitBounds(bounds, { padding: 60, maxZoom: 8, duration: 0 })
      } else if (allCoords.length === 1) {
        map.current.setCenter(allCoords[0])
        map.current.setZoom(10)
      }

      setLoading(false)
    })

    return () => {
      clearMarkers()
      map.current?.remove()
      map.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--color-border)', marginBottom: 20 }}>
      <div ref={mapContainer} style={{ height: 380, width: '100%' }} />
      {loading && (
        <div style={{ position: 'absolute', inset: 0, background: '#f0f4f8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#6b7280' }}>
          Loading map…
        </div>
      )}
    </div>
  )
}
