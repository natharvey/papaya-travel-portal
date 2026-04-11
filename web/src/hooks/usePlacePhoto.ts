import { useState, useEffect } from 'react'

const PLACES_API_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY || ''
const cache = new Map<string, { photoUrl: string | null; placeId: string | null; rating: number | null; website: string | null; address: string | null }>()

export interface PlaceData {
  photoUrl: string | null
  placeId: string | null
  rating: number | null
  website: string | null
  address: string | null
}

async function fetchPlaceData(query: string): Promise<PlaceData> {
  if (!PLACES_API_KEY) return { photoUrl: null, placeId: null, rating: null, website: null, address: null }
  if (cache.has(query)) return cache.get(query)!

  try {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': PLACES_API_KEY,
        'X-Goog-FieldMask': 'places.id,places.photos,places.rating,places.websiteUri,places.formattedAddress',
      },
      body: JSON.stringify({ textQuery: query, maxResultCount: 1 }),
    })
    const data = await res.json()
    const place = data.places?.[0]
    if (!place) {
      cache.set(query, { photoUrl: null, placeId: null, rating: null, website: null, address: null })
      return cache.get(query)!
    }

    const photoRef = place.photos?.[0]?.name
    const photoUrl = photoRef
      ? `https://places.googleapis.com/v1/${photoRef}/media?maxHeightPx=480&maxWidthPx=640&key=${PLACES_API_KEY}`
      : null

    const result = {
      photoUrl,
      placeId: place.id ?? null,
      rating: place.rating ?? null,
      website: place.websiteUri ?? null,
      address: place.formattedAddress ?? null,
    }
    cache.set(query, result)
    return result
  } catch {
    cache.set(query, { photoUrl: null, placeId: null, rating: null, website: null, address: null })
    return cache.get(query)!
  }
}

export function usePlacePhoto(hotelName: string, destination: string): PlaceData & { loading: boolean } {
  const query = `${hotelName} ${destination}`
  const [data, setData] = useState<PlaceData>({ photoUrl: null, placeId: null, rating: null, website: null, address: null })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (cache.has(query)) {
      setData(cache.get(query)!)
      setLoading(false)
      return
    }
    setLoading(true)
    fetchPlaceData(query).then(d => {
      setData(d)
      setLoading(false)
    })
  }, [query])

  return { ...data, loading }
}
