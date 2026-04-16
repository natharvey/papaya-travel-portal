import { useState, useEffect, useCallback } from 'react'
import { ExternalLink } from 'lucide-react'
import type { TripDetail, Stay, HotelSuggestion } from '../types'
import type { HotelSuggestionRecord } from '../api/client'
import {
  getHotelSuggestions,
  getSavedHotelSuggestions,
  updateHotelSuggestionStatus,
  fetchMoreHotelSuggestions,
} from '../api/client'
import HotelCard from './HotelCard'
import HotelDetailPanel from './HotelDetailPanel'
import LoadingSpinner from './LoadingSpinner'
import { usePlacePhoto } from '../hooks/usePlacePhoto'

interface Props {
  tripId: string
  trip: TripDetail
  onAddFromSuggestion: (hotel: HotelSuggestion) => void
  onRemoveStay: (stayId: string) => void
  removingStayId: string | null
  onManualAdd: () => void
}

function StayCard({ stay, onRemove, removing }: { stay: Stay; onRemove: () => void; removing: boolean }) {
  const nights = Math.round((new Date(stay.check_out).getTime() - new Date(stay.check_in).getTime()) / 86400000)
  const photo = usePlacePhoto(stay.google_place_id ? '' : stay.name, '')
  const photoUrl = stay.photo_reference ?? photo.photoUrl

  return (
    <div style={{ border: '1.5px solid #BBF7D0', borderRadius: 12, overflow: 'hidden', background: '#F0FDF4' }}>
      {photoUrl && (
        <img src={photoUrl} alt={stay.name} style={{ width: '100%', height: 140, objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
      )}
      <div style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#166534', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stay.name}</div>
            {stay.address && <div style={{ fontSize: 11, color: '#15803D', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stay.address}</div>}
          </div>
          <span style={{ background: '#166534', color: 'white', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700, flexShrink: 0, marginLeft: 8 }}>{nights}n</span>
        </div>
        <div style={{ fontSize: 11, color: '#15803D', marginBottom: 8 }}>
          {new Date(stay.check_in).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
          {' → '}
          {new Date(stay.check_out).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
          {stay.confirmation_number && <span style={{ marginLeft: 8 }}>· Ref: <strong>{stay.confirmation_number}</strong></span>}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {stay.website && <a href={stay.website} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, color: '#15803D', textDecoration: 'none' }}><ExternalLink size={11} /> Website</a>}
          {stay.google_place_id && <a href={`https://www.google.com/maps/place/?q=place_id:${stay.google_place_id}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, color: '#15803D', textDecoration: 'none' }}><ExternalLink size={11} /> Maps</a>}
          <button
            onClick={onRemove}
            disabled={removing}
            style={{ marginLeft: 'auto', background: 'none', border: '1px solid #fca5a5', borderRadius: 6, color: '#dc2626', fontSize: 11, fontWeight: 600, padding: '3px 8px', cursor: removing ? 'default' : 'pointer', fontFamily: 'inherit' }}
          >
            {removing ? 'Removing…' : 'Remove'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AccommodationTab({ tripId, trip, onAddFromSuggestion, onRemoveStay, removingStayId, onManualAdd }: Props) {
  const latestItinerary = trip.itineraries?.[trip.itineraries.length - 1]
  const destinations: string[] = (latestItinerary?.itinerary_json?.destinations ?? []).map((d: { name: string }) => d.name)

  const [selectedDest, setSelectedDest] = useState<string>(destinations[0] ?? '')
  const [suggestionsByDest, setSuggestionsByDest] = useState<Record<string, HotelSuggestionRecord[]>>({})
  const [loadingDest, setLoadingDest] = useState<string | null>(null)
  const [fetchingMore, setFetchingMore] = useState(false)
  const [savedRecords, setSavedRecords] = useState<HotelSuggestionRecord[]>([])
  const [selectedRecord, setSelectedRecord] = useState<HotelSuggestionRecord | null>(null)

  const stays: Stay[] = trip.stays ?? []
  const confirmedNames = new Set(stays.map(s => s.name.toLowerCase()))

  // Load saved across all destinations on mount
  useEffect(() => {
    getSavedHotelSuggestions(tripId).then(setSavedRecords).catch(() => {})
  }, [tripId])

  // Load suggestions for a destination (once per session, cached in state)
  const loadDest = useCallback(async (dest: string) => {
    if (!dest || suggestionsByDest[dest] !== undefined) return
    setLoadingDest(dest)
    try {
      const records = await getHotelSuggestions(tripId, dest)
      setSuggestionsByDest(prev => ({ ...prev, [dest]: records }))
    } catch {
      setSuggestionsByDest(prev => ({ ...prev, [dest]: [] }))
    } finally {
      setLoadingDest(null)
    }
  }, [tripId, suggestionsByDest])

  // Load first destination on mount
  useEffect(() => {
    if (selectedDest) loadDest(selectedDest)
  }, [selectedDest]) // eslint-disable-line react-hooks/exhaustive-deps

  function selectDest(dest: string) {
    setSelectedDest(dest)
    loadDest(dest)
  }

  async function handleStatusChange(record: HotelSuggestionRecord, status: 'suggestion' | 'saved' | 'dismissed') {
    try {
      const updated = await updateHotelSuggestionStatus(tripId, record.id, status)
      // Update in-dest cache
      setSuggestionsByDest(prev => {
        const list = prev[record.destination] ?? []
        return {
          ...prev,
          [record.destination]: list.map(r => r.id === updated.id ? updated : r),
        }
      })
      // Refresh saved list
      const saved = await getSavedHotelSuggestions(tripId)
      setSavedRecords(saved)
      // Update panel if it's the selected record
      if (selectedRecord?.id === updated.id) setSelectedRecord(updated)
    } catch { /* ignore */ }
  }

  async function handleFetchMore() {
    if (!selectedDest) return
    setFetchingMore(true)
    try {
      const updated = await fetchMoreHotelSuggestions(tripId, selectedDest)
      setSuggestionsByDest(prev => ({ ...prev, [selectedDest]: updated }))
    } catch { /* ignore */ }
    setFetchingMore(false)
  }

  const currentSuggestions = (suggestionsByDest[selectedDest] ?? []).filter(r => r.status !== 'dismissed')

  // Find the confirmed stay that matches a given hotel name (for "Remove from trip")
  function findConfirmedStay(hotelName: string): Stay | undefined {
    return stays.find(s => s.name.toLowerCase() === hotelName.toLowerCase())
  }

  const panelHotel: HotelSuggestion | null = selectedRecord ? (selectedRecord.hotel_data as HotelSuggestion) : null
  const panelIsAdded = selectedRecord ? confirmedNames.has(selectedRecord.hotel_data.name?.toLowerCase() ?? '') : false
  const panelStay = selectedRecord ? findConfirmedStay(selectedRecord.hotel_data.name ?? '') : undefined

  return (
    <>
      <HotelDetailPanel
        hotel={panelHotel}
        onClose={() => setSelectedRecord(null)}
        isAdded={panelIsAdded}
        onAddToTrip={panelHotel && !panelIsAdded ? () => {
          setSelectedRecord(null)
          onAddFromSuggestion(panelHotel)
        } : undefined}
        onRemoveFromTrip={panelIsAdded && panelStay ? () => {
          setSelectedRecord(null)
          onRemoveStay(panelStay.id)
        } : undefined}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* ── Your accommodation ─────────────────────────────────────────────── */}
        {stays.length > 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>Your accommodation</h3>
              <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
              {stays.map(stay => (
                <StayCard
                  key={stay.id}
                  stay={stay}
                  onRemove={() => onRemoveStay(stay.id)}
                  removing={removingStayId === stay.id}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Add manually ──────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onManualAdd}
            style={{ background: 'var(--color-bg)', border: '1.5px solid var(--color-border)', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--color-text)', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            + Add accommodation manually
          </button>
        </div>

        {/* ── Saved ⭐ ──────────────────────────────────────────────────────── */}
        {savedRecords.length > 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>★ Saved</h3>
              <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, alignItems: 'start' }}>
              {savedRecords.map(record => (
                <HotelCard
                  key={record.id}
                  hotel={record.hotel_data as HotelSuggestion}
                  status={record.status}
                  onClick={() => setSelectedRecord(record)}
                  onSave={() => handleStatusChange(record, 'suggestion')}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Destination suggestions ───────────────────────────────────────── */}
        {destinations.length > 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>Suggestions</h3>
              <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
            </div>

            {/* Destination pills */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
              {destinations.map(dest => (
                <button
                  key={dest}
                  onClick={() => selectDest(dest)}
                  style={{
                    padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                    border: selectedDest === dest ? '2px solid var(--color-primary)' : '1.5px solid var(--color-border)',
                    background: selectedDest === dest ? 'var(--color-primary)' : 'var(--color-bg)',
                    color: selectedDest === dest ? 'white' : 'var(--color-text)',
                    cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                  }}
                >
                  {dest}
                </button>
              ))}
            </div>

            {/* Suggestions grid for selected destination */}
            {selectedDest && (
              <>
                {loadingDest === selectedDest && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--color-text-muted)', fontSize: 13, padding: '8px 0' }}>
                    <LoadingSpinner size={18} label="" /> Loading suggestions for {selectedDest}…
                  </div>
                )}

                {loadingDest !== selectedDest && currentSuggestions.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, alignItems: 'start' }}>
                    {currentSuggestions.map(record => (
                      <HotelCard
                        key={record.id}
                        hotel={record.hotel_data as HotelSuggestion}
                        status={record.status}
                        onClick={() => setSelectedRecord(record)}
                        onSave={() => handleStatusChange(record, record.status === 'saved' ? 'suggestion' : 'saved')}
                        onDismiss={() => handleStatusChange(record, 'dismissed')}
                      />
                    ))}
                  </div>
                )}

                {loadingDest !== selectedDest && currentSuggestions.length === 0 && (
                  <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0 }}>
                    No suggestions loaded yet for {selectedDest}.
                  </p>
                )}

                {/* Find more */}
                {loadingDest !== selectedDest && (
                  <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center' }}>
                    <button
                      onClick={handleFetchMore}
                      disabled={fetchingMore}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        background: 'var(--color-bg)', border: '1.5px solid var(--color-border)',
                        borderRadius: 10, padding: '10px 22px', fontSize: 13, fontWeight: 600,
                        cursor: fetchingMore ? 'default' : 'pointer', color: 'var(--color-text-muted)',
                        fontFamily: 'inherit', opacity: fetchingMore ? 0.7 : 1,
                      }}
                    >
                      {fetchingMore
                        ? <><LoadingSpinner size={16} label="" /> Searching…</>
                        : `Find more options in ${selectedDest} →`
                      }
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </>
  )
}
