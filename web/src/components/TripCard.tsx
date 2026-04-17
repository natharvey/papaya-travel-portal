import { Link } from 'react-router-dom'
import { PlaneTakeoff, Calendar, Wallet, Timer } from 'lucide-react'
import type { TripWithLatestItinerary, AdminTripListItem } from '../types'
import { useDestinationPhotos } from '../hooks/useDestinationPhotos'

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  GENERATING: { bg: '#F5F3FF', text: '#6D28D9', label: 'Generating' },
  ACTIVE:     { bg: '#F0FDF6', text: '#166534', label: 'Active' },
  COMPLETED:  { bg: '#F8F8F8', text: '#6B7280', label: 'Completed' },
}

interface TripCardProps {
  trip: TripWithLatestItinerary | AdminTripListItem
  linkTo: string
  showClient?: boolean
  clientName?: string
  clientEmail?: string
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function getDaysUntilTrip(startDate: string): number | null {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tripStart = new Date(startDate)
  tripStart.setHours(0, 0, 0, 0)
  const diffMs = tripStart.getTime() - today.getTime()
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}

function CountdownBadge({ startDate }: { startDate: string }) {
  const days = getDaysUntilTrip(startDate)
  if (days === null || days < 0) return null

  let label: string
  let bg: string
  let color: string

  if (days === 0) {
    label = 'Trip starts today!'
    bg = '#F0FDF6'
    color = '#166534'
  } else if (days <= 7) {
    label = `${days} day${days === 1 ? '' : 's'} until your trip`
    bg = 'var(--color-accent)'
    color = 'var(--color-primary-dark)'
  } else if (days <= 30) {
    label = `${days} days until your trip`
    bg = '#FFFBEB'
    color = '#B45309'
  } else {
    label = `${days} days until your trip`
    bg = '#EEF2FF'
    color = '#4338CA'
  }

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '5px',
      background: bg,
      color: color,
      padding: '4px 10px',
      borderRadius: '100px',
      fontSize: '12px',
      fontWeight: 600,
    }}>
      <Timer size={12} strokeWidth={2.5} />
      {label}
    </div>
  )
}

