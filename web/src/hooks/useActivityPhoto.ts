const API_BASE = import.meta.env.VITE_API_URL || '/api'

// Cache: cacheKey → ordered candidate URLs
const candidateCache = new Map<string, string[]>()

function cacheKey(title: string, location: string, photoQuery?: string): string {
  return photoQuery ? `pq:${photoQuery}` : `${title} ${location}`
}

export async function fetchActivityCandidates(
  title: string,
  location: string,
  photoQuery?: string,
): Promise<string[]> {
  const key = cacheKey(title, location, photoQuery)
  if (candidateCache.has(key)) return candidateCache.get(key)!

  const searchTitle = photoQuery ?? title
  const params = `title=${encodeURIComponent(searchTitle)}&location=${encodeURIComponent(location)}`
  const token = localStorage.getItem('papaya_token') || ''
  try {
    const resp = await fetch(`${API_BASE}/client/activity-photo?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = resp.ok ? await resp.json() : null
    const candidates: string[] = data?.candidates ?? []
    candidateCache.set(key, candidates)
    return candidates
  } catch {
    candidateCache.set(key, [])
    return []
  }
}
