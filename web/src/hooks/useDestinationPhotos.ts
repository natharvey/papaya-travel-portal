import { useState, useEffect } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

// Cache key is the sorted, joined destination list
const cache = new Map<string, (string | null)[]>()

/**
 * Fetches hero photos for up to 3 destinations in a single batch call,
 * with the server ensuring no two photos share the same scene type
 * (e.g. no two mountain shots, no two city skylines).
 */
export function useDestinationPhotos(destinations: string[]): {
  photos: (string | null)[]
  loading: boolean
} {
  const key = destinations.filter(Boolean).join(',')
  const [photos, setPhotos] = useState<(string | null)[]>(() => cache.get(key) ?? destinations.map(() => null))
  const [loading, setLoading] = useState(!cache.has(key))

  useEffect(() => {
    if (!key) {
      setPhotos([])
      setLoading(false)
      return
    }

    if (cache.has(key)) {
      setPhotos(cache.get(key)!)
      setLoading(false)
      return
    }

    const token = localStorage.getItem('papaya_token') || ''
    const role = localStorage.getItem('papaya_role') || ''
    const endpoint =
      role === 'admin'
        ? `${API_BASE}/admin/destination-photos?destinations=${encodeURIComponent(key)}`
        : `${API_BASE}/client/destination-photos?destinations=${encodeURIComponent(key)}`

    setLoading(true)
    fetch(endpoint, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : null))
      .then((data: Record<string, string | null> | null) => {
        // Map back in the same order as the input destinations array
        const result = destinations.map(d => (d ? (data?.[d] ?? null) : null))
        cache.set(key, result)
        setPhotos(result)
      })
      .catch(() => {
        const fallback = destinations.map(() => null)
        cache.set(key, fallback)
        setPhotos(fallback)
      })
      .finally(() => setLoading(false))
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  return { photos, loading }
}
