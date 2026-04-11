import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { User, Mail, PlaneTakeoff, Calendar } from 'lucide-react'
import Layout from '../components/Layout'
import LoadingSpinner from '../components/LoadingSpinner'
import { getAdminTrips, getApiError } from '../api/client'
import type { AdminTripListItem, TripStatus } from '../types'

const STATUSES: TripStatus[] = ['GENERATING', 'INTAKE', 'DRAFT', 'REVIEW', 'CONFIRMED', 'ARCHIVED']

const STATUS_CONFIG: Record<string, { bg: string; text: string; border: string; label: string }> = {
  GENERATING: { bg: '#F5F3FF', text: '#6D28D9', border: '#DDD6FE', label: 'Generating' },
  INTAKE:    { bg: '#EEF2FF', text: '#4338CA', border: '#C7D2FE', label: 'Intake' },
  DRAFT:     { bg: 'var(--color-accent)', text: 'var(--color-primary-dark)', border: '#FCD9B8', label: 'Draft' },
  REVIEW:    { bg: '#FFFBEB', text: '#B45309', border: '#FDE68A', label: 'In Review' },
  CONFIRMED: { bg: '#F0FDF6', text: '#166534', border: '#A7F0C4', label: 'Confirmed' },
  ARCHIVED:  { bg: '#F8F8F8', text: '#6B7280', border: '#E5E7EB', label: 'Archived' },
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

function TripKanbanCard({ trip }: { trip: AdminTripListItem }) {
  const tripDays = Math.ceil(
    (new Date(trip.end_date).getTime() - new Date(trip.start_date).getTime()) / (1000 * 60 * 60 * 24)
  )
  return (
    <Link to={`/admin/trips/${trip.id}`} style={{ textDecoration: 'none' }}>
      <div
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius)',
          padding: '14px 16px',
          marginBottom: '10px',
          cursor: 'pointer',
          transition: 'box-shadow 0.2s, border-color 0.2s',
          boxShadow: 'var(--shadow-sm)',
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLDivElement
          el.style.boxShadow = 'var(--shadow-md)'
          el.style.borderColor = 'var(--color-primary)'
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLDivElement
          el.style.boxShadow = 'var(--shadow-sm)'
          el.style.borderColor = 'var(--color-border)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', gap: '8px' }}>
          <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--color-text)', lineHeight: '1.3' }}>
            {trip.title}
          </div>
          {trip.unread_count > 0 && (
            <span style={{
              background: '#EF4444',
              color: 'white',
              borderRadius: '100px',
              fontSize: '11px',
              fontWeight: 700,
              padding: '2px 7px',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}>
              {trip.unread_count} new
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '2px' }}>
          <User size={11} strokeWidth={2} />
          {trip.client_name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '10px' }}>
          <Mail size={11} strokeWidth={2} />
          {trip.client_email}
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', paddingTop: '8px', borderTop: '1px solid var(--color-border)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--color-text-muted)' }}>
            <PlaneTakeoff size={11} strokeWidth={2} />
            {trip.origin_city}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--color-text-muted)' }}>
            <Calendar size={11} strokeWidth={2} />
            {formatDate(trip.start_date)} · {tripDays}d
          </span>
        </div>
      </div>
    </Link>
  )
}

