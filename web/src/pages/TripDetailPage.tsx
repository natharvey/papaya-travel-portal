import React, { lazy, Suspense, useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import PDFDownloadButton from '../components/PDFDownloadButton'
import Layout from '../components/Layout'
import ItineraryTimeline, { buildCopyText } from '../components/ItineraryTimeline'
import LoadingSpinner from '../components/LoadingSpinner'
import MayaChatPanel from '../components/MayaChatPanel'
import HotelDetailPanel from '../components/HotelDetailPanel'
import HotelCard from '../components/HotelCard'
import Button from '../components/Button'
import Badge from '../components/Badge'
import { TabBar, Tab } from '../components/TabBar'
import { PlaneTakeoff, Calendar, Clock, Wallet, FileText, ExternalLink, Plane, Loader2, Pencil, MapPin } from 'lucide-react'
import { useDestinationPhoto } from '../hooks/useDestinationPhoto'
import type { HotelSuggestion } from '../types'
const FlightMap = lazy(() => import('../components/FlightMap'))
const UnifiedTripMap = lazy(() => import('../components/UnifiedTripMap'))
import { getClientTrip, listClientDocuments, uploadClientDocument, getClientDocumentUrl, deleteClientDocument, getApiError, editItineraryBlock, getAccommodationSuggestions, getFlightSuggestions, updateTripTitle, deleteTrip, clientLookupFlight, type TripDocument, type AccommodationSuggestion, type FlightSuggestion, type FlightLookupResult } from '../api/client'
import type { TripDetail, Message } from '../types'

const STATUS_BADGE: Record<string, 'active' | 'muted' | 'warning'> = {
  ACTIVE:     'active',
  COMPLETED:  'muted',
  GENERATING: 'warning',
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
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
    <Button variant="ghost" size="sm" onClick={handleCopy}>
      {copied ? '✓ Copied' : 'Copy summary'}
    </Button>
  )
}



const GENERATION_STEPS = [
  { label: 'Researching your destination', duration: 4000 },
  { label: 'Planning your day-by-day route', duration: 5000 },
  { label: 'Finding the best activities', duration: 5000 },
  { label: 'Sourcing hotel options', duration: 5000 },
  { label: 'Checking flights and routes', duration: 5000 },
  { label: 'Adding local tips and notes', duration: 4000 },
  { label: 'Finalising your itinerary', duration: 0 },
]