/** Derive a clean display title from destinations, e.g. "Dubai", "Tokyo & Kyoto", "Paris, Rome & 2 more" */
function buildDisplayTitle(destinations: { name: string }[]): string {
  if (!destinations || destinations.length === 0) return ''
  const names = destinations.map(d => d.name)
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]} & ${names[1]}`
  if (names.length === 3) return `${names[0]}, ${names[1]} & ${names[2]}`
  // 4+: show first two + count
  return `${names[0]}, ${names[1]} & ${names.length - 2} more`
}

export default function TripCard({ trip, linkTo, showClient, clientName, clientEmail }: TripCardProps) {
  const config = STATUS_CONFIG[trip.status] || STATUS_CONFIG.GENERATING
  const tripWithItinerary = trip as TripWithLatestItinerary
  const hasItinerary = tripWithItinerary.latest_itinerary != null

  const destinations: { name: string }[] =
    tripWithItinerary.latest_itinerary?.itinerary_json?.destinations ?? []

  // Up to 3 destination names for photo fetching
  const destNames = destinations.slice(0, 3).map(d => d.name).filter(Boolean)
  // Fallback to trip.title if no itinerary destinations yet
  const photoQueryList = destNames.length > 0 ? destNames : [trip.title]
  const { photos } = useDestinationPhotos(photoQueryList)

  const displayTitle = destinations.length > 0
    ? buildDisplayTitle(destinations)
    : trip.title

  const photoCount = photos.filter(Boolean).length
  const hasPhotos = photoCount > 0

  return (
    <Link to={linkTo} style={{ textDecoration: 'none', display: 'block' }}>
      <div
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          cursor: 'pointer',
          transition: 'box-shadow 0.2s, transform 0.2s, border-color 0.2s',
          boxShadow: 'var(--shadow-sm)',
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLDivElement
          el.style.boxShadow = 'var(--shadow-md)'
          el.style.transform = 'translateY(-2px)'
          el.style.borderColor = 'var(--color-primary)'
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLDivElement
          el.style.boxShadow = 'var(--shadow-sm)'
          el.style.transform = 'translateY(0)'
          el.style.borderColor = 'var(--color-border)'
        }}
      >
        {/* Hero photo banner — splits into panels for multi-destination trips */}
        <div style={{
          position: 'relative',
          height: 150,
          background: !hasPhotos ? 'linear-gradient(135deg, #2D4A5A 0%, #1a2d38 100%)' : undefined,
          overflow: 'hidden',
          display: 'flex',
        }}>
          {hasPhotos ? (
            photos.map((url, i) => {
              if (!url) return null
              const validPhotos = photos.filter(Boolean)
              const panelCount = validPhotos.length
              return (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    position: 'relative',
                    overflow: 'hidden',
                    // Thin divider between panels
                    borderLeft: i > 0 ? '1.5px solid rgba(255,255,255,0.25)' : undefined,
                  }}
                >
                  <img
                    src={url}
                    alt={photoQueryList[i] ?? ''}
                    style={{
                      width: '100%', height: '100%', objectFit: 'cover',
                      filter: 'saturate(1.3) brightness(1.05) contrast(1.05)',
                      // For side panels, zoom in slightly so they feel intentional, not cropped
                      transform: panelCount > 1 ? 'scale(1.08)' : undefined,
                      transition: 'transform 0.4s ease',
                    }}
                  />
                  {/* Per-panel destination label for multi-dest cards */}
                  {panelCount > 1 && photoQueryList[i] && (
                    <div style={{
                      position: 'absolute', top: 8, left: 8,
                      fontSize: 9, fontWeight: 700, color: 'white',
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                      textShadow: '0 1px 4px rgba(0,0,0,0.6)',
                      background: 'rgba(0,0,0,0.25)',
                      padding: '2px 6px', borderRadius: 4,
                      backdropFilter: 'blur(4px)',
                    }}>
                      {photoQueryList[i]}
                    </div>
                  )}
                </div>
              )
            })
          ) : null}

          {/* Gradient overlay (bottom) */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.6) 100%)',
            pointerEvents: 'none',
          }} />

          {/* Status badge */}
          <span style={{
            position: 'absolute', top: 12, right: 14,
            background: config.bg,
            color: config.text,
            padding: '4px 12px',
            borderRadius: '100px',
            fontSize: '12px',
            fontWeight: 700,
            letterSpacing: '0.1px',
            backdropFilter: 'blur(4px)',
          }}>
            {config.label}
          </span>

          {/* Title overlaid at bottom of photo */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px 20px 14px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'white', margin: 0, letterSpacing: '-0.2px', textShadow: '0 1px 8px rgba(0,0,0,0.4)' }}>
              {displayTitle}
            </h3>
            {showClient && (clientName || clientEmail) && (
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', margin: '2px 0 0' }}>
                {clientName} · {clientEmail}
              </p>
            )}
          </div>
        </div>

        {/* Card content */}
        <div style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '12px' }}>
            {[
              { Icon: PlaneTakeoff, text: trip.origin_city },
              { Icon: Calendar, text: `${formatDate(trip.start_date)} – ${formatDate(trip.end_date)}` },
              { Icon: Wallet, text: `$${trip.budget_range}` },
            ].map(({ Icon, text }) => (
              <span key={text} style={{ fontSize: '13px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Icon size={13} strokeWidth={2} />
                {text}
              </span>
            ))}
          </div>

          {trip.status !== 'COMPLETED' && (
            <div style={{ marginBottom: '12px' }}>
              <CountdownBadge startDate={trip.start_date} />
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid var(--color-border)' }}>
            <span style={{
              fontSize: '12px',
              color: hasItinerary ? 'var(--color-success)' : 'var(--color-text-muted)',
              fontWeight: hasItinerary ? 600 : 400,
            }}>
              {hasItinerary
                ? `✓ Itinerary v${tripWithItinerary.latest_itinerary!.version} ready`
                : 'Itinerary pending'}
            </span>
            <span style={{ fontSize: '13px', color: 'var(--color-primary)', fontWeight: 600 }}>
              View details →
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}