export default function AdminDashboardPage() {
  const [trips, setTrips] = useState<AdminTripListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<string>('ALL')

  useEffect(() => {
    getAdminTrips()
      .then(setTrips)
      .catch(e => setError(getApiError(e)))
      .finally(() => setLoading(false))
  }, [])

  const filteredTrips = filter === 'ALL' ? trips : trips.filter(t => t.status === filter)

  const tripsByStatus = STATUSES.reduce<Record<string, AdminTripListItem[]>>((acc, s) => {
    acc[s] = trips.filter(t => t.status === s)
    return acc
  }, {} as Record<string, AdminTripListItem[]>)

  return (
    <Layout variant="admin">
      <div style={{ padding: '40px 28px 80px', maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--color-text)', marginBottom: '6px', letterSpacing: '-0.4px' }}>
            Trip Dashboard
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '15px' }}>
            {trips.length} total trip{trips.length !== 1 ? 's' : ''} across all statuses
          </p>
        </div>

        {loading && <LoadingSpinner label="Loading trips..." />}

        {!loading && error && (
          <div style={{
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: 'var(--radius-lg)',
            padding: '16px',
            color: '#B91C1C',
          }}>
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Filter pills */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '32px', flexWrap: 'wrap' }}>
              {(['ALL', ...STATUSES] as const).map(s => {
                const isActive = filter === s
                const config = s === 'ALL' ? null : STATUS_CONFIG[s]
                const count = s === 'ALL' ? trips.length : (tripsByStatus[s]?.length || 0)
                return (
                  <button
                    key={s}
                    onClick={() => setFilter(s)}
                    style={{
                      background: isActive
                        ? (s === 'ALL' ? 'var(--color-secondary)' : config!.bg)
                        : 'var(--color-surface)',
                      color: isActive
                        ? (s === 'ALL' ? 'white' : config!.text)
                        : 'var(--color-text-muted)',
                      border: `1.5px solid ${isActive
                        ? (s === 'ALL' ? 'var(--color-secondary)' : config!.border)
                        : 'var(--color-border)'}`,
                      borderRadius: '100px',
                      padding: '6px 16px',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      fontFamily: 'inherit',
                    }}
                  >
                    {s === 'ALL' ? 'All' : config!.label}{' '}
                    <span style={{ marginLeft: '4px', opacity: 0.65 }}>{count}</span>
                  </button>
                )
              })}
            </div>

            {/* Kanban view */}
            {filter === 'ALL' ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '16px' }}>
                {STATUSES.filter(s => s !== 'ARCHIVED').map(status => {
                  const statusTrips = tripsByStatus[status] || []
                  const config = STATUS_CONFIG[status]
                  return (
                    <div key={status}>
                      <div style={{
                        background: config.bg,
                        borderRadius: 'var(--radius)',
                        padding: '10px 14px',
                        marginBottom: '12px',
                        border: `1.5px solid ${config.border}`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}>
                        <span style={{ fontWeight: 700, fontSize: '12px', color: config.text, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                          {config.label}
                        </span>
                        <span style={{
                          background: config.text,
                          color: 'white',
                          borderRadius: '100px',
                          padding: '2px 8px',
                          fontSize: '11px',
                          fontWeight: 700,
                        }}>
                          {statusTrips.length}
                        </span>
                      </div>
                      {statusTrips.length === 0 ? (
                        <div style={{
                          border: '2px dashed var(--color-border)',
                          borderRadius: 'var(--radius)',
                          padding: '24px',
                          textAlign: 'center',
                          color: 'var(--color-text-muted)',
                          fontSize: '13px',
                        }}>
                          No trips
                        </div>
                      ) : (
                        statusTrips.map(trip => <TripKanbanCard key={trip.id} trip={trip} />)
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {filteredTrips.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '48px', color: 'var(--color-text-muted)' }}>
                    No trips with status {filter}
                  </div>
                ) : (
                  filteredTrips.map(trip => (
                    <Link key={trip.id} to={`/admin/trips/${trip.id}`} style={{ textDecoration: 'none' }}>
                      <div
                        style={{
                          background: 'var(--color-surface)',
                          border: '1px solid var(--color-border)',
                          borderRadius: 'var(--radius-lg)',
                          padding: '18px 24px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '16px',
                          flexWrap: 'wrap',
                          boxShadow: 'var(--shadow-sm)',
                          transition: 'box-shadow 0.2s, border-color 0.2s',
                        }}
                        onMouseEnter={e => {
                          const el = e.currentTarget as HTMLDivElement
                          el.style.boxShadow = 'var(--shadow-md)'
                          el.style.borderColor = 'var(--color-primary)'
                        }}
                        onMouseLeave={e => {
                          const el = e.currentTarget as HTMLDivElement
                          el.style.boxShadow = 'var(--shadow-sm)'
                          el.style.borderColor = 'var(--color-border)'
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '4px', color: 'var(--color-text)' }}>{trip.title}</div>
                          <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                            {trip.client_name} · {trip.client_email}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', color: 'var(--color-text-muted)' }}>
                            <PlaneTakeoff size={13} strokeWidth={2} /> {trip.origin_city}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', color: 'var(--color-text-muted)' }}>
                            <Calendar size={13} strokeWidth={2} /> {formatDate(trip.start_date)}
                          </span>
                          <span style={{ fontSize: '13px', color: 'var(--color-primary)', fontWeight: 600 }}>View →</span>
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}
