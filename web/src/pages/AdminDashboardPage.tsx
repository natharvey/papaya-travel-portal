import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { User, Mail, PlaneTakeoff, Calendar } from 'lucide-react'
import Layout from '../components/Layout'
import LoadingSpinner from '../components/LoadingSpinner'
import { getAdminTrips, getApiError } from '../api/client'
import type { AdminTripListItem, TripStatus } from '../types'

const STATUSES: TripStatus[] = ['INTAKE', 'DRAFT', 'REVIEW', 'CONFIRMED', 'ARCHIVED']

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  INTAKE: { bg: '#EEF2FF', text: '#4F46E5', border: '#C7D2FE' },
  DRAFT: { bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA' },
  REVIEW: { bg: '#FEF9C3', text: '#A16207', border: '#FDE68A' },
  CONFIRMED: { bg: '#DCFCE7', text: '#15803D', border: '#BBF7D0' },
  ARCHIVED: { bg: '#F3F4F6', text: '#6B7280', border: '#E5E7EB' },
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

function TripKanbanCard({ trip }: { trip: AdminTripListItem }) {
  const tripDays = Math.ceil(
    (new Date(trip.end_date).getTime() - new Date(trip.start_date).getTime()) / (1000 * 60 * 60 * 24)
  )
  return (
    <Link
      to={`/admin/trips/${trip.id}`}
      style={{ textDecoration: 'none' }}
    >
      <div style={{
        background: 'white',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius)',
        padding: '14px',
        marginBottom: '10px',
        cursor: 'pointer',
        transition: 'box-shadow 0.2s',
        boxShadow: 'var(--shadow-sm)',
      }}
        onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-md)'}
        onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-sm)'}
      >
        <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '8px', color: 'var(--color-text)', lineHeight: '1.3' }}>
          {trip.title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '3px' }}>
          <User size={11} strokeWidth={2} />
          {trip.client_name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '8px' }}>
          <Mail size={11} strokeWidth={2} />
          {trip.client_email}
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
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
      <div style={{ padding: '32px 24px', maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--color-secondary)', marginBottom: '4px' }}>
            Trip Dashboard
          </h1>
          <p style={{ color: 'var(--color-text-muted)' }}>
            {trips.length} total trip{trips.length !== 1 ? 's' : ''} across all statuses
          </p>
        </div>

        {loading && <LoadingSpinner label="Loading trips..." />}

        {!loading && error && (
          <div style={{
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: 'var(--radius)',
            padding: '16px',
            color: '#B91C1C',
          }}>
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Summary bar */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '28px', flexWrap: 'wrap' }}>
              {(['ALL', ...STATUSES] as const).map(s => {
                const count = s === 'ALL' ? trips.length : (tripsByStatus[s]?.length || 0)
                const colors = s === 'ALL'
                  ? { bg: '#F8FAFC', text: 'var(--color-text)', border: 'var(--color-border)' }
                  : STATUS_COLORS[s]
                return (
                  <button
                    key={s}
                    onClick={() => setFilter(s)}
                    style={{
                      background: filter === s ? (s === 'ALL' ? 'var(--color-secondary)' : colors.bg) : 'white',
                      color: filter === s ? (s === 'ALL' ? 'white' : colors.text) : 'var(--color-text-muted)',
                      border: `1px solid ${filter === s ? (s === 'ALL' ? 'var(--color-secondary)' : colors.border) : 'var(--color-border)'}`,
                      borderRadius: '100px',
                      padding: '6px 14px',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {s} <span style={{ marginLeft: '4px', opacity: 0.7 }}>{count}</span>
                  </button>
                )
              })}
            </div>

            {/* Kanban view (when ALL selected) */}
            {filter === 'ALL' ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
                {STATUSES.filter(s => s !== 'ARCHIVED').map(status => {
                  const statusTrips = tripsByStatus[status] || []
                  const colors = STATUS_COLORS[status]
                  return (
                    <div key={status}>
                      <div style={{
                        background: colors.bg,
                        borderRadius: 'var(--radius)',
                        padding: '10px 14px',
                        marginBottom: '10px',
                        border: `1px solid ${colors.border}`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}>
                        <span style={{ fontWeight: 700, fontSize: '13px', color: colors.text, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          {status}
                        </span>
                        <span style={{
                          background: colors.text,
                          color: 'white',
                          borderRadius: '100px',
                          padding: '1px 8px',
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
                          padding: '20px',
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
              /* Filtered list view */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {filteredTrips.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
                    No trips with status {filter}
                  </div>
                ) : (
                  filteredTrips.map(trip => (
                    <Link
                      key={trip.id}
                      to={`/admin/trips/${trip.id}`}
                      style={{ textDecoration: 'none' }}
                    >
                      <div style={{
                        background: 'white',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-lg)',
                        padding: '18px 22px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '16px',
                        flexWrap: 'wrap',
                        boxShadow: 'var(--shadow-sm)',
                        transition: 'box-shadow 0.2s',
                      }}
                        onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-md)'}
                        onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-sm)'}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '4px' }}>{trip.title}</div>
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
                          <span style={{ fontSize: '13px', color: 'var(--color-primary)' }}>View →</span>
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
