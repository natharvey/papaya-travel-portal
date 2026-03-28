import { Link } from 'react-router-dom'
import { PlaneTakeoff, Calendar, Wallet, Gauge } from 'lucide-react'
import type { TripWithLatestItinerary, AdminTripListItem } from '../types'

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  INTAKE: { bg: '#EEF2FF', text: '#4F46E5' },
  DRAFT: { bg: '#FFF7ED', text: '#C2410C' },
  REVIEW: { bg: '#FEF9C3', text: '#A16207' },
  CONFIRMED: { bg: '#DCFCE7', text: '#15803D' },
  ARCHIVED: { bg: '#F3F4F6', text: '#6B7280' },
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

export default function TripCard({ trip, linkTo, showClient, clientName, clientEmail }: TripCardProps) {
  const statusColors = STATUS_COLORS[trip.status] || STATUS_COLORS.INTAKE
  const tripWithItinerary = trip as TripWithLatestItinerary
  const hasItinerary = tripWithItinerary.latest_itinerary != null

  return (
    <Link to={linkTo} style={{ textDecoration: 'none', display: 'block' }}>
      <div
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px',
          cursor: 'pointer',
          transition: 'box-shadow 0.2s, transform 0.2s',
          boxShadow: 'var(--shadow-sm)',
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLDivElement
          el.style.boxShadow = 'var(--shadow-md)'
          el.style.transform = 'translateY(-2px)'
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLDivElement
          el.style.boxShadow = 'var(--shadow-sm)'
          el.style.transform = 'translateY(0)'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
          <div style={{ flex: 1, marginRight: '12px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '4px' }}>
              {trip.title}
            </h3>
            {showClient && (clientName || clientEmail) && (
              <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                {clientName} · {clientEmail}
              </p>
            )}
          </div>
          <span style={{
            background: statusColors.bg,
            color: statusColors.text,
            padding: '3px 10px',
            borderRadius: '100px',
            fontSize: '12px',
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}>
            {trip.status}
          </span>
        </div>

        {/* Meta */}
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '12px' }}>
          <span style={{ fontSize: '13px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <PlaneTakeoff size={13} strokeWidth={2} /> {trip.origin_city}
          </span>
          <span style={{ fontSize: '13px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Calendar size={13} strokeWidth={2} /> {formatDate(trip.start_date)} – {formatDate(trip.end_date)}
          </span>
          <span style={{ fontSize: '13px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Wallet size={13} strokeWidth={2} /> {trip.budget_range}
          </span>
          <span style={{ fontSize: '13px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Gauge size={13} strokeWidth={2} /> {trip.pace}
          </span>
        </div>

        {/* Itinerary status */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{
            fontSize: '12px',
            color: hasItinerary ? 'var(--color-success)' : 'var(--color-text-muted)',
            fontWeight: hasItinerary ? 600 : 400,
          }}>
            {hasItinerary
              ? `✓ Itinerary v${tripWithItinerary.latest_itinerary!.version} ready`
              : '⏳ Itinerary pending'}
          </span>
          <span style={{
            fontSize: '12px',
            color: 'var(--color-primary)',
            fontWeight: 500,
          }}>
            View details →
          </span>
        </div>
      </div>
    </Link>
  )
}
