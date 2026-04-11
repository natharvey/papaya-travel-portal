import React, { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import PDFDownloadButton from '../components/PDFDownloadButton'
import Layout from '../components/Layout'
import ItineraryTimeline, { buildCopyText } from '../components/ItineraryTimeline'
import MessageThread from '../components/MessageThread'
import LoadingSpinner from '../components/LoadingSpinner'
import { PlaneTakeoff, Calendar, Clock, Wallet, FileText, Download, Send, ExternalLink, Hotel, Plane, MessageCircle, Loader2, Pencil, Sparkles, UserRound } from 'lucide-react'
const FlightMap = lazy(() => import('../components/FlightMap'))
const ItineraryMap = lazy(() => import('../components/ItineraryMap'))
import { getClientTrip, sendClientMessage, markClientMessagesRead, listClientDocuments, uploadClientDocument, getClientDocumentUrl, deleteClientDocument, getApiError, tripChat, editItineraryBlock, getAccommodationSuggestions, getFlightSuggestions, updateTripTitle, deleteTrip, clientLookupFlight, type TripDocument, type AccommodationSuggestion, type FlightSuggestion, type FlightLookupResult } from '../api/client'
import type { TripDetail, Message, Itinerary } from '../types'

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  GENERATING: { bg: '#F5F3FF', text: '#6D28D9' },
  ACTIVE:     { bg: '#F0FDF6', text: '#166534' },
  COMPLETED:  { bg: '#F8F8F8', text: '#6B7280' },
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

function ItineraryCopySummary({ data }: { data: import('../types').ItineraryJSON }) {
  const [copied, setCopied] = useState(false)
  function handleCopy() {
    const text = buildCopyText(data)
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
  return (
    <button onClick={handleCopy} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--color-bg)', border: '1.5px solid var(--color-border)', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, color: 'var(--color-text-muted)', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-text-muted)'; e.currentTarget.style.color = 'var(--color-text)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.color = 'var(--color-text-muted)' }}
    >
      {copied ? '✓ Copied' : 'Copy summary'}
    </button>
  )
}

export default function TripDetailPage() {
  const { tripId } = useParams<{ tripId: string }>()
  const [trip, setTrip] = useState<TripDetail | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'itinerary' | 'chat' | 'accommodation' | 'flights' | 'messages' | 'documents'>('itinerary')
  const [documents, setDocuments] = useState<TripDocument[]>([])
  const [docUploading, setDocUploading] = useState(false)
  const [docError, setDocError] = useState('')

  function switchTab(next: 'itinerary' | 'chat' | 'accommodation' | 'flights' | 'messages' | 'documents') {
    setTab(next)
    if (next === 'messages' && tripId) {
      markClientMessagesRead(tripId)
      setMessages(prev => prev.map(m => m.sender_type === 'ADMIN' ? { ...m, is_read: true } : m))
    }
  }
  // Chat refinement
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatBottomRef = useRef<HTMLDivElement>(null)

  // Accommodation suggestions
  const [accommodation, setAccommodation] = useState<AccommodationSuggestion[] | null>(null)
  const [accommodationLoading, setAccommodationLoading] = useState(false)

  // Flight suggestions
  const [flightSuggestions, setFlightSuggestions] = useState<FlightSuggestion[] | null>(null)
  const [flightSuggestionsLoading, setFlightSuggestionsLoading] = useState(false)

  // Flight lookup
  const [lookupNumber, setLookupNumber] = useState('')
  const [lookupDate, setLookupDate] = useState('')
  const [lookupResult, setLookupResult] = useState<FlightLookupResult | null>(null)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState('')

  async function handleFlightLookup() {
    if (!lookupNumber.trim() || !lookupDate) return
    setLookupLoading(true)
    setLookupError('')
    setLookupResult(null)
    try {
      const result = await clientLookupFlight(lookupNumber.trim().toUpperCase(), lookupDate)
      setLookupResult(result)
    } catch (e: any) {
      setLookupError(e?.response?.data?.detail || 'Flight not found. Check the flight number and date.')
    } finally {
      setLookupLoading(false)
    }
  }

  const [sendMessageError, setSendMessageError] = useState('')

  // Maya greeting typewriter
  const MAYA_GREETING = "Hi! I'm Maya. I can adjust anything about your itinerary — swap activities, change the pace, add day trips, or make it more budget-friendly. What would you like to change?"
  const [greetingText, setGreetingText] = useState('')
  const [greetingDone, setGreetingDone] = useState(false)

  useEffect(() => {
    if (tab !== 'chat') return
    setGreetingText('')
    setGreetingDone(false)
    let i = 0
    const timer = setInterval(() => {
      i++
      setGreetingText(MAYA_GREETING.slice(0, i))
      if (i >= MAYA_GREETING.length) {
        clearInterval(timer)
        setGreetingDone(true)
      }
    }, 22)
    return () => clearInterval(timer)
  }, [tab])

  // Title editing
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleInput, setTitleInput] = useState('')
  const [titleSaving, setTitleSaving] = useState(false)

  // Delete trip
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!tripId) return
    let pollTimer: ReturnType<typeof setTimeout> | null = null

    async function load() {
      try {
        const data = await getClientTrip(tripId!)
        setTrip(data)
        setMessages(data.messages)
        // Poll every 5s while still generating
        if (data.status === 'GENERATING') {
          pollTimer = setTimeout(load, 5000)
        }
      } catch (e) {
        setError(getApiError(e))
      } finally {
        setLoading(false)
      }
    }

    load()
    listClientDocuments(tripId).then(setDocuments).catch(() => {})

    return () => { if (pollTimer) clearTimeout(pollTimer) }
  }, [tripId])

  async function handleSaveTitle() {
    if (!tripId || !titleInput.trim()) return
    setTitleSaving(true)
    try {
      await updateTripTitle(tripId, titleInput.trim())
      setTrip(prev => prev ? { ...prev, title: titleInput.trim() } : prev)
      setEditingTitle(false)
    } finally {
      setTitleSaving(false)
    }
  }

  async function handleDeleteTrip() {
    if (!tripId) return
    setDeleting(true)
    try {
      await deleteTrip(tripId)
      window.location.href = '/portal'
    } finally {
      setDeleting(false)
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

  const statusColors = STATUS_COLORS[trip.status] || STATUS_COLORS.GENERATING
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
            <div style={{ flex: 1 }}>
              {/* Editable title */}
              {editingTitle ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <input
                    autoFocus
                    value={titleInput}
                    onChange={e => setTitleInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveTitle(); if (e.key === 'Escape') setEditingTitle(false) }}
                    style={{
                      fontSize: '22px', fontWeight: 800, background: 'rgba(255,255,255,0.15)',
                      border: '1.5px solid rgba(255,255,255,0.4)', borderRadius: 8,
                      padding: '4px 10px', color: 'white', outline: 'none', fontFamily: 'inherit', width: '100%', maxWidth: 400,
                    }}
                  />
                  <button onClick={handleSaveTitle} disabled={titleSaving} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 6, padding: '5px 12px', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {titleSaving ? '...' : 'Save'}
                  </button>
                  <button onClick={() => setEditingTitle(false)} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Cancel
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <h1 style={{ fontSize: '26px', fontWeight: 800, margin: 0 }}>{trip.title}</h1>
                  <button
                    onClick={() => { setTitleInput(trip.title); setEditingTitle(true) }}
                    title="Edit title"
                    style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, padding: '5px 7px', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', display: 'flex', alignItems: 'center', lineHeight: 1 }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = 'white' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)' }}
                  >
                    <Pencil size={13} strokeWidth={2} />
                  </button>
                </div>
              )}
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                {[
                  { Icon: PlaneTakeoff, label: `From ${trip.origin_city}` },
                  { Icon: Calendar, label: `${formatDate(trip.start_date)} — ${formatDate(trip.end_date)}` },
                  { Icon: Clock, label: `${tripDays} days` },
                  { Icon: Wallet, label: `$${trip.budget_range}` },
                ].map(({ Icon, label }) => (
                  <span key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: 'rgba(255,255,255,0.6)' }}>
                    <Icon size={13} color="rgba(255,255,255,0.4)" strokeWidth={2} />
                    {label}
                  </span>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
              <span style={{
                background: statusColors.bg, color: statusColors.text,
                padding: '6px 16px', borderRadius: '100px', fontSize: '13px', fontWeight: 700, whiteSpace: 'nowrap',
              }}>
                {trip.status}
              </span>
              {confirmDelete ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>Delete trip?</span>
                  <button onClick={handleDeleteTrip} disabled={deleting} style={{ background: '#EF4444', border: 'none', borderRadius: 6, padding: '4px 10px', color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {deleting ? '...' : 'Yes, delete'}
                  </button>
                  <button onClick={() => setConfirmDelete(false)} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, padding: '4px 10px', color: 'rgba(255,255,255,0.5)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#EF4444'; e.currentTarget.style.color = '#FCA5A5' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)' }}
                >
                  Delete trip
                </button>
              )}
            </div>
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
          <div style={{ borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', overflowX: 'auto' }}>
            <TabButton label="Itinerary" active={tab === 'itinerary'} onClick={() => switchTab('itinerary')} />
            <TabButton label="Ask Maya" active={tab === 'chat'} onClick={() => switchTab('chat')} />
            <TabButton label="Accommodation" active={tab === 'accommodation'} onClick={() => switchTab('accommodation')} />
            <TabButton label="Flights" active={tab === 'flights'} onClick={() => switchTab('flights')} />
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
                    background: '#EF4444', color: 'white', borderRadius: '100px',
                    fontSize: '11px', fontWeight: 700, padding: '1px 7px',
                    marginLeft: '-8px', marginTop: '-10px',
                  }}>{unread}</span>
                ) : null
              })()}
            </div>
            <TabButton label={`Documents${documents.length > 0 ? ` (${documents.length})` : ''}`} active={tab === 'documents'} onClick={() => switchTab('documents')} />
          </div>

          <div style={{ padding: '28px' }}>
            {/* Itinerary Tab */}
            {tab === 'itinerary' && (
              <>
                {trip.status === 'GENERATING' && (
                  <div style={{ textAlign: 'center', padding: '48px 20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
                      <LoadingSpinner size={40} label="" />
                    </div>
                    <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '10px' }}>
                      Building your itinerary...
                    </h3>
                    <p style={{ color: 'var(--color-text-muted)', lineHeight: '1.6', maxWidth: '420px', margin: '0 auto' }}>
                      Our AI is researching real places, hotels, and experiences tailored just for you.
                      This usually takes 1–2 minutes — this page updates automatically.
                    </p>
                  </div>
                )}
                {!latestItinerary && trip.status !== 'GENERATING' && (
                  <div style={{ textAlign: 'center', padding: '48px 20px' }}>
                    <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}>
                      <FileText size={48} color="var(--color-text-muted)" strokeWidth={1.2} />
                    </div>
                    <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>Your itinerary is being prepared</h3>
                    <p style={{ color: 'var(--color-text-muted)', lineHeight: '1.6' }}>
                      Your personalised itinerary will appear here once it's ready.
                    </p>
                  </div>
                )}
                {latestItinerary && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '8px' }}>
                      <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                        Generated {new Date(latestItinerary.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {trip.itineraries.length > 1 && (
                          <span style={{ marginLeft: '8px', color: 'var(--color-primary)' }}>
                            · {trip.itineraries.length} revisions
                          </span>
                        )}
                      </span>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <ItineraryCopySummary data={latestItinerary.itinerary_json} />
                        <PDFDownloadButton
                          data={latestItinerary.itinerary_json}
                          tripTitle={trip.title}
                          clientName={trip.client.name}
                          startDate={trip.start_date}
                          endDate={trip.end_date}
                          originCity={trip.origin_city}
                        />
                      </div>
                    </div>
                    {/* Journey map — only renders when transport_legs present */}
                    {latestItinerary.itinerary_json.transport_legs && latestItinerary.itinerary_json.transport_legs.length > 0 && (
                      <Suspense fallback={<div style={{ height: 300, background: '#e8f0f5', borderRadius: 12, marginBottom: 28 }} />}>
                        <ItineraryMap
                          itinerary={latestItinerary.itinerary_json}
                          originCity={trip.origin_city}
                          stays={trip.stays ?? []}
                        />
                      </Suspense>
                    )}

                    <ItineraryTimeline
                      data={latestItinerary.itinerary_json}
                      onBlockEdit={async (dayNum, period, blockTitle, prompt) => {
                        if (!tripId) return
                        const res = await editItineraryBlock(tripId, {
                          day_number: dayNum,
                          period,
                          block_title: blockTitle,
                          instruction: prompt,
                        })
                        if (res.itinerary_updated && res.new_itinerary) {
                          setTrip(prev => prev ? { ...prev, itineraries: [...prev.itineraries, res.new_itinerary!] } : prev)
                        }
                      }}
                    />

                    {/* Confirmed bookings (if admin has added them) */}
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
                )}
              </>
            )}

            {/* Chat Refinement Tab */}
            {tab === 'chat' && (
              <div>
                <div style={{
                  height: '420px', overflowY: 'auto', border: '1.5px solid var(--color-border)',
                  borderRadius: '12px', padding: '16px', background: '#F8FAFC',
                  display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '12px',
                }}>
                  {/* Maya's greeting — always visible */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    {/* Maya avatar */}
                    <div style={{
                      width: 34, height: 34, borderRadius: '50%', flexShrink: 0, marginTop: 2,
                      background: 'linear-gradient(135deg, var(--color-primary) 0%, #D45E1E 100%)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 2px 8px rgba(240,115,50,0.35)',
                    }}>
                      <span style={{ color: 'white', fontWeight: 800, fontSize: 15, letterSpacing: '-0.5px', fontFamily: 'inherit' }}>M</span>
                    </div>
                    <div style={{
                      maxWidth: '80%', padding: '10px 14px', fontSize: '14px', lineHeight: 1.6,
                      borderRadius: '16px 16px 16px 4px', background: 'white',
                      color: 'var(--color-text)', border: '1px solid var(--color-border)',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.06)', minHeight: 42,
                    }}>
                      {greetingText}
                      {!greetingDone && (
                        <span style={{ display: 'inline-block', width: 2, height: '1em', background: 'var(--color-primary)', marginLeft: 1, verticalAlign: 'text-bottom', animation: 'blink 0.8s step-end infinite' }} />
                      )}
                    </div>
                  </div>

                  {/* Suggested prompts — only show after typing finishes and before first user message */}
                  {greetingDone && chatMessages.length === 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingLeft: 40 }}>
                      {[
                        'Make it more budget-friendly',
                        'Add more adventure activities',
                        'Swap a destination',
                        'Change the travel pace',
                        'Add a free day',
                        'More local food experiences',
                      ].map(prompt => (
                        <button
                          key={prompt}
                          onClick={() => setChatInput(prompt)}
                          style={{
                            background: 'white', border: '1.5px solid var(--color-border)',
                            borderRadius: '100px', padding: '6px 14px', fontSize: '13px',
                            color: 'var(--color-text-muted)', cursor: 'pointer', fontFamily: 'inherit',
                            transition: 'all 0.15s',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.color = 'var(--color-primary)' }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.color = 'var(--color-text-muted)' }}
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  )}
                  {chatMessages.map((msg, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                      {msg.role === 'assistant' && (
                        <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg, var(--color-primary) 0%, #D45E1E 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginRight: 8, marginTop: 2, boxShadow: '0 2px 8px rgba(240,115,50,0.35)' }}><span style={{ color: 'white', fontWeight: 800, fontSize: 15, letterSpacing: '-0.5px' }}>M</span></div>
                      )}
                      <div style={{
                        maxWidth: '80%', padding: '10px 14px', fontSize: '14px', lineHeight: 1.5,
                        borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                        background: msg.role === 'user' ? 'var(--color-primary)' : 'white',
                        color: msg.role === 'user' ? 'white' : 'var(--color-text)',
                        border: msg.role === 'assistant' ? '1px solid var(--color-border)' : 'none',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                      }}>
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  {chatLoading && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg, var(--color-primary) 0%, #D45E1E 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(240,115,50,0.35)' }}><span style={{ color: 'white', fontWeight: 800, fontSize: 15, letterSpacing: '-0.5px' }}>M</span></div>
                      <div style={{ padding: '10px 14px', borderRadius: '16px 16px 16px 4px', background: 'white', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)', fontSize: 13 }}>Thinking...</div>
                    </div>
                  )}
                  <div ref={chatBottomRef} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey && chatInput.trim() && !chatLoading) {
                        e.preventDefault()
                        const newMessages = [...chatMessages, { role: 'user', content: chatInput.trim() }]
                        setChatMessages(newMessages)
                        setChatInput('')
                        setChatLoading(true)
                        tripChat(tripId!, newMessages).then(res => {
                          setChatMessages(prev => [...prev, { role: 'assistant', content: res.message }])
                          if (res.itinerary_updated && res.new_itinerary) {
                            setTrip(prev => prev ? { ...prev, itineraries: [...prev.itineraries, res.new_itinerary!] } : prev)
                          }
                          setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
                        }).catch(() => {
                          setChatMessages(prev => [...prev, { role: 'assistant', content: "Sorry, something went wrong. Please try again." }])
                        }).finally(() => setChatLoading(false))
                      }
                    }}
                    placeholder="Ask Maya to change your itinerary..."
                    disabled={chatLoading}
                    style={{ flex: 1, border: '1.5px solid var(--color-border)', borderRadius: 10, padding: '11px 14px', fontSize: 14, outline: 'none' }}
                  />
                  <button
                    type="button"
                    disabled={chatLoading || !chatInput.trim()}
                    onClick={() => {
                      if (!chatInput.trim() || chatLoading) return
                      const newMessages = [...chatMessages, { role: 'user', content: chatInput.trim() }]
                      setChatMessages(newMessages)
                      setChatInput('')
                      setChatLoading(true)
                      tripChat(tripId!, newMessages).then(res => {
                        setChatMessages(prev => [...prev, { role: 'assistant', content: res.message }])
                        if (res.itinerary_updated && res.new_itinerary) {
                          setTrip(prev => prev ? { ...prev, itineraries: [...prev.itineraries, res.new_itinerary!] } : prev)
                        }
                        setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
                      }).catch(() => {
                        setChatMessages(prev => [...prev, { role: 'assistant', content: "Sorry, something went wrong. Please try again." }])
                      }).finally(() => setChatLoading(false))
                    }}
                    style={{ padding: '0 16px', background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: 10, cursor: chatLoading || !chatInput.trim() ? 'default' : 'pointer', opacity: chatLoading || !chatInput.trim() ? 0.5 : 1 }}
                  >
                    <Send size={18} />
                  </button>
                </div>
              </div>
            )}

            {/* Accommodation Tab */}
            {tab === 'accommodation' && (
              <div>
                <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginBottom: '20px' }}>
                  AI-researched accommodation options tailored to your style and budget. Click through to see live prices and availability.
                </p>
                {!accommodation && !accommodationLoading && (
                  <div style={{ textAlign: 'center', padding: '48px 20px' }}>
                    <Hotel size={48} color="var(--color-text-muted)" strokeWidth={1.2} style={{ marginBottom: 16 }} />
                    <h3 style={{ fontSize: '17px', fontWeight: 700, marginBottom: 10 }}>Find the perfect places to stay</h3>
                    <p style={{ color: 'var(--color-text-muted)', marginBottom: 24, fontSize: 14 }}>Our AI will search for real hotels and properties that match your profile.</p>
                    <button onClick={() => { setAccommodationLoading(true); getAccommodationSuggestions(tripId!).then(r => setAccommodation(r.suggestions)).catch(() => setAccommodation([])).finally(() => setAccommodationLoading(false)) }}
                      style={{ background: 'var(--color-primary)', color: 'white', border: 'none', padding: '12px 28px', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                      Search Accommodation
                    </button>
                  </div>
                )}
                {accommodationLoading && (
                  <div style={{ textAlign: 'center', padding: '48px 20px' }}>
                    <LoadingSpinner size={36} label="" />
                    <p style={{ color: 'var(--color-text-muted)', marginTop: 16 }}>Searching for the best options for you...</p>
                  </div>
                )}
                {accommodation && accommodation.length > 0 && (() => {
                  // Group by destination
                  const grouped: Record<string, typeof accommodation> = {}
                  accommodation.forEach(a => {
                    const dest = a.destination || 'Other'
                    if (!grouped[dest]) grouped[dest] = []
                    grouped[dest].push(a)
                  })
                  const destinations = Object.keys(grouped)
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
                      {destinations.map(dest => (
                        <div key={dest}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>{dest}</h3>
                            <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {grouped[dest].map((a, i) => (
                              <div key={i} style={{ border: '1.5px solid var(--color-border)', borderRadius: 12, padding: 20 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                                  <div>
                                    <div style={{ fontWeight: 700, fontSize: 15 }}>{a.name}</div>
                                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>{a.area} · {a.style}</div>
                                  </div>
                                  {a.price_per_night_aud && (
                                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-primary)', whiteSpace: 'nowrap', marginLeft: 12 }}>
                                      ~${a.price_per_night_aud}<span style={{ fontWeight: 400, fontSize: 11 }}>/night</span>
                                    </div>
                                  )}
                                </div>
                                <p style={{ fontSize: 13, color: '#374151', marginBottom: 8 }}>{a.why_suits}</p>
                                {a.notes && <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 10 }}>{a.notes}</p>}
                                <div style={{ display: 'flex', gap: 10 }}>
                                  <a href={a.booking_com_search} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 600, color: 'var(--color-primary)', textDecoration: 'none' }}>
                                    <ExternalLink size={13} /> Booking.com
                                  </a>
                                  <a href={a.google_maps_url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 600, color: 'var(--color-text-muted)', textDecoration: 'none' }}>
                                    <ExternalLink size={13} /> Maps
                                  </a>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                      <button onClick={() => { setAccommodation(null); setAccommodationLoading(true); getAccommodationSuggestions(tripId!).then(r => setAccommodation(r.suggestions)).catch(() => setAccommodation([])).finally(() => setAccommodationLoading(false)) }}
                        style={{ background: 'white', border: '1.5px solid var(--color-border)', padding: '10px 20px', borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: 'pointer', color: 'var(--color-text-muted)' }}>
                        Refresh suggestions
                      </button>
                    </div>
                  )
                })()}
              </div>
            )}

            {/* Flights Tab */}
            {tab === 'flights' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

                {/* Booked route map */}
                {trip.flights && trip.flights.length > 0 ? (
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', marginBottom: 12 }}>Your route</h3>
                    <Suspense fallback={<div style={{ height: 260, background: '#0f1f3d', borderRadius: 'var(--radius-lg)' }} />}>
                      <FlightMap flights={trip.flights} originCity={trip.origin_city} />
                    </Suspense>
                  </div>
                ) : (
                  <div style={{ background: 'var(--color-bg)', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '28px 24px', textAlign: 'center' }}>
                    <Plane size={32} color="var(--color-text-muted)" strokeWidth={1.5} style={{ marginBottom: 10 }} />
                    <p style={{ fontSize: 14, color: 'var(--color-text-muted)', margin: 0 }}>No flights have been added to your trip yet. Your travel planner will add them once your itinerary is confirmed.</p>
                  </div>
                )}

                {/* Flight number lookup */}
                <div style={{ border: '1.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>Look up a flight</h3>
                  <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 20 }}>Enter your flight number and date to see route details and departure times.</p>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: lookupError || lookupResult ? 16 : 0 }}>
                    <input
                      value={lookupNumber}
                      onChange={e => setLookupNumber(e.target.value.toUpperCase())}
                      onKeyDown={e => e.key === 'Enter' && handleFlightLookup()}
                      placeholder="e.g. QF1"
                      maxLength={8}
                      style={{
                        border: '1.5px solid var(--color-border)', borderRadius: 8,
                        padding: '10px 14px', fontSize: 15, fontWeight: 700,
                        fontFamily: 'inherit', width: 120, color: 'var(--color-text)',
                        outline: 'none', letterSpacing: '0.5px',
                      }}
                    />
                    <input
                      type="date"
                      value={lookupDate}
                      onChange={e => setLookupDate(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleFlightLookup()}
                      min={trip.start_date?.slice(0, 10)}
                      max={trip.end_date?.slice(0, 10)}
                      style={{
                        border: '1.5px solid var(--color-border)', borderRadius: 8,
                        padding: '10px 14px', fontSize: 14, fontFamily: 'inherit',
                        color: 'var(--color-text)', outline: 'none',
                      }}
                    />
                    <button
                      onClick={handleFlightLookup}
                      disabled={lookupLoading || !lookupNumber.trim() || !lookupDate}
                      style={{
                        background: 'var(--color-primary)', color: 'white', border: 'none',
                        padding: '10px 22px', borderRadius: 8, fontWeight: 700, fontSize: 14,
                        cursor: lookupLoading || !lookupNumber.trim() || !lookupDate ? 'not-allowed' : 'pointer',
                        opacity: !lookupNumber.trim() || !lookupDate ? 0.5 : 1,
                        fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 7,
                        transition: 'background 0.15s',
                      }}
                    >
                      {lookupLoading ? <><Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> Looking up...</> : <><Plane size={14} /> Look up</>}
                    </button>
                  </div>

                  {lookupError && (
                    <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#B91C1C' }}>
                      {lookupError}
                    </div>
                  )}

                  {lookupResult && (
                    <div style={{ background: 'var(--color-bg)', border: '1.5px solid var(--color-border)', borderRadius: 12, padding: '18px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                        <div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{lookupResult.airline}</span>
                          <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--color-text)', letterSpacing: '-0.3px' }}>{lookupResult.flight_number}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--color-text)' }}>{lookupResult.departure_airport}</div>
                            {lookupResult.departure_time && (
                              <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                                {new Date(lookupResult.departure_time).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            )}
                            {lookupResult.terminal_departure && (
                              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Terminal {lookupResult.terminal_departure}</div>
                            )}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                            <Plane size={18} color="var(--color-primary)" />
                            <div style={{ width: 60, height: 1.5, background: 'var(--color-border)' }} />
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--color-text)' }}>{lookupResult.arrival_airport}</div>
                            {lookupResult.arrival_time && (
                              <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                                {new Date(lookupResult.arrival_time).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            )}
                            {lookupResult.terminal_arrival && (
                              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Terminal {lookupResult.terminal_arrival}</div>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Mini route map for looked-up flight */}
                      <Suspense fallback={<div style={{ height: 180, background: '#0f1f3d', borderRadius: 8 }} />}>
                        <FlightMap
                          flights={[{
                            id: 'lookup',
                            leg_order: 1,
                            flight_number: lookupResult.flight_number,
                            airline: lookupResult.airline,
                            departure_airport: lookupResult.departure_airport,
                            arrival_airport: lookupResult.arrival_airport,
                            departure_time: lookupResult.departure_time,
                            arrival_time: lookupResult.arrival_time,
                            terminal_departure: lookupResult.terminal_departure,
                            terminal_arrival: lookupResult.terminal_arrival,
                          } as any]}
                          originCity={trip.origin_city}
                        />
                      </Suspense>
                    </div>
                  )}
                </div>

                {/* AI flight suggestions */}
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>Suggested routes</h3>
                  <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16 }}>AI-suggested flight routes with links to live prices.</p>
                  {!flightSuggestions && !flightSuggestionsLoading && (
                    <button onClick={() => { setFlightSuggestionsLoading(true); getFlightSuggestions(tripId!).then(r => setFlightSuggestions(r.suggestions)).catch(() => setFlightSuggestions([])).finally(() => setFlightSuggestionsLoading(false)) }}
                      style={{ background: 'var(--color-bg)', border: '1.5px solid var(--color-border)', padding: '10px 20px', borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: 'pointer', color: 'var(--color-text-muted)', fontFamily: 'inherit' }}>
                      Search for suggestions
                    </button>
                  )}
                  {flightSuggestionsLoading && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--color-text-muted)', fontSize: 13 }}>
                      <LoadingSpinner size={20} label="" /> Finding the best routes...
                    </div>
                  )}
                  {flightSuggestions && flightSuggestions.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {flightSuggestions.map((f, i) => (
                        <div key={i} style={{ border: '1.5px solid var(--color-border)', borderRadius: 12, padding: 18 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Leg {i + 1}</div>
                          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{f.route}</div>
                          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--color-primary)', marginBottom: 6 }}>{f.typical_price_aud}</div>
                          <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 6 }}>{f.airlines.join(' · ')} · {f.flight_time}</div>
                          <p style={{ fontSize: 13, color: '#374151', marginBottom: 12 }}>{f.tips}</p>
                          <div style={{ display: 'flex', gap: 10 }}>
                            <a href={f.google_flights_url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 700, color: 'white', background: 'var(--color-primary)', padding: '7px 14px', borderRadius: 8, textDecoration: 'none' }}>
                              <ExternalLink size={12} /> Google Flights
                            </a>
                            <a href={f.skyscanner_url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 600, color: 'var(--color-primary)', textDecoration: 'none', border: '1.5px solid var(--color-primary)', padding: '7px 14px', borderRadius: 8 }}>
                              <ExternalLink size={12} /> Skyscanner
                            </a>
                          </div>
                        </div>
                      ))}
                      <button onClick={() => { setFlightSuggestions(null); setFlightSuggestionsLoading(true); getFlightSuggestions(tripId!).then(r => setFlightSuggestions(r.suggestions)).catch(() => setFlightSuggestions([])).finally(() => setFlightSuggestionsLoading(false)) }}
                        style={{ alignSelf: 'flex-start', background: 'white', border: '1.5px solid var(--color-border)', padding: '8px 16px', borderRadius: 8, fontWeight: 600, fontSize: 12, cursor: 'pointer', color: 'var(--color-text-muted)', fontFamily: 'inherit' }}>
                        Refresh suggestions
                      </button>
                    </div>
                  )}
                </div>

              </div>
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
