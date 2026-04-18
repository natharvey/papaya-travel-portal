import { usePlacePhoto } from '../hooks/usePlacePhoto'
import type { HotelSuggestion } from '../types'

interface HotelCardProps {
  hotel: HotelSuggestion
  status?: 'suggestion' | 'saved' | 'dismissed'
  isTopSuggestion?: boolean
  onClick: () => void
  onSave?: () => void
  onDismiss?: () => void
}

export default function HotelCard({ hotel, status = 'suggestion', isTopSuggestion = false, onClick, onSave, onDismiss }: HotelCardProps) {
  const hasEnrichedData = hotel.photo_url !== undefined
  const live = usePlacePhoto(
    hasEnrichedData ? '' : hotel.name,
    hasEnrichedData ? '' : hotel.destination,
  )
  const photoUrl = hotel.photo_url ?? live.photoUrl
  const rating = hotel.rating ?? live.rating
  const loading = hasEnrichedData ? false : live.loading
  const isSaved = status === 'saved'

  return (
    <div
      onClick={onClick}
      className="hotel-card"
      style={{
        border: isTopSuggestion ? '1.5px solid #d4a017' : '1.5px solid var(--color-border)',
        borderRadius: 14,
        overflow: 'hidden',
        background: 'var(--color-bg)',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',           // fills the grid cell height — all cells in a row are equal
        transition: 'box-shadow 0.15s',
        boxShadow: isTopSuggestion ? '0 0 0 1px rgba(212,160,23,0.15)' : undefined,
      }}
    >
      {/* Photo */}
      <div style={{ position: 'relative', width: '100%', height: 140, background: '#F3F4F6', flexShrink: 0 }}>
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

        {/* Star / save button — top left */}
        {onSave && (
          <button
            onClick={(e) => { e.stopPropagation(); onSave() }}
            title={isSaved ? 'Remove from saved' : 'Save this hotel'}
            style={{
              position: 'absolute', top: 8, left: 8,
              width: 30, height: 30, borderRadius: '50%',
              background: isSaved ? '#FEF3C7' : 'rgba(0,0,0,0.45)',
              border: isSaved ? '1.5px solid #F59E0B' : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontSize: 15,
              transition: 'all 0.15s',
            }}
          >
            {isSaved ? '★' : '☆'}
          </button>
        )}

        {/* Dismiss button — top right */}
        {onDismiss && (
          <button
            onClick={(e) => { e.stopPropagation(); onDismiss() }}
            title="Remove suggestion"
            style={{
              position: 'absolute', top: 8, right: 8,
              width: 26, height: 26, borderRadius: '50%',
              background: 'rgba(0,0,0,0.45)', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'white', fontSize: 13, lineHeight: 1,
              transition: 'background 0.15s',
            }}
          >
            ✕
          </button>
        )}

        {/* Rating badge */}
        {rating && (
          <div style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,0.55)', color: 'white', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
            ★ {rating.toFixed(1)}
          </div>
        )}
      </div>

      {/* Info — flex: 1 so all cards in a row share the same height */}
      <div style={{ padding: '12px 14px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-text)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hotel.name}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{hotel.area} · {hotel.style}</div>
          </div>
          {hotel.price_per_night_aud && (
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--color-primary)', whiteSpace: 'nowrap', flexShrink: 0 }}>
              ~${hotel.price_per_night_aud}<span style={{ fontWeight: 400, fontSize: 11, color: 'var(--color-text-muted)' }}>/night</span>
            </div>
          )}
        </div>
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '8px 0 0', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', flex: 1 }}>{hotel.why_suits}</p>
      </div>
    </div>
  )
}
