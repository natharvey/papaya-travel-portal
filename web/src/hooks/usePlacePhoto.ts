import { useState, useEffect } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

// Cache keyed by query string
const cache = new Map<string, PlaceData>()

export interface PlaceData {
  photoUrl: string | null
  placeId: string | null
  rating: number | null
  website: string | null
  address: string | null
}

async function fetchPlaceData(query: string, token: string): Promise<PlaceData> {
  if (cache.has(query)) return cache.get(query)!

  try {
    const res = await fetch(
      `${API_BASE}/client/place-lookup?query=${encodeURIComponent(query)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    const result: PlaceData = {
      photoUrl: data.photo_url ?? null,
      placeId: data.place_id ?? null,
      rating: data.rating ?? null,
      website: data.website ?? null,
      address: data.address ?? null,
    }
    cache.set(query, result)
    return result
  } catch {
    const empty: PlaceData = { photoUrl: null, placeId: null, rating: null, website: null, address: null }
    cache.set(query, empty)
    return empty
  }
}

export function usePlacePhoto(hotelName: string, destination: string): PlaceData & { loading: boolean } {
  const query = `${hotelName} ${destination}`
  const [data, setData] = useState<PlaceData>({ photoUrl: null, placeId: null, rating: null, website: null, address: null })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!hotelName) { setLoading(false); return }

    const token = localStorage.getItem('papaya_token') || ''

    if (cache.has(query)) {
      setData(cache.get(query)!)
      setLoading(false)
      return
    }
    setLoading(true)
    fetchPlaceData(query, token).then(d => {
      setData(d)
      setLoading(false)
    })
  }, [query, hotelName])

  return { ...data, loading }
}
