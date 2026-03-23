import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
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
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--color-secondary)', marginBottom: '4px' }}>
              Your Trips
            </h1>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '15px' }}>
              View your itineraries, send messages and track your trip status.
            </p>
          </div>
          <Link
            to="/intake"
            style={{
              background: 'var(--color-primary)',
              color: 'white',
              padding: '10px 22px',
              borderRadius: 'var(--radius)',
              fontWeight: 600,
              fontSize: '14px',
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            + Plan another trip
          </Link>
        </div>

        {loading && <LoadingSpinner label="Loading your trips..." />}

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

        {!loading && !error && trips.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-lg)',
            border: '2px dashed var(--color-border)',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✈️</div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>No trips yet</h2>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: '24px' }}>
              Submit your first trip enquiry and we'll craft a personalised itinerary for you.
            </p>
            <Link
              to="/intake"
              style={{
                background: 'var(--color-primary)',
                color: 'white',
                padding: '12px 28px',
                borderRadius: 'var(--radius)',
                fontWeight: 700,
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              Plan Your First Trip →
            </Link>
          </div>
        )}

        {!loading && trips.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {trips.map(trip => (
              <TripCard
                key={trip.id}
                trip={trip}
                linkTo={`/portal/trips/${trip.id}`}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
