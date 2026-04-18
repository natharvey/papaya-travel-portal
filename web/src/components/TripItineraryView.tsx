import { lazy, Suspense, useState } from 'react'
import { MapPin } from 'lucide-react'
import ItineraryTimeline, { buildCopyText } from './ItineraryTimeline'
import PDFDownloadButton from './PDFDownloadButton'
import Button from './Button'
import type { TripDetail, Itinerary, HotelSuggestion } from '../types'

const UnifiedTripMap = lazy(() => import('./UnifiedTripMap'))

interface Props {
  itinerary: Itinerary
  trip: TripDetail
  itineraryCount: number
  selectedDay: number
  onDaySelect: (day: number) => void
  /** Optional — only provided for client portal to enable per-block AI edits */
  onBlockEdit?: (dayNum: number, period: string, blockTitle: string, prompt: string) => Promise<import('../types').DayBlock | null>
  onAddFromSuggestion?: (hotel: HotelSuggestion) => void
}

function CopySummaryButton({ itinerary }: { itinerary: Itinerary }) {
  const [copied, setCopied] = useState(false)
  function handleCopy() {
    const text = buildCopyText(itinerary.itinerary_json)
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
    } else {
      const el = document.createElement('textarea')
      el.value = text; el.style.cssText = 'position:fixed;opacity:0'
      document.body.appendChild(el); el.focus(); el.select()
      document.execCommand('copy'); document.body.removeChild(el)
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    }
  }
  return <Button variant="ghost" size="sm" onClick={handleCopy}>{copied ? '✓ Copied' : 'Copy summary'}</Button>
}

export default function TripItineraryView({ itinerary, trip, itineraryCount, selectedDay, onDaySelect, onBlockEdit, onAddFromSuggestion }: Props) {
  const json = itinerary.itinerary_json

  return (
    <>
      {/* Overview block */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginRight: 'auto' }}>
            Generated {new Date(itinerary.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
            {itineraryCount > 1 && (
              <span style={{ marginLeft: '8px', color: 'var(--color-primary)' }}>
                · {itineraryCount} revisions
              </span>
            )}
          </span>
          <CopySummaryButton itinerary={itinerary} />
          <PDFDownloadButton
            data={json}
            tripTitle={trip.title}
            clientName={trip.client.name}
            startDate={trip.start_date}
            endDate={trip.end_date}
            originCity={trip.origin_city}
          />
        </div>

        {(json.overview || json.destinations?.length > 0) && (
          <>
            {json.overview && (
              <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', lineHeight: '1.8', marginBottom: '14px' }}>
                {json.overview}
              </p>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
              {json.destinations?.map((d: { name: string; nights: number }, i: number) => (
                <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)', padding: '4px 12px', borderRadius: '100px', fontSize: '12px', fontWeight: 600 }}>
                  <MapPin size={11} strokeWidth={2.5} color="var(--color-primary)" />
                  {d.name} · {d.nights} {d.nights === 1 ? 'night' : 'nights'}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Unified trip map */}
      {((json.destinations?.length ?? 0) > 0 || (json.transport_legs?.length ?? 0) > 0) && (
        <div style={{ marginBottom: 28 }}>
          <Suspense fallback={<div style={{ height: 340, background: '#e8f0f5', borderRadius: 12 }} />}>
            <UnifiedTripMap
              itinerary={json}
              originCity={trip.origin_city}
              stays={trip.stays ?? []}
              selectedDayNum={selectedDay}
              onDaySelect={onDaySelect}
            />
          </Suspense>
        </div>
      )}

      {/* Day-by-day timeline */}
      <ItineraryTimeline
        data={json}
        stays={trip.stays ?? []}
        hideOverview
        hideSections
        selectedDay={selectedDay}
        onDaySelect={onDaySelect}
        onBlockEdit={onBlockEdit}
        onAddFromSuggestion={onAddFromSuggestion}
      />

      {/* Confirmed bookings */}
      {((trip.flights && trip.flights.length > 0) || (trip.stays && trip.stays.length > 0)) && (
        <div style={{ marginTop: 32, borderTop: '1px solid var(--color-border)', paddingTop: 24 }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: 16, color: 'var(--color-secondary)' }}>Confirmed Bookings</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(trip.flights ?? []).map(flight => (
              <div key={flight.id} style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ background: 'var(--color-secondary)', color: 'white', borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>{flight.flight_number}</div>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{flight.departure_airport} → {flight.arrival_airport} <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>{flight.airline}</span></div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                    {new Date(flight.departure_time).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })} → {new Date(flight.arrival_time).toLocaleString('en-AU', { timeStyle: 'short' })}
                  </div>
                </div>
                {flight.booking_ref && <div style={{ fontSize: 12, color: 'var(--color-text-muted)', background: 'white', border: '1px solid var(--color-border)', borderRadius: 6, padding: '4px 10px' }}>Ref: <strong style={{ color: 'var(--color-text)', letterSpacing: 1 }}>{flight.booking_ref}</strong></div>}
              </div>
            ))}
            {(trip.stays ?? []).map(stay => {
              const nights = Math.round((new Date(stay.check_out).getTime() - new Date(stay.check_in).getTime()) / 86400000)
              return (
                <div key={stay.id} style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ background: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0', borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>{nights}n</div>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{stay.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Check-in: {new Date(stay.check_in).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}</div>
                  </div>
                  {stay.confirmation_number && <div style={{ fontSize: 12, color: 'var(--color-text-muted)', background: 'white', border: '1px solid var(--color-border)', borderRadius: 6, padding: '4px 10px' }}>Ref: <strong style={{ color: 'var(--color-text)', letterSpacing: 1 }}>{stay.confirmation_number}</strong></div>}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
