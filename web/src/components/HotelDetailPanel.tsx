import { useEffect } from 'react'
import { X, Star, ExternalLink, MapPin, Globe, DollarSign } from 'lucide-react'
import type { HotelSuggestion } from '../types'
import { usePlacePhoto } from '../hooks/usePlacePhoto'

interface Props {
  hotel: HotelSuggestion | null
  onClose: () => void
}

function StarRating({ rating }: { rating: number }) {
  const full = Math.floor(rating)
  const half = rating - full >= 0.5
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <div style={{ display: 'flex', gap: 2 }}>
        {[1, 2, 3, 4, 5].map(i => (
          <Star
            key={i}
            size={13}
            fill={i <= full ? '#F59E0B' : i === full + 1 && half ? 'url(#half)' : 'none'}
            color={i <= full || (i === full + 1 && half) ? '#F59E0B' : '#D1D5DB'}
          />
        ))}
      </div>
      <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{rating.toFixed(1)}</span>
    </div>
  )
}

export default function HotelDetailPanel({ hotel, onClose }: Props) {
  const { photoUrl, rating, website, address, loading } = usePlacePhoto(
    hotel?.name ?? '',
    hotel?.destination ?? ''
  )

  // Close on Escape
  useEffect(() => {
    if (!hotel) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hotel, onClose])

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.35)',
          zIndex: 900,
          opacity: hotel ? 1 : 0,
          pointerEvents: hotel ? 'auto' : 'none',
          transition: 'opacity 0.25s',
        }}
      />

      {/* Slide-in panel */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 420,
          maxWidth: '100vw',
          background: 'var(--color-bg)',
          boxShadow: '-8px 0 40px rgba(0,0,0,0.15)',
          zIndex: 901,
          display: 'flex',
          flexDirection: 'column',
          transform: hotel ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          overflowY: 'auto',
        }}
      >
        {hotel && (
          <>
            {/* Hero image */}
            <div style={{ position: 'relative', width: '100%', height: 240, background: '#F3F4F6', flexShrink: 0 }}>
              {loading && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: 28, height: 28, border: '3px solid #E5E7EB', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                </div>
              )}
              {!loading && photoUrl && (
                <img
                  src={photoUrl}
                  alt={hotel.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              )}
              {!loading && !photoUrl && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 36, marginBottom: 6 }}>🏨</div>
                    <div style={{ fontSize: 12 }}>No photo available</div>
                  </div>
                </div>
              )}

              {/* Close button */}
              <button
                onClick={onClose}
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: 'rgba(0,0,0,0.5)',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'white',
                }}
              >
                <X size={18} />
              </button>

              {/* Destination badge */}
              <div style={{
                position: 'absolute',
                bottom: 12,
                left: 12,
                background: 'rgba(0,0,0,0.55)',
                color: 'white',
                fontSize: 11,
                fontWeight: 600,
                padding: '4px 10px',
                borderRadius: 20,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}>
                {hotel.destination}
              </div>
            </div>

            {/* Content */}
            <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Name + price */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-text)', margin: '0 0 4px' }}>{hotel.name}</h2>
                  <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{hotel.area} · {hotel.style}</div>
                </div>
                {hotel.price_per_night_aud && (
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-primary)' }}>
                      ${hotel.price_per_night_aud}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 500 }}>per night</div>
                  </div>
                )}
              </div>

              {/* Rating from Places */}
              {rating && <StarRating rating={rating} />}

              {/* Address */}
              {address && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: 'var(--color-text-muted)' }}>
                  <MapPin size={14} style={{ marginTop: 2, flexShrink: 0 }} />
                  <span>{address}</span>
                </div>
              )}

              {/* Why it suits */}
              <div style={{ background: '#F9FAFB', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Why it suits you</div>
                <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.6, margin: 0 }}>{hotel.why_suits}</p>
              </div>

              {/* CTAs */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <a
                  href={hotel.booking_com_search}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    background: 'var(--color-primary)',
                    color: 'white',
                    borderRadius: 10,
                    padding: '13px 20px',
                    fontSize: 14,
                    fontWeight: 700,
                    textDecoration: 'none',
                  }}
                >
                  <DollarSign size={15} />
                  Check availability on Booking.com
                  <ExternalLink size={13} />
                </a>

                <div style={{ display: 'flex', gap: 10 }}>
                  <a
                    href={hotel.google_maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      border: '1.5px solid var(--color-border)',
                      borderRadius: 10,
                      padding: '11px 16px',
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--color-text-muted)',
                      textDecoration: 'none',
                    }}
                  >
                    <MapPin size={13} /> View on Maps
                  </a>

                  {website && (
                    <a
                      href={website}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        border: '1.5px solid var(--color-border)',
                        borderRadius: 10,
                        padding: '11px 16px',
                        fontSize: 13,
                        fontWeight: 600,
                        color: 'var(--color-text-muted)',
                        textDecoration: 'none',
                      }}
                    >
                      <Globe size={13} /> Website
                    </a>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  )
}
