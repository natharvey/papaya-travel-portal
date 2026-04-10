import React, { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import PDFDownloadButton from '../components/PDFDownloadButton'
import Layout from '../components/Layout'
import ItineraryTimeline, { buildCopyText } from '../components/ItineraryTimeline'
import MessageThread from '../components/MessageThread'
import LoadingSpinner from '../components/LoadingSpinner'
import { PlaneTakeoff, Calendar, Clock, Wallet, FileText, Download, Send, ExternalLink, Hotel, Plane, MessageCircle, Loader2, Pencil, Sparkles, UserRound } from 'lucide-react'
const FlightMap = lazy(() => import('../components/FlightMap'))
import { getClientTrip, sendClientMessage, confirmTrip, requestChanges, markClientMessagesRead, listClientDocuments, uploadClientDocument, getClientDocumentUrl, deleteClientDocument, getApiError, tripChat, editItineraryBlock, getAccommodationSuggestions, getFlightSuggestions, updateTripTitle, deleteTrip, type TripDocument, type AccommodationSuggestion, type FlightSuggestion } from '../api/client'
import type { TripDetail, Message, Itinerary } from '../types'

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  INTAKE:      { bg: '#EEF2FF', text: '#4338CA' },
  GENERATING:  { bg: '#FFF7ED', text: '#C2410C' },
  DRAFT:       { bg: 'var(--color-accent)', text: 'var(--color-primary-dark)' },
  REVIEW:      { bg: '#FFFBEB', text: '#B45309' },
  CONFIRMED:   { bg: '#F0FDF6', text: '#166534' },
  ARCHIVED:    { bg: '#F8F8F8', text: '#6B7280' },
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

  const [confirming, setConfirming] = useState(false)
  const [confirmError, setConfirmError] = useState('')
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

        {/* Flight map */}
        {trip.flights && trip.flights.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <Suspense fallback={<div style={{ height: 260 }} />}>
              <FlightMap flights={trip.flights} originCity={trip.origin_city} />
            </Suspense>
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
                {(!latestItinerary || !['REVIEW', 'CONFIRMED'].includes(trip.status)) && trip.status !== 'GENERATING' && (
                  <div style={{ textAlign: 'center', padding: '48px 20px' }}>
                    <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}>
                      <FileText size={48} color="var(--color-text-muted)" strokeWidth={1.2} />
                    </div>
                    <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>
                      {trip.status === 'DRAFT' ? 'Your changes are being processed' : 'Your itinerary is being prepared'}
                    </h3>
                    <p style={{ color: 'var(--color-text-muted)', lineHeight: '1.6' }}>
                      {trip.status === 'DRAFT'
                        ? "Your updated itinerary will appear here shortly."
                        : "Your personalised itinerary will appear here once it's ready."}
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
                          Review the itinerary below and confirm when you're happy. Want changes? Ask Maya for instant AI edits, or message your planner for a personal touch.
                        </p>
                        {confirmError && (
                          <p style={{ fontSize: '13px', color: '#B91C1C', marginBottom: '12px' }}>{confirmError}</p>
                        )}
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                          <button
                            onClick={handleConfirm}
                            disabled={confirming}
                            style={{
                              background: confirming ? 'var(--color-border)' : '#15803D',
                              color: 'white', border: 'none',
                              borderRadius: 'var(--radius)', padding: '10px 22px',
                              fontSize: '14px', fontWeight: 700,
                              cursor: confirming ? 'default' : 'pointer',
                              display: 'flex', alignItems: 'center', gap: 7,
                            }}
                          >
                            {confirming ? 'Confirming...' : 'Confirm itinerary'}
                          </button>
                          <button
                            onClick={() => switchTab('chat')}
                            style={{
                              background: 'white', color: 'var(--color-primary-dark)',
                              border: '1px solid #FCD9B8', borderRadius: 'var(--radius)',
                              padding: '10px 18px', fontSize: '14px', fontWeight: 600,
                              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7,
                              transition: 'background 0.15s',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--color-accent)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'white'}
                          >
                            <Sparkles size={14} strokeWidth={2} />
                            Refine with Maya
                          </button>
                          <button
                            onClick={() => switchTab('messages')}
                            style={{
                              background: 'white', color: 'var(--color-primary-dark)',
                              border: '1px solid #FCD9B8', borderRadius: 'var(--radius)',
                              padding: '10px 18px', fontSize: '14px', fontWeight: 600,
                              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7,
                              transition: 'background 0.15s',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--color-accent)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'white'}
                          >
                            <UserRound size={14} strokeWidth={2} />
                            Message your planner
                          </button>
                        </div>
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
                        Your change request has been sent. Maya will prepare an updated itinerary shortly.
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
                        Your trip is confirmed! Check back here for any updates or use the chat to make last-minute tweaks.
                      </div>
                    )}

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
              <div>
                <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginBottom: '20px' }}>
                  Suggested flight routes for your trip. Click through to see live prices on Google Flights or Skyscanner.
                </p>
                {!flightSuggestions && !flightSuggestionsLoading && (
                  <div style={{ textAlign: 'center', padding: '48px 20px' }}>
                    <Plane size={48} color="var(--color-text-muted)" strokeWidth={1.2} style={{ marginBottom: 16 }} />
                    <h3 style={{ fontSize: '17px', fontWeight: 700, marginBottom: 10 }}>Find your flights</h3>
                    <p style={{ color: 'var(--color-text-muted)', marginBottom: 24, fontSize: 14 }}>Our AI will suggest the best routes and link you to live prices.</p>
                    <button onClick={() => { setFlightSuggestionsLoading(true); getFlightSuggestions(tripId!).then(r => setFlightSuggestions(r.suggestions)).catch(() => setFlightSuggestions([])).finally(() => setFlightSuggestionsLoading(false)) }}
                      style={{ background: 'var(--color-primary)', color: 'white', border: 'none', padding: '12px 28px', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                      Search Flights
                    </button>
                  </div>
                )}
                {flightSuggestionsLoading && (
                  <div style={{ textAlign: 'center', padding: '48px 20px' }}>
                    <LoadingSpinner size={36} label="" />
                    <p style={{ color: 'var(--color-text-muted)', marginTop: 16 }}>Finding the best routes for your trip...</p>
                  </div>
                )}
                {flightSuggestions && flightSuggestions.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {flightSuggestions.map((f, i) => (
                      <div key={i} style={{ border: '1.5px solid var(--color-border)', borderRadius: 12, padding: 20 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                          Leg {i + 1}
                        </div>
                        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{f.route}</div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-primary)', marginBottom: 8 }}>{f.typical_price_aud}</div>
                        <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 6 }}>{f.airlines.join(' · ')} · {f.flight_time}</div>
                        <p style={{ fontSize: 13, color: '#374151', marginBottom: 12 }}>{f.tips}</p>
                        <div style={{ display: 'flex', gap: 12 }}>
                          <a href={f.google_flights_url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 700, color: 'white', background: 'var(--color-primary)', padding: '8px 16px', borderRadius: 8, textDecoration: 'none' }}>
                            <ExternalLink size={13} /> Google Flights
                          </a>
                          <a href={f.skyscanner_url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 600, color: 'var(--color-primary)', textDecoration: 'none', border: '1.5px solid var(--color-primary)', padding: '8px 16px', borderRadius: 8 }}>
                            <ExternalLink size={13} /> Skyscanner
                          </a>
                        </div>
                      </div>
                    ))}
                    <button onClick={() => { setFlightSuggestions(null); setFlightSuggestionsLoading(true); getFlightSuggestions(tripId!).then(r => setFlightSuggestions(r.suggestions)).catch(() => setFlightSuggestions([])).finally(() => setFlightSuggestionsLoading(false)) }}
                      style={{ background: 'white', border: '1.5px solid var(--color-border)', padding: '10px 20px', borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: 'pointer', color: 'var(--color-text-muted)' }}>
                      Refresh suggestions
                    </button>
                  </div>
                )}
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
