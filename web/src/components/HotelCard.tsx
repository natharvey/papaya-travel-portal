import { usePlacePhoto } from '../hooks/usePlacePhoto'
import type { HotelSuggestion } from '../types'

interface HotelCardProps {
  hotel: HotelSuggestion
  onClick: () => void
}

export default function HotelCard({ hotel, onClick }: HotelCardProps) {
  const hasEnrichedData = hotel.photo_url !== undefined
  const live = usePlacePhoto(
    hasEnrichedData ? '' : hotel.name,
    hasEnrichedData ? '' : hotel.destination,
  )
  const photoUrl = hotel.photo_url ?? live.photoUrl
  const rating = hotel.rating ?? live.rating
  const loading = hasEnrichedData ? false : live.loading

  return (
    <div onClick={onClick} className="hotel-card" style={{ border: '1.5px solid var(--color-border)', borderRadius: 14, overflow: 'hidden', background: 'var(--color-bg)' }}>
      {/* Photo */}
      <div style={{ position: 'relative', width: '100%', height: 140, background: 'var(--color-bg)' }}>
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 22, height: 22, border: '3px solid var(--color-border)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        )}
        {!loading && photoUrl && (
          <img src={photoUrl} alt={hotel.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
        {!loading && !photoUrl && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>🏨</div>
        )}
        {rating && (
          <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.55)', color: 'white', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
            ★ {rating.toFixed(1)}
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-text)', marginBottom: 2 }}>{hotel.name}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{hotel.area} · {hotel.style}</div>
          </div>
          {hotel.price_per_night_aud && (
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--color-primary)', whiteSpace: 'nowrap', flexShrink: 0 }}>
              ~${hotel.price_per_night_aud}<span style={{ fontWeight: 400, fontSize: 11, color: 'var(--color-text-muted)' }}>/night</span>
            </div>
          )}
        </div>
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '8px 0 0', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{hotel.why_suits}</p>
      </div>
    </div>
  )
}
