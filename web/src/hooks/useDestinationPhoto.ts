import { useState, useEffect } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

const cache = new Map<string, string | null>()

export function useDestinationPhoto(destination: string): { photoUrl: string | null; loading: boolean } {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!destination) { setLoading(false); return }

    if (cache.has(destination)) {
      setPhotoUrl(cache.get(destination) ?? null)
      setLoading(false)
      return
    }

    const token = localStorage.getItem('papaya_token') || ''
    setLoading(true)

    fetch(
      `${API_BASE}/client/destination-photo?destination=${encodeURIComponent(destination)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const url = data?.photo_url ?? null
        cache.set(destination, url)
        setPhotoUrl(url)
      })
      .catch(() => {
        cache.set(destination, null)
        setPhotoUrl(null)
      })
      .finally(() => setLoading(false))
  }, [destination])

  return { photoUrl, loading }
}
