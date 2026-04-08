import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { PDFDownloadLink } from '@react-pdf/renderer'
import Layout from '../components/Layout'
import ItineraryTimeline from '../components/ItineraryTimeline'
import ItineraryPDF from '../components/ItineraryPDF'
import MessageThread from '../components/MessageThread'
import LoadingSpinner from '../components/LoadingSpinner'
import { PlaneTakeoff, Calendar, Clock, Wallet, Gauge, FileText, Download } from 'lucide-react'
import FlightMap from '../components/FlightMap'
import { getClientTrip, sendClientMessage, confirmTrip, requestChanges, markClientMessagesRead, listClientDocuments, uploadClientDocument, getClientDocumentUrl, deleteClientDocument, getApiError, type TripDocument } from '../api/client'
import type { TripDetail, Message } from '../types'

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  INTAKE:    { bg: '#EEF2FF', text: '#4338CA' },
  DRAFT:     { bg: 'var(--color-accent)', text: 'var(--color-primary-dark)' },
  REVIEW:    { bg: '#FFFBEB', text: '#B45309' },
  CONFIRMED: { bg: '#F0FDF6', text: '#166534' },
  ARCHIVED:  { bg: '#F8F8F8', text: '#6B7280' },
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'transparent',
        border: 'none',
        borderBottom: active ? '3px solid var(--color-primary)' : '3px solid transparent',
        padding: '12px 20px',
        fontSize: '14px',
        fontWeight: active ? 700 : 500,
        color: active ? 'var(--color-primary)' : 'var(--color-text-muted)',
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  )
}

