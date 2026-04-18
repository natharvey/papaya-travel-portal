import React, { lazy, Suspense, useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import PDFDownloadButton from '../components/PDFDownloadButton'
import Layout from '../components/Layout'
import ItineraryTimeline, { buildCopyText } from '../components/ItineraryTimeline'
import TravelNotesTab from '../components/TravelNotesTab'
import LoadingSpinner from '../components/LoadingSpinner'
import MayaChatPanel from '../components/MayaChatPanel'
import AccommodationTab from '../components/AccommodationTab'
import Button from '../components/Button'
import Badge from '../components/Badge'
import DatePicker from '../components/DatePicker'
import TripItineraryView from '../components/TripItineraryView'
import { TabBar, Tab } from '../components/TabBar'
import { PlaneTakeoff, Calendar, Clock, Wallet, FileText, ExternalLink, Plane, Loader2, Pencil, MapPin } from 'lucide-react'
import { useDestinationPhotos } from '../hooks/useDestinationPhotos'
const FlightMap = lazy(() => import('../components/FlightMap'))
const UnifiedTripMap = lazy(() => import('../components/UnifiedTripMap'))
import { getClientTrip, listClientDocuments, uploadClientDocument, getClientDocumentUrl, deleteClientDocument, getApiError, editItineraryBlock, getFlightSuggestions, updateTripTitle, deleteTrip, clientLookupFlight, addClientStay, removeClientStay, type TripDocument, type FlightSuggestion, type FlightLookupResult } from '../api/client'
import type { TripDetail, Message, HotelSuggestion as HotelSuggestionType, Stay } from '../types'

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



function buildResearchMessages(trip: import('../types').TripDetail | null): string[] {
  const dest = trip?.title || 'your destination'
  const origin = trip?.origin_city ? trip.origin_city.split(',')[0] : 'home'
  const days = trip?.start_date && trip?.end_date
    ? Math.round((new Date(trip.end_date).getTime() - new Date(trip.start_date).getTime()) / 86400000)
    : null
  const pace = trip?.pace || 'moderate'
  const budget = trip?.budget_range || ''

  return [
    `Analysing the best time of year to visit ${dest}…`,
    `Mapping distances and travel times across your route…`,
    `Researching must-see landmarks and hidden gems…`,
    days ? `Distributing ${days} days across your destinations for the best experience…` : `Balancing your days across each destination…`,
    `Identifying ${pace}-pace activities that match your style…`,
    `Cross-referencing local events and seasonal highlights…`,
    `Finding the right accommodation areas for each stop…`,
    budget ? `Calibrating recommendations to your ${budget} budget…` : `Tailoring recommendations to your budget…`,
    `Checking typical flight routes from ${origin}…`,
    `Weaving in cultural context and local tips…`,
    `Reviewing day-by-day flow for a seamless journey…`,
    `Putting the finishing touches on your itinerary…`,
  ]
}

function GeneratingAnimation({ trip }: { trip: import('../types').TripDetail | null }) {
  const messages = buildResearchMessages(trip)
  const [msgIndex, setMsgIndex] = useState(0)
  const [visible, setVisible] = useState(true)
  const [progress, setProgress] = useState(0)

  // Rotate messages with a fade
  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setMsgIndex(i => (i + 1) % messages.length)
        setVisible(true)
      }, 400)
    }, 3500)
    return () => clearInterval(interval)
  }, [messages.length])

  // Slowly advance a progress bar (never reaches 100 — server controls completion)
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 92) return p  // stall near the end, don't fake completion
        return p + (92 - p) * 0.018  // eases toward 92%
      })
    }, 800)
    return () => clearInterval(interval)
  }, [])

  const destLine = trip?.title
    ? `${trip.title}${trip.origin_city ? ` · from ${trip.origin_city.split(',')[0]}` : ''}`
    : 'Your trip'

  return (
    <>
      <style>{`
        @keyframes papaya-pulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.08); }
        }
        @keyframes papaya-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes papaya-fade-in {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div style={{
        margin: '0 auto',
        padding: '64px 32px 80px',
        maxWidth: 560,
        textAlign: 'center',
      }}>
        {/* Spinner */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            border: '2.5px solid var(--color-border)',
            borderTopColor: 'var(--color-primary)',
            animation: 'papaya-spin 1s linear infinite',
          }} />
        </div>

        {/* Heading */}
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-primary)', marginBottom: 12 }}>
          Crafting your itinerary
        </div>
        <h2 style={{ fontSize: 26, fontWeight: 900, color: 'var(--color-text)', margin: '0 0 8px', letterSpacing: '-0.5px', lineHeight: 1.2 }}>
          {destLine}
        </h2>
        <p style={{ fontSize: 14, color: 'var(--color-text-muted)', margin: '0 0 40px', lineHeight: 1.6 }}>
          Usually 3–8 minutes · up to 15 for longer trips.<br />
          This page will refresh automatically when ready.
        </p>

        {/* Progress bar */}
        <div style={{
          height: 3, borderRadius: 99,
          background: 'var(--color-border)',
          marginBottom: 32, overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', borderRadius: 99,
            background: 'linear-gradient(90deg, var(--color-primary), var(--color-primary-dark))',
            width: `${progress}%`,
            transition: 'width 0.8s ease',
          }} />
        </div>

        {/* Rotating research message */}
        <div style={{
          minHeight: 48,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <p style={{
            fontSize: 14, color: 'var(--color-text-muted)', lineHeight: 1.6,
            fontStyle: 'italic', margin: 0,
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(4px)',
            transition: 'opacity 0.4s ease, transform 0.4s ease',
          }}>
            {messages[msgIndex]}
          </p>
        </div>
      </div>
    </>
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
  }

  // Selected day — shared between UnifiedTripMap and ItineraryTimeline
  const [selectedDay, setSelectedDay] = useState(0)

  // Flight suggestions — auto-load when tab is first opened
  const [flightSuggestions, setFlightSuggestions] = useState<FlightSuggestion[] | null>(null)
  const [flightSuggestionsLoading, setFlightSuggestionsLoading] = useState(false)

  useEffect(() => {
    if (tab === 'flights' && flightSuggestions === null && !flightSuggestionsLoading && tripId) {
      setFlightSuggestionsLoading(true)
      getFlightSuggestions(tripId).then(r => setFlightSuggestions(r.suggestions)).catch(() => setFlightSuggestions([])).finally(() => setFlightSuggestionsLoading(false))
    }
  }, [tab]) // eslint-disable-line react-hooks/exhaustive-deps

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


  // Stay management
  const [addingStayFrom, setAddingStayFrom] = useState<HotelSuggestionType | null>(null)
  const [manualStayOpen, setManualStayOpen] = useState(false)
  const [stayCheckIn, setStayCheckIn] = useState('')
  const [stayCheckOut, setStayCheckOut] = useState('')
  const [stayName, setStayName] = useState('')
  const [stayAddress, setStayAddress] = useState('')
  const [stayConfirmation, setStayConfirmation] = useState('')
  const [staySaving, setStaySaving] = useState(false)
  const [stayError, setStayError] = useState('')
  const [removingStayId, setRemovingStayId] = useState<string | null>(null)

  async function handleAddStayFromSuggestion() {
    if (!tripId || !addingStayFrom || !stayCheckIn || !stayCheckOut) return
    setStaySaving(true)
    setStayError('')
    try {
      const payload = {
        name: addingStayFrom.name,
        address: addingStayFrom.address ?? undefined,
        check_in: new Date(stayCheckIn).toISOString(),
        check_out: new Date(stayCheckOut).toISOString(),
        latitude: addingStayFrom.lat ?? undefined,
        longitude: addingStayFrom.lng ?? undefined,
        google_place_id: addingStayFrom.place_id ?? undefined,
        website: addingStayFrom.website ?? undefined,
        rating: addingStayFrom.rating ?? undefined,
        photo_reference: addingStayFrom.photo_url ?? undefined,
      }
      await addClientStay(tripId, payload)
      const refreshed = await getClientTrip(tripId)
      setTrip(refreshed)
      setAddingStayFrom(null)
      setStayCheckIn('')
      setStayCheckOut('')
    } catch (e) {
      setStayError(getApiError(e))
    } finally {
      setStaySaving(false)
    }
  }

  async function handleAddManualStay() {
    if (!tripId || !stayName || !stayCheckIn || !stayCheckOut) return
    setStaySaving(true)
    setStayError('')
    try {
      await addClientStay(tripId, {
        name: stayName,
        address: stayAddress || undefined,
        check_in: new Date(stayCheckIn).toISOString(),
        check_out: new Date(stayCheckOut).toISOString(),
        confirmation_number: stayConfirmation || undefined,
      })
      const refreshed = await getClientTrip(tripId)
      setTrip(refreshed)
      setManualStayOpen(false)
      setStayName(''); setStayAddress(''); setStayCheckIn(''); setStayCheckOut(''); setStayConfirmation('')
    } catch (e) {
      setStayError(getApiError(e))
    } finally {
      setStaySaving(false)
    }
  }

  async function handleRemoveStay(stayId: string) {
    if (!tripId) return
    setRemovingStayId(stayId)
    try {
      await removeClientStay(tripId, stayId)
      const refreshed = await getClientTrip(tripId)
      setTrip(refreshed)
    } catch (e) {
      alert(getApiError(e))
    } finally {
      setRemovingStayId(null)
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
  const { photos: heroPhotos } = useDestinationPhotos([
    heroDests[0]?.name || trip?.title || '',
    heroDests[1]?.name || '',
    heroDests[2]?.name || '',
  ])
  const [heroPhoto0, heroPhoto1, heroPhoto2] = heroPhotos

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

  const tripDays = latestItineraryForHero?.itinerary_json?.day_plans?.length
    || Math.ceil((new Date(trip.end_date).getTime() - new Date(trip.start_date).getTime()) / (1000 * 60 * 60 * 24))

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
              {heroPhoto0 && <img src={heroPhoto0} alt={heroDests[0]?.name || trip.title} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'saturate(1.35) brightness(1.08) contrast(1.05)' }} />}
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.18) 50%, rgba(0,0,0,0.04) 100%)' }} />
            </div>
            {/* Thumbnails */}
            {thumbDests.map((dest, i) => (
              <div key={dest.name} style={{ position: 'relative', overflow: 'hidden', background: 'var(--color-secondary)' }}>
                {thumbPhotos[i] && <img src={thumbPhotos[i]!} alt={dest.name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 60%', filter: 'saturate(1.35) brightness(1.08) contrast(1.05)' }} />}
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.0) 60%)' }} />
              </div>
            ))}
          </div>
        ) : (
          /* ── Single photo banner fallback ── */
          <>
            {heroPhoto0 && <img src={heroPhoto0} alt={trip.title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'saturate(1.35) brightness(1.08) contrast(1.05)' }} />}
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.35) 55%, rgba(0,0,0,0.10) 100%)' }} />
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
      <div style={{ width: 'min(90vw, 1440px)', margin: '0 auto', padding: '0 0 80px' }}>
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
                {trip.status === 'GENERATING' && <GeneratingAnimation trip={trip} />}
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
                  <TripItineraryView
                    itinerary={latestItinerary}
                    trip={trip}
                    itineraryCount={trip.itineraries.length}
                    selectedDay={selectedDay}
                    onDaySelect={setSelectedDay}
                    onBlockEdit={async (dayNum, period, blockTitle, prompt) => {
                      if (!tripId) return null
                      const res = await editItineraryBlock(tripId, {
                        day_number: dayNum,
                        period,
                        block_title: blockTitle,
                        instruction: prompt,
                      })
                      if (res.itinerary_updated && res.new_itinerary) {
                        setTrip(prev => prev ? { ...prev, itineraries: [...prev.itineraries, res.new_itinerary!] } : prev)
                        const newDay = res.new_itinerary.itinerary_json.day_plans.find(d => d.day_number === dayNum)
                        return (newDay?.[period as keyof typeof newDay] as import('../types').DayBlock) ?? null
                      }
                      return null
                    }}
                    onAddFromSuggestion={(hotel) => { setAddingStayFrom(hotel); setStayCheckIn(''); setStayCheckOut(''); setStayError('') }}
                  />
                )}
              </>
            )}

            {/* Accommodation Tab */}
            {tab === 'accommodation' && (
              <>
                {/* Add-stay-from-suggestion modal */}
                {addingStayFrom && (
                  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: 'white', borderRadius: 16, padding: 32, width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
                      <h3 style={{ margin: '0 0 6px 0', fontSize: 18, fontWeight: 700 }}>Add to trip</h3>
                      <p style={{ margin: '0 0 20px 0', fontSize: 14, color: 'var(--color-text-muted)' }}>{addingStayFrom.name}</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div>
                          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: 5 }}>Check-in date</label>
                          <DatePicker value={stayCheckIn} onChange={setStayCheckIn} placeholder="Select check-in" min={trip.start_date?.slice(0, 10)} max={trip.end_date?.slice(0, 10)} />
                        </div>
                        <div>
                          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: 5 }}>Check-out date</label>
                          <DatePicker value={stayCheckOut} onChange={setStayCheckOut} placeholder="Select check-out" min={stayCheckIn || trip.start_date?.slice(0, 10)} max={trip.end_date?.slice(0, 10)} />
                        </div>
                        {stayError && <p style={{ margin: 0, color: '#dc2626', fontSize: 13 }}>{stayError}</p>}
                      </div>
                      <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                        <button onClick={() => { setAddingStayFrom(null); setStayCheckIn(''); setStayCheckOut(''); setStayError('') }} style={{ flex: 1, background: 'var(--color-bg)', border: '1.5px solid var(--color-border)', borderRadius: 8, padding: '11px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                        <button onClick={handleAddStayFromSuggestion} disabled={staySaving || !stayCheckIn || !stayCheckOut} style={{ flex: 1, background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: 8, padding: '11px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: staySaving || !stayCheckIn || !stayCheckOut ? 0.6 : 1 }}>
                          {staySaving ? 'Adding…' : 'Add to trip'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Manual add stay modal */}
                {manualStayOpen && (
                  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: 'white', borderRadius: 16, padding: 32, width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
                      <h3 style={{ margin: '0 0 20px 0', fontSize: 18, fontWeight: 700 }}>Add accommodation manually</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div>
                          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: 5 }}>Property name *</label>
                          <input value={stayName} onChange={e => setStayName(e.target.value)} placeholder="e.g. Park Hyatt Tokyo" style={{ width: '100%', border: '1.5px solid var(--color-border)', borderRadius: 8, padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }} />
                        </div>
                        <div>
                          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: 5 }}>Address (optional)</label>
                          <input value={stayAddress} onChange={e => setStayAddress(e.target.value)} placeholder="e.g. 3-1-1 Nishi-Shinjuku, Tokyo" style={{ width: '100%', border: '1.5px solid var(--color-border)', borderRadius: 8, padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                          <div>
                            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: 5 }}>Check-in *</label>
                            <DatePicker value={stayCheckIn} onChange={setStayCheckIn} placeholder="Select check-in" min={trip.start_date?.slice(0, 10)} max={trip.end_date?.slice(0, 10)} />
                          </div>
                          <div>
                            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: 5 }}>Check-out *</label>
                            <DatePicker value={stayCheckOut} onChange={setStayCheckOut} placeholder="Select check-out" min={stayCheckIn || trip.start_date?.slice(0, 10)} max={trip.end_date?.slice(0, 10)} />
                          </div>
                        </div>
                        <div>
                          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: 5 }}>Confirmation number (optional)</label>
                          <input value={stayConfirmation} onChange={e => setStayConfirmation(e.target.value)} placeholder="e.g. HYA-28491" style={{ width: '100%', border: '1.5px solid var(--color-border)', borderRadius: 8, padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }} />
                        </div>
                        {stayError && <p style={{ margin: 0, color: '#dc2626', fontSize: 13 }}>{stayError}</p>}
                      </div>
                      <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                        <button onClick={() => { setManualStayOpen(false); setStayName(''); setStayAddress(''); setStayCheckIn(''); setStayCheckOut(''); setStayConfirmation(''); setStayError('') }} style={{ flex: 1, background: 'var(--color-bg)', border: '1.5px solid var(--color-border)', borderRadius: 8, padding: '11px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                        <button onClick={handleAddManualStay} disabled={staySaving || !stayName || !stayCheckIn || !stayCheckOut} style={{ flex: 1, background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: 8, padding: '11px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: staySaving || !stayName || !stayCheckIn || !stayCheckOut ? 0.6 : 1 }}>
                          {staySaving ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <AccommodationTab
                  tripId={tripId!}
                  trip={trip}
                  onAddFromSuggestion={(hotel) => { setAddingStayFrom(hotel); setStayCheckIn(''); setStayCheckOut(''); setStayError('') }}
                  onRemoveStay={handleRemoveStay}
                  removingStayId={removingStayId}
                  onManualAdd={() => setManualStayOpen(true)}
                />
              </>
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
                    <DatePicker
                      value={lookupDate}
                      onChange={setLookupDate}
                      placeholder="Flight date"
                      min={trip.start_date?.slice(0, 10)}
                      max={trip.end_date?.slice(0, 10)}
                      style={{ width: 160 }}
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
                        const fromCode = f.origin_iata || ''
                        const toCode = f.dest_iata || ''
                        const legType = f.leg_type || 'outbound'
                        const bullets: string[] = f.tips_bullets?.length ? f.tips_bullets : f.tips ? [f.tips] : []

                        const LEG_TYPE_STYLE: Record<string, { label: string; color: string; bg: string }> = {
                          outbound: { label: 'Outbound', color: '#059669', bg: '#D1FAE5' },
                          internal: { label: 'Internal', color: '#2563EB', bg: '#DBEAFE' },
                          return:   { label: 'Return',   color: '#6B7280', bg: '#F3F4F6' },
                        }
                        const legStyle = LEG_TYPE_STYLE[legType] ?? LEG_TYPE_STYLE.outbound

                        // Build URLs from IATA codes + trip dates (avoids AI hallucinating broken links)
                        const dateForLeg = legType === 'return' ? trip?.end_date : trip?.start_date
                        const googleUrl = fromCode && toCode && dateForLeg
                          ? `https://www.google.com/travel/flights?q=Flights+from+${fromCode}+to+${toCode}+on+${dateForLeg.slice(0, 10)}&curr=AUD`
                          : f.google_flights_url || '#'
                        const skyDate = dateForLeg ? (() => {
                          const d = new Date(dateForLeg)
                          return `${String(d.getFullYear()).slice(2)}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`
                        })() : ''
                        const skyUrl = fromCode && toCode && skyDate
                          ? `https://www.skyscanner.com.au/transport/flights/${fromCode.toLowerCase()}/${toCode.toLowerCase()}/${skyDate}/`
                          : f.skyscanner_url || '#'

                        return (
                        <div key={i} style={{ border: '1px solid var(--color-border)', borderRadius: 16, padding: '20px 24px', background: 'white' }}>
                          {/* Header row: leg number + type badge */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Leg {i + 1}</span>
                            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '2px 8px', borderRadius: 100, background: legStyle.bg, color: legStyle.color }}>{legStyle.label}</span>
                          </div>

                          {/* IATA route row */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 10 }}>
                            <div style={{ fontSize: 34, fontWeight: 900, color: 'var(--color-text)', letterSpacing: '-0.5px', lineHeight: 1 }}>{fromCode || '—'}</div>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                              <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
                                <Plane size={15} color="var(--color-text-muted)" strokeWidth={2} />
                                <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
                              </div>
                              <span style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>{f.flight_time}</span>
                            </div>
                            <div style={{ fontSize: 34, fontWeight: 900, color: 'var(--color-text)', letterSpacing: '-0.5px', lineHeight: 1 }}>{toCode || '—'}</div>
                            <div style={{ marginLeft: 'auto', textAlign: 'right', flexShrink: 0 }}>
                              <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--color-text)' }}>{f.typical_price_aud}</div>
                              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 500 }}>est. {legType === 'return' ? 'one-way' : 'one-way'}</div>
                            </div>
                          </div>

                          {/* Airlines */}
                          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: bullets.length ? 14 : 16 }}>{f.airlines.join(' · ')}</div>

                          {/* Tips as bullets */}
                          {bullets.length > 0 && (
                            <ul style={{ margin: '0 0 16px', padding: 0, listStyle: 'none', borderTop: '1px solid var(--color-border)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {bullets.map((b, bi) => (
                                <li key={bi} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                                  <span style={{ color: 'var(--color-primary)', fontWeight: 700, flexShrink: 0, marginTop: 1 }}>·</span>
                                  <span>{b}</span>
                                </li>
                              ))}
                            </ul>
                          )}

                          {/* Booking links */}
                          <div style={{ display: 'flex', gap: 10 }}>
                            <a href={googleUrl} target="_blank" rel="noopener noreferrer" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'white', background: 'var(--color-secondary)', padding: '11px 16px', borderRadius: 10, textDecoration: 'none' }}>
                              <ExternalLink size={13} /> Google Flights
                            </a>
                            <a href={skyUrl} target="_blank" rel="noopener noreferrer" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--color-text-muted)', textDecoration: 'none', border: '1.5px solid var(--color-border)', padding: '11px 16px', borderRadius: 10 }}>
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
                <TravelNotesTab data={latestItinerary.itinerary_json} />
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
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </Layout>
  )
}
