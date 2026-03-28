import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { PDFDownloadLink } from '@react-pdf/renderer'
import Layout from '../components/Layout'
import ItineraryTimeline from '../components/ItineraryTimeline'
import ItineraryPDF from '../components/ItineraryPDF'
import MessageThread from '../components/MessageThread'
import LoadingSpinner from '../components/LoadingSpinner'
import { PlaneTakeoff, Calendar, Clock, Wallet, Gauge, FileText, Download } from 'lucide-react'
import { getClientTrip, sendClientMessage, confirmTrip, requestChanges, markClientMessagesRead, getApiError } from '../api/client'
import type { TripDetail, Message } from '../types'

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  INTAKE: { bg: '#EEF2FF', text: '#4F46E5' },
  DRAFT: { bg: '#FFF7ED', text: '#C2410C' },
  REVIEW: { bg: '#FEF9C3', text: '#A16207' },
  CONFIRMED: { bg: '#DCFCE7', text: '#15803D' },
  ARCHIVED: { bg: '#F3F4F6', text: '#6B7280' },
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
  const [tab, setTab] = useState<'itinerary' | 'messages' | 'details'>('itinerary')

  function switchTab(next: 'itinerary' | 'messages' | 'details') {
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

  useEffect(() => {
    if (!tripId) return
    getClientTrip(tripId)
      .then(data => {
        setTrip(data)
        setMessages(data.messages)
      })
      .catch(e => setError(getApiError(e)))
      .finally(() => setLoading(false))
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

  async function handleSendMessage(body: string) {
    if (!tripId) return
    const msg = await sendClientMessage(tripId, body)
    setMessages(prev => [...prev, msg])
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
          background: 'linear-gradient(135deg, var(--color-secondary), #1a2639)',
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
                  <span key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: '#94A3B8' }}>
                    <Icon size={13} color="#64748B" strokeWidth={2} />
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
                        background: 'linear-gradient(135deg, #FEF9C3, #FFF)',
                        border: '1px solid #FDE68A',
                        borderRadius: 'var(--radius)',
                        padding: '20px',
                        marginBottom: '24px',
                      }}>
                        <div style={{ fontWeight: 700, fontSize: '16px', color: '#92400E', marginBottom: '6px' }}>
                          Your itinerary is ready for approval
                        </div>
                        <p style={{ fontSize: '14px', color: '#78350F', margin: '0 0 16px 0', lineHeight: '1.5' }}>
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
                                color: '#92400E',
                                border: '1px solid #FDE68A',
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
                            <p style={{ fontSize: '13px', color: '#78350F', marginBottom: '8px', fontWeight: 600 }}>
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
                                border: '1px solid #FDE68A',
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
                                  color: '#92400E',
                                  border: '1px solid #FDE68A',
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
              <MessageThread
                messages={messages}
                currentRole="CLIENT"
                onSend={handleSendMessage}
              />
            )}

            {/* Trip Details Tab */}
            {tab === 'details' && (
              <div>
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
                        background: '#F8FAFC',
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
          </div>
        </div>
      </div>
    </Layout>
  )
}
