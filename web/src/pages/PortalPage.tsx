import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PlaneTakeoff } from 'lucide-react'
import Layout from '../components/Layout'
import TripCard from '../components/TripCard'
import LoadingSpinner from '../components/LoadingSpinner'
import { getClientTrips, getApiError } from '../api/client'
import type { TripWithLatestItinerary } from '../types'

export default function PortalPage() {
  const [trips, setTrips] = useState<TripWithLatestItinerary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getClientTrips()
      .then(setTrips)
      .catch(e => setError(getApiError(e)))
      .finally(() => setLoading(false))
  }, [])

  return (
    <Layout variant="client">
      <div style={{ width: 'min(90vw, 1440px)', margin: '0 auto', padding: '48px 0 80px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '36px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '30px', fontWeight: 800, color: 'var(--color-text)', marginBottom: '6px', letterSpacing: '-0.4px' }}>
              Your Trips
            </h1>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '15px' }}>
              View your itineraries, send messages and track your trip status.
            </p>
          </div>
          <Link
            to="/portal/new-trip"
            style={{
              background: 'var(--color-primary)',
              color: 'white',
              padding: '11px 22px',
              borderRadius: 'var(--radius)',
              fontWeight: 700,
              fontSize: '14px',
              textDecoration: 'none',
              display: 'inline-block',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--color-primary-dark)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--color-primary)'}
          >
            + Plan another trip
          </Link>
        </div>

        {loading && <LoadingSpinner label="Loading your trips..." />}

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

        {!loading && !error && trips.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '72px 20px',
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-xl)',
            border: '2px dashed var(--color-border)',
          }}>
            <div style={{
              width: '72px',
              height: '72px',
              background: 'var(--color-accent)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
            }}>
              <PlaneTakeoff size={32} color="var(--color-primary)" strokeWidth={1.5} />
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px', color: 'var(--color-text)' }}>No trips yet</h2>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: '28px', fontSize: '15px', lineHeight: '1.5' }}>
              Tell Maya about your dream trip and she'll craft a<br />personalised itinerary in minutes.
            </p>
            <Link
              to="/portal/new-trip"
              style={{
                background: 'var(--color-primary)',
                color: 'white',
                padding: '13px 32px',
                borderRadius: 'var(--radius)',
                fontWeight: 700,
                textDecoration: 'none',
                display: 'inline-block',
                fontSize: '15px',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--color-primary-dark)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--color-primary)'}
            >
              Plan Your First Trip →
            </Link>
          </div>
        )}

        {!loading && trips.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {trips.map(trip => (
              <TripCard key={trip.id} trip={trip} linkTo={`/portal/trips/${trip.id}`} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