function GeneratingAnimation() {
  const [currentStep, setCurrentStep] = useState(0)

  useEffect(() => {
    const step = GENERATION_STEPS[currentStep]
    if (!step || step.duration === 0) return
    const timer = setTimeout(() => {
      setCurrentStep(s => Math.min(s + 1, GENERATION_STEPS.length - 1))
    }, step.duration)
    return () => clearTimeout(timer)
  }, [currentStep])

  return (
    <div style={{ maxWidth: 480, margin: '48px auto', padding: '0 20px' }}>
      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🌴</div>
        <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8, color: 'var(--color-text)' }}>
          Building your itinerary…
        </h3>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14, lineHeight: 1.6 }}>
          Usually takes 1–2 minutes. This page updates automatically.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {GENERATION_STEPS.map((step, i) => {
          const done = i < currentStep
          const active = i === currentStep
          return (
            <div
              key={i}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px',
                borderRadius: 'var(--radius)',
                background: done ? 'var(--color-bg)' : active ? 'var(--color-accent)' : 'transparent',
                border: `1px solid ${done ? 'var(--color-border)' : active ? '#FCD9B8' : 'transparent'}`,
                transition: 'all 0.4s ease',
                opacity: i > currentStep + 1 ? 0.35 : 1,
              }}
            >
              <div style={{
                width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: done ? 'var(--color-success)' : active ? 'var(--color-primary)' : 'var(--color-border)',
                transition: 'background 0.4s ease',
              }}>
                {done ? (
                  <span style={{ color: 'white', fontSize: 13, fontWeight: 700 }}>✓</span>
                ) : active ? (
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'white', display: 'inline-block', animation: 'blink 1s ease-in-out infinite' }} />
                ) : (
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'white', display: 'inline-block', opacity: 0.5 }} />
                )}
              </div>
              <span style={{
                fontSize: 14, fontWeight: active ? 600 : 400,
                color: done ? 'var(--color-text-muted)' : active ? 'var(--color-primary-dark)' : 'var(--color-text-muted)',
                transition: 'color 0.4s ease',
                textDecoration: done ? 'line-through' : 'none',
              }}>
                {step.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function TripDetailPage() {
  const { tripId } = useParams<{ tripId: string }>()
  const [trip, setTrip] = useState<TripDetail | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'itinerary' | 'accommodation' | 'flights' | 'notes' | 'documents'>('itinerary')
  const [documents, setDocuments] = useState<TripDocument[]>([])
  const [docUploading, setDocUploading] = useState(false)
  const [docError, setDocError] = useState('')

  function switchTab(next: 'itinerary' | 'accommodation' | 'flights' | 'notes' | 'documents') {
    setTab(next)
    // Auto-load accommodation suggestions when tab opens if itinerary has no hotel_suggestions
    if (next === 'accommodation' && !accommodation && !accommodationLoading) {
      const hasItinerarySuggestions = trip?.itineraries?.length &&
        trip.itineraries[trip.itineraries.length - 1]?.itinerary_json?.hotel_suggestions?.length
      if (!hasItinerarySuggestions) {
        setAccommodationLoading(true)
        getAccommodationSuggestions(tripId!).then(r => setAccommodation(r.suggestions)).catch(() => setAccommodation([])).finally(() => setAccommodationLoading(false))
      }
    }
  }

  // Selected day — shared between UnifiedTripMap and ItineraryTimeline
  const [selectedDay, setSelectedDay] = useState(1)

  // Hotel detail panel
  const [selectedHotel, setSelectedHotel] = useState<HotelSuggestion | null>(null)

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

  // Hero photos — all hooks must be called before early returns (Rules of Hooks)
  const latestItineraryForHero = trip?.itineraries?.length
    ? trip.itineraries.reduce((a, b) => a.version > b.version ? a : b)
    : null
  const heroDests = latestItineraryForHero?.itinerary_json.destinations || []
  const { photoUrl: heroPhoto0 } = useDestinationPhoto(heroDests[0]?.name || trip?.title || '')
  const { photoUrl: heroPhoto1 } = useDestinationPhoto(heroDests[1]?.name || '')
  const { photoUrl: heroPhoto2 } = useDestinationPhoto(heroDests[2]?.name || '')

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

  const statusBadgeVariant = STATUS_BADGE[trip.status] || 'warning'
  const latestItinerary = trip.itineraries.length > 0
    ? trip.itineraries.reduce((a, b) => a.version > b.version ? a : b)
    : null

  const tripDays = Math.ceil(
    (new Date(trip.end_date).getTime() - new Date(trip.start_date).getTime()) / (1000 * 60 * 60 * 24)
  )

  const showMosaic = heroDests.length >= 2
  const thumbDests = heroDests.slice(1, 3) // up to 2 right-side thumbnails
  const thumbPhotos = [heroPhoto1, heroPhoto2]

  return (
    <Layout variant="client">
      {/* ── HERO ── */}
      <div style={{ position: 'relative', width: '100%', height: 400, overflow: 'hidden', flexShrink: 0, background: 'var(--color-secondary)' }}>

        {showMosaic ? (
          /* ── Mosaic layout: main photo left, thumbnails right ── */
          <div style={{ display: 'grid', gridTemplateColumns: '62% 38%', gridTemplateRows: `repeat(${thumbDests.length === 1 ? 1 : 2}, 1fr)`, gap: 3, height: '100%' }}>
            {/* Main photo */}
            <div style={{ gridRow: `1 / ${thumbDests.length === 1 ? 2 : 3}`, position: 'relative', overflow: 'hidden', background: 'var(--color-secondary)' }}>
              {heroPhoto0 && <img src={heroPhoto0} alt={heroDests[0]?.name || trip.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.25) 50%, rgba(0,0,0,0.05) 100%)' }} />
            </div>
            {/* Thumbnails */}
            {thumbDests.map((dest, i) => (
              <div key={dest.name} style={{ position: 'relative', overflow: 'hidden', background: 'var(--color-secondary)' }}>
                {thumbPhotos[i] && <img src={thumbPhotos[i]!} alt={dest.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.0) 60%)' }} />
                <div style={{
                  position: 'absolute', bottom: 10, left: 12,
                  background: 'rgba(0,0,0,0.50)', backdropFilter: 'blur(6px)',
                  color: 'white', fontSize: 11, fontWeight: 700,
                  padding: '3px 9px', borderRadius: 5,
                }}>
                  {dest.name}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* ── Single photo banner fallback ── */
          <>
            {heroPhoto0 && <img src={heroPhoto0} alt={trip.title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.84) 0%, rgba(0,0,0,0.40) 55%, rgba(0,0,0,0.14) 100%)' }} />
          </>
        )}

        {/* Top row: breadcrumb + status + delete */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '22px 40px', zIndex: 2 }}>
          <Link to="/portal" style={{ color: 'rgba(255,255,255,0.72)', fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>
            ← Your Trips
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Badge variant={statusBadgeVariant}>{trip.status}</Badge>
            {confirmDelete ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>Delete trip?</span>
                <button onClick={handleDeleteTrip} disabled={deleting} className="hero-btn-delete" style={{ borderColor: 'var(--color-error)', color: '#FCA5A5', fontWeight: 700 }}>
                  {deleting ? '...' : 'Yes, delete'}
                </button>
                <button onClick={() => setConfirmDelete(false)} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="hero-btn-delete"
              >
                Delete trip
              </button>
            )}
          </div>
        </div>

        {/* Bottom: title + meta — constrained to main photo area in mosaic */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: showMosaic ? '38%' : 0, padding: '0 40px 36px', zIndex: 2 }}>
          {editingTitle ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <input
                autoFocus
                value={titleInput}
                onChange={e => setTitleInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveTitle(); if (e.key === 'Escape') setEditingTitle(false) }}
                style={{
                  fontSize: '36px', fontWeight: 900, background: 'rgba(255,255,255,0.1)',
                  border: '1.5px solid rgba(255,255,255,0.4)', borderRadius: 10,
                  padding: '6px 14px', color: 'white', outline: 'none', fontFamily: 'inherit', width: 480,
                }}
              />
              <button onClick={handleSaveTitle} disabled={titleSaving} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, padding: '8px 16px', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
                {titleSaving ? '...' : 'Save'}
              </button>
              <button onClick={() => setEditingTitle(false)} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancel
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <h1 style={{ fontSize: showMosaic ? '36px' : '46px', fontWeight: 900, color: 'white', margin: 0, lineHeight: 1.05, letterSpacing: '-0.5px', textShadow: '0 2px 24px rgba(0,0,0,0.4)' }}>{trip.title}</h1>
              <button
                onClick={() => { setTitleInput(trip.title); setEditingTitle(true) }}
                title="Edit title"
                className="hero-btn-icon"
              >
                <Pencil size={13} strokeWidth={2} />
              </button>
            </div>
          )}
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {[
              { Icon: PlaneTakeoff, label: `From ${trip.origin_city}` },
              { Icon: Calendar, label: `${formatDate(trip.start_date)} — ${formatDate(trip.end_date)}` },
              { Icon: Clock, label: `${tripDays} days` },
              { Icon: Wallet, label: `$${trip.budget_range}` },
            ].map(({ Icon, label }) => (
              <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: 'rgba(255,255,255,0.72)', fontWeight: 500 }}>
                <Icon size={13} color="rgba(255,255,255,0.45)" strokeWidth={2} />
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 40px 80px' }}>
        {/* Tabs */}
        <TabBar style={{ marginBottom: 36, marginTop: 8 }}>
          <Tab label="Itinerary" active={tab === 'itinerary'} onClick={() => switchTab('itinerary')} />
          <Tab label="Accommodation" active={tab === 'accommodation'} onClick={() => switchTab('accommodation')} />
          <Tab label="Flights" active={tab === 'flights'} onClick={() => switchTab('flights')} />
          <Tab label="Travel Notes" active={tab === 'notes'} onClick={() => switchTab('notes')} />
          <Tab label={`Documents${documents.length > 0 ? ` (${documents.length})` : ''}`} active={tab === 'documents'} onClick={() => switchTab('documents')} />
        </TabBar>
        <div>
            {/* Itinerary Tab */}
            {tab === 'itinerary' && (
              <>
                {trip.status === 'GENERATING' && <GeneratingAnimation />}
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
                    {/* Blurb: overview + destination pills — match ItineraryTimeline's 820px width */}
                    {(latestItinerary.itinerary_json.overview || latestItinerary.itinerary_json.destinations?.length > 0) && (
                      <div style={{ marginBottom: 24, maxWidth: 820 }}>
                        {latestItinerary.itinerary_json.overview && (
                          <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', lineHeight: '1.8', marginBottom: '14px' }}>
                            {latestItinerary.itinerary_json.overview}
                          </p>
                        )}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                          {latestItinerary.itinerary_json.destinations?.map((d: { name: string; nights: number }, i: number) => (
                            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)', padding: '4px 12px', borderRadius: '100px', fontSize: '12px', fontWeight: 600 }}>
                              <MapPin size={11} strokeWidth={2.5} color="var(--color-primary)" />
                              {d.name} · {d.nights} {d.nights === 1 ? 'night' : 'nights'}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Unified journey map — shows full trip routes + flies to selected day */}
                    {((latestItinerary.itinerary_json.destinations?.length ?? 0) > 0 || (latestItinerary.itinerary_json.transport_legs?.length ?? 0) > 0) && (
                      <div style={{ maxWidth: 820 }}>
                        <Suspense fallback={<div style={{ height: 340, background: '#e8f0f5', borderRadius: 12, marginBottom: 28 }} />}>
                          <UnifiedTripMap
                            itinerary={latestItinerary.itinerary_json}
                            originCity={trip.origin_city}
                            stays={trip.stays ?? []}
                            selectedDayNum={selectedDay}
                            onDaySelect={setSelectedDay}
                          />
                        </Suspense>
                      </div>
                    )}

                    <ItineraryTimeline
                      data={latestItinerary.itinerary_json}
                      hideOverview
                      hideSections
                      selectedDay={selectedDay}
                      onDaySelect={setSelectedDay}
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

            {/* Accommodation Tab */}
            {tab === 'accommodation' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

                {/* Confirmed stays */}
                {trip.stays && trip.stays.length > 0 && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                      <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>Confirmed Stays</h3>
                      <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {trip.stays.map(stay => {
                        const nights = Math.round((new Date(stay.check_out).getTime() - new Date(stay.check_in).getTime()) / 86400000)
                        const photoUrl = stay.photo_reference
                          ? `https://places.googleapis.com/v1/${stay.photo_reference}/media?maxHeightPx=300&maxWidthPx=500&key=${import.meta.env.VITE_GOOGLE_PLACES_API_KEY}`
                          : null
                        return (
                          <div key={stay.id} style={{ border: '1.5px solid #BBF7D0', borderRadius: 12, overflow: 'hidden', background: '#F0FDF4' }}>
                            {photoUrl && (
                              <img src={photoUrl} alt={stay.name} style={{ width: '100%', height: 160, objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                            )}
                            <div style={{ padding: '14px 16px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                                <div>
                                  <div style={{ fontWeight: 700, fontSize: 15, color: '#166534' }}>{stay.name}</div>
                                  {stay.address && <div style={{ fontSize: 12, color: '#15803D', marginTop: 2 }}>{stay.address}</div>}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                                  <span style={{ background: '#166534', color: 'white', borderRadius: 6, padding: '3px 9px', fontSize: 12, fontWeight: 700 }}>{nights}n</span>
                                  {stay.rating && <span style={{ fontSize: 12, color: '#15803D', fontWeight: 600 }}>★ {stay.rating}</span>}
                                </div>
                              </div>
                              <div style={{ fontSize: 12, color: '#15803D', marginBottom: 8 }}>
                                {new Date(stay.check_in).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} → {new Date(stay.check_out).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                                {stay.confirmation_number && <span style={{ marginLeft: 10 }}>· Ref: <strong>{stay.confirmation_number}</strong></span>}
                              </div>
                              <div style={{ display: 'flex', gap: 10 }}>
                                {stay.website && <a href={stay.website} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: '#15803D', textDecoration: 'none' }}><ExternalLink size={12} /> Website</a>}
                                {stay.google_place_id && <a href={`https://www.google.com/maps/place/?q=place_id:${stay.google_place_id}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: '#15803D', textDecoration: 'none' }}><ExternalLink size={12} /> Maps</a>}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Hotel suggestions from itinerary */}
                {latestItinerary?.itinerary_json.hotel_suggestions && latestItinerary.itinerary_json.hotel_suggestions.length > 0 && (() => {
                  const suggestions = latestItinerary.itinerary_json.hotel_suggestions!
                  const grouped: Record<string, typeof suggestions> = {}
                  suggestions.forEach(h => {
                    if (!grouped[h.destination]) grouped[h.destination] = []
                    grouped[h.destination].push(h)
                  })
                  return (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>Suggested Hotels</h3>
                        <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                        {Object.keys(grouped).map(dest => (
                          <div key={dest}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{dest}</div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
                              {grouped[dest].map((h, i) => (
                                <HotelCard key={i} hotel={h} onClick={() => setSelectedHotel(h)} />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}

                {/* On-demand AI search — shown as "More Options" only if itinerary suggestions already displayed above, otherwise hidden (auto-triggered) */}
                {(() => {
                  const hasItinerarySuggestions = latestItinerary?.itinerary_json.hotel_suggestions?.length
                  const sectionLabel = hasItinerarySuggestions ? 'More Options' : 'Suggested Hotels'
                  return (
                    <div>
                      {accommodationLoading && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--color-text-muted)', fontSize: 13, padding: '8px 0' }}>
                          <LoadingSpinner size={20} label="" /> Finding hotel suggestions…
                        </div>
                      )}
                      {!accommodation && !accommodationLoading && hasItinerarySuggestions && (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>{sectionLabel}</h3>
                            <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
                          </div>
                          <button
                            onClick={() => { setAccommodationLoading(true); getAccommodationSuggestions(tripId!).then(r => setAccommodation(r.suggestions)).catch(() => setAccommodation([])).finally(() => setAccommodationLoading(false)) }}
                            style={{ background: 'var(--color-bg)', border: '1.5px solid var(--color-border)', padding: '10px 20px', borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: 'pointer', color: 'var(--color-text-muted)', fontFamily: 'inherit' }}>
                            Search additional options
                          </button>
                        </div>
                      )}
                      {accommodation && accommodation.length > 0 && (
                        <div>
                          {hasItinerarySuggestions && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>{sectionLabel}</h3>
                              <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
                            </div>
                          )}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
                            {accommodation.map((a, i) => (
                              <HotelCard
                                key={i}
                                hotel={{ destination: a.destination, name: a.name, area: a.area, style: a.style, why_suits: a.why_suits, price_per_night_aud: a.price_per_night_aud, booking_com_search: a.booking_com_search, google_maps_url: a.google_maps_url }}
                                onClick={() => setSelectedHotel({ destination: a.destination, name: a.name, area: a.area, style: a.style, why_suits: a.why_suits, price_per_night_aud: a.price_per_night_aud, booking_com_search: a.booking_com_search, google_maps_url: a.google_maps_url })}
                              />
                            ))}
                          </div>
                        </div>
                      )}
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
                    <Suspense fallback={<div style={{ height: 260, background: 'var(--color-secondary)', borderRadius: 'var(--radius-lg)' }} />}>
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
                      <Suspense fallback={<div style={{ height: 180, background: 'var(--color-secondary)', borderRadius: 8 }} />}>
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {flightSuggestions.map((f, i) => {
                        const iatas = [...f.route.matchAll(/\(([A-Z]{3})\)/g)].map((m: RegExpMatchArray) => m[1])
                        const fromCode = iatas[0] || ''
                        const toCode = iatas[1] || ''

                        // Parse flight_time: take only the first option (before ';'), strip parenthetical airline names
                        const primaryFlightTime = (f.flight_time || '')
                          .split(/;/)[0]
                          .replace(/\s*\([^)]*\)/g, '')
                          .trim()

                        // Parse price: extract the first price range (e.g. "$300–$700") from potentially verbose AI prose
                        const priceMatch = (f.typical_price_aud || '').match(/~?\$[\d,]+(?:[–\-]~?\$[\d,]+)?/)
                        const displayPrice = priceMatch ? priceMatch[0] : f.typical_price_aud

                        // Detect summary legs (no parseable IATA codes — AI generated a multi-leg summary)
                        const isSummaryLeg = !fromCode && !toCode

                        // For summary legs, parse pipe-separated segments into individual rows
                        const summarySegments = isSummaryLeg
                          ? (f.flight_time || '').split('|').map(s => s.trim()).filter(Boolean)
                          : []

                        return (
                        <div key={i} style={{ border: '1px solid var(--color-border)', borderRadius: 16, padding: '24px 28px', background: 'white' }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 18 }}>Leg {i + 1}</div>

                          {isSummaryLeg ? (
                            /* Summary leg: no IATA codes, show price + segment breakdown */
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, gap: 24 }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {summarySegments.map((seg, si) => (
                                  <div key={si} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-text-muted)' }}>
                                    <Plane size={12} color="var(--color-text-muted)" strokeWidth={2} style={{ flexShrink: 0 }} />
                                    <span>{seg}</span>
                                  </div>
                                ))}
                              </div>
                              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--color-text)' }}>{displayPrice}</div>
                                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 500 }}>est. total</div>
                              </div>
                            </div>
                          ) : (
                            /* Standard leg: IATA route row */
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 6 }}>
                              <div style={{ fontSize: 34, fontWeight: 900, color: 'var(--color-text)', letterSpacing: '-0.5px', lineHeight: 1 }}>{fromCode}</div>
                              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
                                  <Plane size={15} color="var(--color-text-muted)" strokeWidth={2} />
                                  <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
                                </div>
                                <span style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>{primaryFlightTime}</span>
                              </div>
                              <div style={{ fontSize: 34, fontWeight: 900, color: 'var(--color-text)', letterSpacing: '-0.5px', lineHeight: 1 }}>{toCode}</div>
                              <div style={{ marginLeft: 'auto', textAlign: 'right', flexShrink: 0 }}>
                                <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--color-text)' }}>{displayPrice}</div>
                                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 500 }}>est. one-way</div>
                              </div>
                            </div>
                          )}

                          <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16 }}>{f.airlines.join(' · ')}</div>
                          {f.tips && <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 18, lineHeight: 1.65, borderTop: '1px solid var(--color-border)', paddingTop: 14 }}>{f.tips}</p>}
                          <div style={{ display: 'flex', gap: 10 }}>
                            <a href={f.google_flights_url} target="_blank" rel="noopener noreferrer" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'white', background: 'var(--color-secondary)', padding: '11px 16px', borderRadius: 10, textDecoration: 'none' }}>
                              <ExternalLink size={13} /> Google Flights
                            </a>
                            <a href={f.skyscanner_url} target="_blank" rel="noopener noreferrer" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--color-text-muted)', textDecoration: 'none', border: '1.5px solid var(--color-border)', padding: '11px 16px', borderRadius: 10 }}>
                              <ExternalLink size={13} /> Skyscanner
                            </a>
                          </div>
                        </div>
                        )
                      })}
                      <button onClick={() => { setFlightSuggestions(null); setFlightSuggestionsLoading(true); getFlightSuggestions(tripId!).then(r => setFlightSuggestions(r.suggestions)).catch(() => setFlightSuggestions([])).finally(() => setFlightSuggestionsLoading(false)) }}
                        style={{ alignSelf: 'flex-start', background: 'white', border: '1.5px solid var(--color-border)', padding: '8px 16px', borderRadius: 8, fontWeight: 600, fontSize: 12, cursor: 'pointer', color: 'var(--color-text-muted)', fontFamily: 'inherit' }}>
                        Refresh suggestions
                      </button>
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* Travel Notes Tab */}
            {tab === 'notes' && (
              latestItinerary ? (
                <ItineraryTimeline
                  data={latestItinerary.itinerary_json}
                  sectionsOnly
                  hideOverview
                />
              ) : (
                <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--color-text-muted)' }}>
                  <p style={{ fontSize: 14 }}>Travel notes will appear here once your itinerary is ready.</p>
                </div>
              )
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
                              style={{ background: 'white', color: 'var(--color-error)', border: '1px solid #FECACA', borderRadius: 'var(--radius)', padding: '6px 10px', fontSize: '12px', cursor: 'pointer' }}
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

      {/* Floating Maya + Advisor chat */}
      {trip && (
        <MayaChatPanel
          tripId={trip.id}
          messages={messages}
          onMessagesUpdated={setMessages}
          onItineraryUpdated={newItinerary =>
            setTrip(prev => prev ? { ...prev, itineraries: [...prev.itineraries, newItinerary] } : prev)
          }
          hidden={!!selectedHotel}
        />
      )}

      {/* Hotel detail panel */}
      <HotelDetailPanel hotel={selectedHotel} onClose={() => setSelectedHotel(null)} />

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </Layout>
  )
}