export default function TripDetailPage() {
  const { tripId } = useParams<{ tripId: string }>()
  const [trip, setTrip] = useState<TripDetail | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'itinerary' | 'messages' | 'details' | 'documents'>('itinerary')
  const [documents, setDocuments] = useState<TripDocument[]>([])
  const [docUploading, setDocUploading] = useState(false)
  const [docError, setDocError] = useState('')

  function switchTab(next: 'itinerary' | 'messages' | 'details' | 'documents') {
    setTab(next)
    if (next === 'messages' && tripId) {
      markClientMessagesRead(tripId)
      setMessages(prev => prev.map(m => m.sender_type === 'ADMIN' ? { ...m, is_read: true } : m))
    }
  }
  const [confirming, setConfirming] = useState(false)
  const [confirmError, setConfirmError] = useState('')
  const [requestingChanges, setRequestingChanges] = useState(false)
  const [changesOpen, setChangesOpen] = useState(false)
  const [changesBody, setChangesBody] = useState('')
  const [changesError, setChangesError] = useState('')
  const [sendMessageError, setSendMessageError] = useState('')

  useEffect(() => {
    if (!tripId) return
    getClientTrip(tripId)
      .then(data => {
        setTrip(data)
        setMessages(data.messages)
      })
      .catch(e => setError(getApiError(e)))
      .finally(() => setLoading(false))
    listClientDocuments(tripId).then(setDocuments).catch(() => {})
  }, [tripId])

  async function handleConfirm() {
    if (!tripId || !trip) return
    setConfirming(true)
    setConfirmError('')
    try {
      await confirmTrip(tripId)
      setTrip(prev => prev ? { ...prev, status: 'CONFIRMED' } : prev)
    } catch (e) {
      setConfirmError(getApiError(e))
    } finally {
      setConfirming(false)
    }
  }

  async function handleRequestChanges() {
    if (!tripId || !changesBody.trim()) return
    setRequestingChanges(true)
    setChangesError('')
    try {
      const msg = await requestChanges(tripId, changesBody.trim())
      setMessages(prev => [...prev, msg])
      setTrip(prev => prev ? { ...prev, status: 'DRAFT' } : prev)
      setChangesBody('')
      setChangesOpen(false)
    } catch (e) {
      setChangesError(getApiError(e))
    } finally {
      setRequestingChanges(false)
    }
  }

  async function handleClientUploadDocument(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !tripId) return
    e.target.value = ''
    setDocUploading(true)
    setDocError('')
    try {
      await uploadClientDocument(tripId, file)
      const updated = await listClientDocuments(tripId)
      setDocuments(updated)
    } catch (e) {
      setDocError(getApiError(e))
    } finally {
      setDocUploading(false)
    }
  }

  async function handleClientDownloadDocument(key: string) {
    if (!tripId) return
    try {
      const url = await getClientDocumentUrl(tripId, key)
      window.open(url, '_blank')
    } catch (e) {
      setDocError(getApiError(e))
    }
  }

  async function handleClientDeleteDocument(key: string) {
    if (!tripId || !window.confirm('Delete this document?')) return
    try {
      await deleteClientDocument(tripId, key)
      setDocuments(prev => prev.filter(d => d.key !== key))
    } catch (e) {
      setDocError(getApiError(e))
    }
  }

  async function handleSendMessage(body: string) {
    if (!tripId) return
    setSendMessageError('')
    try {
      const msg = await sendClientMessage(tripId, body)
      setMessages(prev => [...prev, msg])
    } catch (e) {
      setSendMessageError(getApiError(e))
    }
  }

  if (loading) {
    return (
      <Layout variant="client">
        <LoadingSpinner label="Loading trip details..." />
      </Layout>
    )
  }

  if (error || !trip) {
    return (
      <Layout variant="client">
        <div style={{ maxWidth: '600px', margin: '40px auto', padding: '0 24px' }}>
          <div style={{
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: 'var(--radius)',
            padding: '16px',
            color: '#B91C1C',
            marginBottom: '16px',
          }}>
            {error || 'Trip not found.'}
          </div>
          <Link to="/portal" style={{ color: 'var(--color-primary)' }}>← Back to your trips</Link>
        </div>
      </Layout>
    )
  }

  const statusColors = STATUS_COLORS[trip.status] || STATUS_COLORS.INTAKE
  const latestItinerary = trip.itineraries.length > 0
    ? trip.itineraries.reduce((a, b) => a.version > b.version ? a : b)
    : null

  const tripDays = Math.ceil(
    (new Date(trip.end_date).getTime() - new Date(trip.start_date).getTime()) / (1000 * 60 * 60 * 24)
  )

  return (
    <Layout variant="client">
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 24px 60px' }}>
        {/* Breadcrumb */}
        <div style={{ marginBottom: '20px' }}>
          <Link to="/portal" style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>
            ← Your Trips
          </Link>
        </div>

        {/* Trip header */}
        <div style={{
          background: 'linear-gradient(135deg, var(--color-secondary) 0%, #1A3344 100%)',
          color: 'white',
          borderRadius: 'var(--radius-lg)',
          padding: '28px 32px',
          marginBottom: '24px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h1 style={{ fontSize: '26px', fontWeight: 800, marginBottom: '8px' }}>{trip.title}</h1>
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                {[
                  { Icon: PlaneTakeoff, label: `From ${trip.origin_city}` },
                  { Icon: Calendar, label: `${formatDate(trip.start_date)} — ${formatDate(trip.end_date)}` },
                  { Icon: Clock, label: `${tripDays} days` },
                  { Icon: Wallet, label: trip.budget_range },
                  { Icon: Gauge, label: trip.pace },
                ].map(({ Icon, label }) => (
                  <span key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: 'rgba(255,255,255,0.6)' }}>
                    <Icon size={13} color="rgba(255,255,255,0.4)" strokeWidth={2} />
                    {label}
                  </span>
                ))}
              </div>
            </div>
            <span style={{
              background: statusColors.bg,
              color: statusColors.text,
              padding: '6px 16px',
              borderRadius: '100px',
              fontSize: '13px',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              alignSelf: 'flex-start',
            }}>
              {trip.status}
            </span>
          </div>
        </div>

        {/* Flight map */}
        {trip.flights && trip.flights.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <FlightMap flights={trip.flights} originCity={trip.origin_city} />
          </div>
        )}

        {/* Tabs */}
        <div style={{
          background: 'white',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-sm)',
          overflow: 'hidden',
        }}>
          <div style={{ borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center' }}>
            <TabButton label="Itinerary" active={tab === 'itinerary'} onClick={() => switchTab('itinerary')} />
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <TabButton
                label={`Messages (${messages.length})`}
                active={tab === 'messages'}
                onClick={() => switchTab('messages')}
              />
              {(() => {
                const unread = messages.filter(m => m.sender_type === 'ADMIN' && !m.is_read).length
                return unread > 0 ? (
                  <span style={{
                    background: '#EF4444',
                    color: 'white',
                    borderRadius: '100px',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '1px 7px',
                    marginLeft: '-8px',
                    marginTop: '-10px',
                  }}>
                    {unread}
                  </span>
                ) : null
              })()}
            </div>
            <TabButton label="Trip Details" active={tab === 'details'} onClick={() => switchTab('details')} />
            <TabButton label={`Documents${documents.length > 0 ? ` (${documents.length})` : ''}`} active={tab === 'documents'} onClick={() => switchTab('documents')} />
          </div>

          <div style={{ padding: '28px' }}>
            {/* Itinerary Tab */}
            {tab === 'itinerary' && (
              <>
                {(!latestItinerary || !['REVIEW', 'CONFIRMED'].includes(trip.status)) && (
                  <div style={{ textAlign: 'center', padding: '48px 20px' }}>
                    <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}>
                      <FileText size={48} color="var(--color-text-muted)" strokeWidth={1.2} />
                    </div>
                    <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>
                      {trip.status === 'DRAFT' ? 'Your changes are being reviewed' : 'Your itinerary is being prepared'}
                    </h3>
                    <p style={{ color: 'var(--color-text-muted)', lineHeight: '1.6' }}>
                      {trip.status === 'DRAFT'
                        ? "Our team has received your change request and is working on an updated itinerary. We'll notify you when it's ready to review."
                        : "Our team is working on your personalised itinerary. You'll see it here once it's ready. Feel free to send us a message in the Messages tab!"}
                    </p>
                  </div>
                )}
                {latestItinerary && ['REVIEW', 'CONFIRMED'].includes(trip.status) && (
                  <>
                    {/* Review / approval banner */}
                    {trip.status === 'REVIEW' && (
                      <div style={{
                        background: 'linear-gradient(135deg, var(--color-accent) 0%, var(--color-surface) 100%)',
                        border: '1px solid #FCD9B8',
                        borderRadius: 'var(--radius)',
                        padding: '20px',
                        marginBottom: '24px',
                      }}>
                        <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--color-primary-dark)', marginBottom: '6px' }}>
                          Your itinerary is ready for approval
                        </div>
                        <p style={{ fontSize: '14px', color: 'var(--color-primary-dark)', margin: '0 0 16px 0', lineHeight: '1.5' }}>
                          Review the itinerary below. If you're happy with it, click confirm to lock it in. If you'd like changes, send us a message.
                        </p>
                        {confirmError && (
                          <p style={{ fontSize: '13px', color: '#B91C1C', marginBottom: '12px' }}>{confirmError}</p>
                        )}
                        {!changesOpen ? (
                          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                            <button
                              onClick={handleConfirm}
                              disabled={confirming}
                              style={{
                                background: confirming ? 'var(--color-border)' : '#15803D',
                                color: 'white',
                                border: 'none',
                                borderRadius: 'var(--radius)',
                                padding: '10px 22px',
                                fontSize: '14px',
                                fontWeight: 700,
                                cursor: confirming ? 'default' : 'pointer',
                              }}
                            >
                              {confirming ? 'Confirming...' : 'Confirm this itinerary'}
                            </button>
                            <button
                              onClick={() => setChangesOpen(true)}
                              style={{
                                background: 'white',
                                color: 'var(--color-primary-dark)',
                                border: '1px solid #FCD9B8',
                                borderRadius: 'var(--radius)',
                                padding: '10px 22px',
                                fontSize: '14px',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              Request changes
                            </button>
                          </div>
                        ) : (
                          <div>
                            <p style={{ fontSize: '13px', color: 'var(--color-primary-dark)', marginBottom: '8px', fontWeight: 600 }}>
                              What would you like us to change?
                            </p>
                            <textarea
                              value={changesBody}
                              onChange={e => setChangesBody(e.target.value)}
                              placeholder="e.g. We'd love more beach time in Bali and fewer museums..."
                              rows={4}
                              style={{
                                width: '100%',
                                boxSizing: 'border-box',
                                padding: '10px 12px',
                                borderRadius: 'var(--radius)',
                                border: '1px solid #FCD9B8',
                                fontSize: '14px',
                                resize: 'vertical',
                                fontFamily: 'inherit',
                                background: 'white',
                                marginBottom: '10px',
                              }}
                            />
                            {changesError && (
                              <p style={{ fontSize: '13px', color: '#B91C1C', marginBottom: '8px' }}>{changesError}</p>
                            )}
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                onClick={handleRequestChanges}
                                disabled={requestingChanges || !changesBody.trim()}
                                style={{
                                  background: requestingChanges || !changesBody.trim() ? 'var(--color-border)' : '#C2410C',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: 'var(--radius)',
                                  padding: '10px 22px',
                                  fontSize: '14px',
                                  fontWeight: 700,
                                  cursor: requestingChanges || !changesBody.trim() ? 'default' : 'pointer',
                                }}
                              >
                                {requestingChanges ? 'Sending...' : 'Send request'}
                              </button>
                              <button
                                onClick={() => { setChangesOpen(false); setChangesBody(''); setChangesError('') }}
                                style={{
                                  background: 'white',
                                  color: 'var(--color-primary-dark)',
                                  border: '1px solid #FCD9B8',
                                  borderRadius: 'var(--radius)',
                                  padding: '10px 16px',
                                  fontSize: '14px',
                                  cursor: 'pointer',
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {trip.status === 'DRAFT' && (
                      <div style={{
                        background: '#FFF7ED',
                        border: '1px solid #FED7AA',
                        borderRadius: 'var(--radius)',
                        padding: '14px 18px',
                        marginBottom: '24px',
                        fontSize: '14px',
                        color: '#C2410C',
                        fontWeight: 600,
                      }}>
                        Your change request has been sent. Our team will be in touch with an updated itinerary.
                      </div>
                    )}

                    {trip.status === 'CONFIRMED' && (
                      <div style={{
                        background: '#F0FDF4',
                        border: '1px solid #BBF7D0',
                        borderRadius: 'var(--radius)',
                        padding: '14px 18px',
                        marginBottom: '24px',
                        fontSize: '14px',
                        color: '#15803D',
                        fontWeight: 600,
                      }}>
                        Your trip is confirmed! Our team will be in touch with next steps.
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '8px' }}>
                      <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                        Version {latestItinerary.version} · Generated {new Date(latestItinerary.created_at).toLocaleDateString('en-AU')}
                        {trip.itineraries.length > 1 && (
                          <span style={{ marginLeft: '10px', color: 'var(--color-primary)' }}>
                            · {trip.itineraries.length} versions
                          </span>
                        )}
                      </span>
                      <PDFDownloadLink
                        document={
                          <ItineraryPDF
                            data={latestItinerary.itinerary_json}
                            tripTitle={trip.title}
                            clientName={trip.client.name}
                            startDate={trip.start_date}
                            endDate={trip.end_date}
                            originCity={trip.origin_city}
                          />
                        }
                        fileName={`${trip.title.replace(/\s+/g, '-').toLowerCase()}-itinerary.pdf`}
                        style={{ textDecoration: 'none' }}
                      >
                        {({ loading }) => (
                          <button
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              background: loading ? 'var(--color-border)' : 'var(--color-secondary)',
                              color: 'white',
                              border: 'none',
                              borderRadius: 'var(--radius)',
                              padding: '7px 14px',
                              fontSize: '13px',
                              fontWeight: 600,
                              cursor: loading ? 'default' : 'pointer',
                            }}
                          >
                            <Download size={13} strokeWidth={2} />
                            {loading ? 'Preparing PDF...' : 'Download PDF'}
                          </button>
                        )}
                      </PDFDownloadLink>
                    </div>
                    <ItineraryTimeline data={latestItinerary.itinerary_json} />
                  </>
                )}
              </>
            )}

            {/* Messages Tab */}
            {tab === 'messages' && (
              <>
                {sendMessageError && (
                  <div style={{
                    background: '#FEF2F2',
                    border: '1px solid #FECACA',
                    borderRadius: 'var(--radius)',
                    padding: '10px 14px',
                    marginBottom: '12px',
                    fontSize: '13px',
                    color: '#B91C1C',
                  }}>
                    Failed to send message: {sendMessageError}
                  </div>
                )}
                <MessageThread
                  messages={messages}
                  currentRole="CLIENT"
                  onSend={handleSendMessage}
                />
              </>
            )}

            {/* Trip Details Tab */}
            {tab === 'details' && (
              <div>
                {/* Flights section */}
                {trip.flights && trip.flights.length > 0 && (
                  <div style={{ marginBottom: '32px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px', color: 'var(--color-secondary)' }}>
                      Flights
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {trip.flights.map(flight => (
                        <div key={flight.id} style={{
                          background: 'var(--color-bg)', border: '1px solid var(--color-border)',
                          borderRadius: 'var(--radius)', padding: '16px 20px',
                          display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap',
                        }}>
                          <div style={{
                            background: 'var(--color-secondary)', color: 'white',
                            borderRadius: '6px', padding: '6px 12px',
                            fontSize: '13px', fontWeight: 700, whiteSpace: 'nowrap',
                          }}>
                            {flight.flight_number}
                          </div>
                          <div style={{ flex: 1, minWidth: '180px' }}>
                            <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>
                              {flight.departure_airport} → {flight.arrival_airport}
                              <span style={{ fontWeight: 400, color: 'var(--color-text-muted)', marginLeft: '8px', fontSize: '13px' }}>
                                {flight.airline}
                              </span>
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                              <span>Dep: {new Date(flight.departure_time).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}{flight.terminal_departure ? ` · Terminal ${flight.terminal_departure}` : ''}</span>
                              <span>Arr: {new Date(flight.arrival_time).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}{flight.terminal_arrival ? ` · Terminal ${flight.terminal_arrival}` : ''}</span>
                            </div>
                          </div>
                          {flight.booking_ref && (
                            <div style={{
                              background: 'white', border: '1px solid var(--color-border)',
                              borderRadius: '6px', padding: '6px 12px', fontSize: '12px',
                              color: 'var(--color-text-muted)',
                            }}>
                              Ref: <strong style={{ color: 'var(--color-text)', letterSpacing: '1px' }}>{flight.booking_ref}</strong>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Accommodation section */}
                {trip.stays && trip.stays.length > 0 && (
                  <div style={{ marginBottom: '32px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px', color: 'var(--color-secondary)' }}>
                      Accommodation
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {trip.stays.map(stay => {
                        const nights = Math.round((new Date(stay.check_out).getTime() - new Date(stay.check_in).getTime()) / 86400000)
                        return (
                          <div key={stay.id} style={{
                            background: 'var(--color-bg)', border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius)', padding: '16px 20px',
                            display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap',
                          }}>
                            <div style={{
                              background: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0',
                              borderRadius: '6px', padding: '6px 12px',
                              fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap',
                            }}>
                              {nights} night{nights !== 1 ? 's' : ''}
                            </div>
                            <div style={{ flex: 1, minWidth: '180px' }}>
                              <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>{stay.name}</div>
                              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                                <span>Check-in: {new Date(stay.check_in).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                                <span>Check-out: {new Date(stay.check_out).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                              </div>
                              {stay.address && <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>{stay.address}</div>}
                              {stay.notes && <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px', fontStyle: 'italic' }}>{stay.notes}</div>}
                            </div>
                            {stay.confirmation_number && (
                              <div style={{
                                background: 'white', border: '1px solid var(--color-border)',
                                borderRadius: '6px', padding: '6px 12px', fontSize: '12px',
                                color: 'var(--color-text-muted)',
                              }}>
                                Ref: <strong style={{ color: 'var(--color-text)', letterSpacing: '1px' }}>{stay.confirmation_number}</strong>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px', color: 'var(--color-secondary)' }}>
                  Your Trip Preferences
                </h3>
                {trip.intake_response ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                    {[
                      ['Travellers', trip.intake_response.travellers_count.toString()],
                      ['Accommodation', trip.intake_response.accommodation_style],
                      ['Interests', trip.intake_response.interests.join(', ') || '—'],
                      ['Must-Dos', trip.intake_response.must_dos || '—'],
                      ['Must-Avoid', trip.intake_response.must_avoid || '—'],
                      ['Constraints', trip.intake_response.constraints || '—'],
                      ['Notes', trip.intake_response.notes || '—'],
                    ].map(([label, value]) => (
                      <div key={label} style={{
                        background: 'var(--color-bg)',
                        borderRadius: 'var(--radius)',
                        padding: '14px 16px',
                      }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                          {label}
                        </div>
                        <div style={{ fontSize: '14px', color: 'var(--color-text)' }}>{value}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: 'var(--color-text-muted)' }}>No intake details found.</p>
                )}
              </div>
            )}

            {tab === 'documents' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-secondary)', margin: 0 }}>Documents</h3>
                  <label style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    background: 'var(--color-primary)', color: 'white',
                    padding: '8px 16px', borderRadius: 'var(--radius)',
                    fontSize: '13px', fontWeight: 600, cursor: docUploading ? 'default' : 'pointer',
                    opacity: docUploading ? 0.7 : 1,
                  }}>
                    <input type="file" onChange={handleClientUploadDocument} style={{ display: 'none' }} disabled={docUploading} />
                    {docUploading ? '⏳ Uploading...' : '+ Upload Document'}
                  </label>
                </div>
                {docError && (
                  <p style={{ fontSize: '13px', color: '#B91C1C', marginBottom: '12px' }}>{docError}</p>
                )}
                {documents.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-text-muted)' }}>
                    <p style={{ fontSize: '14px' }}>No documents yet.</p>
                    <p style={{ fontSize: '13px', marginTop: '4px' }}>Upload your passport, insurance certificate, visa approval or any other trip documents.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {documents.map(doc => (
                      <div key={doc.key} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        background: 'var(--color-bg)', border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius)', padding: '12px 16px', gap: '12px',
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {doc.filename}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                            {doc.uploaded_by === 'admin' ? 'Uploaded by Papaya Team' : 'Uploaded by you'} · {(doc.size / 1024).toFixed(0)} KB · {new Date(doc.uploaded_at).toLocaleDateString()}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                          <button
                            onClick={() => handleClientDownloadDocument(doc.key)}
                            style={{ background: 'var(--color-secondary)', color: 'white', border: 'none', borderRadius: 'var(--radius)', padding: '6px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                          >
                            Download
                          </button>
                          {doc.uploaded_by === 'client' && (
                            <button
                              onClick={() => handleClientDeleteDocument(doc.key)}
                              style={{ background: 'white', color: '#EF4444', border: '1px solid #FECACA', borderRadius: 'var(--radius)', padding: '6px 10px', fontSize: '12px', cursor: 'pointer' }}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}
