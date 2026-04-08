import { Link } from 'react-router-dom'
import { PlaneTakeoff, Calendar, Wallet, Gauge, Timer } from 'lucide-react'
import type { TripWithLatestItinerary, AdminTripListItem } from '../types'

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  INTAKE:    { bg: '#EEF2FF', text: '#4338CA', label: 'Intake' },
  DRAFT:     { bg: 'var(--color-accent)', text: 'var(--color-primary-dark)', label: 'Draft' },
  REVIEW:    { bg: '#FFFBEB', text: '#B45309', label: 'In Review' },
  CONFIRMED: { bg: '#F0FDF6', text: '#166534', label: 'Confirmed' },
  ARCHIVED:  { bg: '#F8F8F8', text: '#6B7280', label: 'Archived' },
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

export default function TripCard({ trip, linkTo, showClient, clientName, clientEmail }: TripCardProps) {
  const config = STATUS_CONFIG[trip.status] || STATUS_CONFIG.INTAKE
  const tripWithItinerary = trip as TripWithLatestItinerary
  const hasItinerary = tripWithItinerary.latest_itinerary != null

  return (
    <Link to={linkTo} style={{ textDecoration: 'none', display: 'block' }}>
      <div
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '22px 24px',
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
          <div style={{ flex: 1, marginRight: '12px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '4px', letterSpacing: '-0.1px' }}>
              {trip.title}
            </h3>
            {showClient && (clientName || clientEmail) && (
              <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                {clientName} · {clientEmail}
              </p>
            )}
          </div>
          <span style={{
            background: config.bg,
            color: config.text,
            padding: '4px 12px',
            borderRadius: '100px',
            fontSize: '12px',
            fontWeight: 700,
            whiteSpace: 'nowrap',
            letterSpacing: '0.1px',
          }}>
            {config.label}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '14px' }}>
          {[
            { Icon: PlaneTakeoff, text: trip.origin_city },
            { Icon: Calendar, text: `${formatDate(trip.start_date)} – ${formatDate(trip.end_date)}` },
            { Icon: Wallet, text: trip.budget_range },
            { Icon: Gauge, text: trip.pace },
          ].map(({ Icon, text }) => (
            <span key={text} style={{ fontSize: '13px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Icon size={13} strokeWidth={2} />
              {text}
            </span>
          ))}
        </div>

        {trip.status !== 'ARCHIVED' && (
          <div style={{ marginBottom: '14px' }}>
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
    </Link>
  )
}
