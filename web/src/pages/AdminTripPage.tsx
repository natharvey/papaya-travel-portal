import React, { lazy, Suspense, useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { User, PlaneTakeoff, Calendar, Clock, Wallet, Gauge, Sparkles, RefreshCw, AlertCircle, StickyNote, Save, Plus, Trash2, Pencil, X, Check, Search, MapPin } from 'lucide-react'
import Layout from '../components/Layout'
import ItineraryTimeline, { buildCopyText } from '../components/ItineraryTimeline'
import MessageThread from '../components/MessageThread'
import LoadingSpinner from '../components/LoadingSpinner'
import FlightMap from '../components/FlightMap'
import DatePicker from '../components/DatePicker'
import PDFDownloadButton from '../components/PDFDownloadButton'
import TravelNotesTab from '../components/TravelNotesTab'
import { TabBar, Tab } from '../components/TabBar'
import { useDestinationPhotos } from '../hooks/useDestinationPhotos'
import TripItineraryView from '../components/TripItineraryView'
const UnifiedTripMap = lazy(() => import('../components/UnifiedTripMap'))
import {
  getAdminTrip,
  updateAdminTrip,
  adminDeleteTrip,
  generateItinerary,
  regenerateItinerary,
  sendAdminMessage,
  markAdminMessagesRead,
  addFlight,
  updateFlight,
  deleteFlight,
  lookupFlight,
  addStay,
  updateStay,
  deleteStay,
  parseScreenshot,
  listAdminDocuments,
  uploadAdminDocument,
  getAdminDocumentUrl,
  deleteAdminDocument,
  getApiError,
  type FlightPayload,
  type StayPayload,
  type TripDocument,
} from '../api/client'
import type { TripDetail, Itinerary, Message, Flight, Stay } from '../types'

type FlightFormState = FlightPayload & { terminal_departure: string; terminal_arrival: string; booking_ref: string }

const FLIGHT_FIELDS: { label: string; key: keyof FlightFormState; type: string; placeholder?: string }[] = [
  { label: 'Leg #', key: 'leg_order', type: 'number' },
  { label: 'Flight Number', key: 'flight_number', type: 'text', placeholder: 'QF001' },
  { label: 'Airline', key: 'airline', type: 'text', placeholder: 'Qantas' },
  { label: 'From (IATA)', key: 'departure_airport', type: 'text', placeholder: 'SYD' },
  { label: 'To (IATA)', key: 'arrival_airport', type: 'text', placeholder: 'BKK' },
  { label: 'Departure', key: 'departure_time', type: 'datetime-local' },
  { label: 'Arrival', key: 'arrival_time', type: 'datetime-local' },
  { label: 'Dep. Terminal', key: 'terminal_departure', type: 'text', placeholder: 'T1 (optional)' },
  { label: 'Arr. Terminal', key: 'terminal_arrival', type: 'text', placeholder: 'T2 (optional)' },
  { label: 'Booking Ref', key: 'booking_ref', type: 'text', placeholder: 'ABC123 (optional)' },
]

function FlightFormFields({ flightForm, setFlightForm }: {
  flightForm: FlightFormState
  setFlightForm: React.Dispatch<React.SetStateAction<FlightFormState>>
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', marginBottom: '12px' }}>
      {FLIGHT_FIELDS.map(({ label, key, type, placeholder }) => (
        <div key={key}>
          <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
            {label}
          </div>
          <input
            type={type}
            value={flightForm[key] as string}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setFlightForm(prev => ({ ...prev, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))
            }
            placeholder={placeholder}
            style={{
              width: '100%', boxSizing: 'border-box',
              border: '1px solid var(--color-border)', borderRadius: 'var(--radius)',
              padding: '8px 10px', fontSize: '13px', outline: 'none',
              background: 'white',
            }}
          />
        </div>
      ))}
    </div>
  )
}

type StayFormState = { stay_order: number; name: string; address: string; check_in: string; check_out: string; confirmation_number: string; notes: string }

const STAY_FIELDS: { label: string; key: keyof StayFormState; type: string; placeholder?: string; span?: boolean }[] = [
  { label: 'Stay #', key: 'stay_order', type: 'number' },
  { label: 'Hotel / Property Name', key: 'name', type: 'text', placeholder: 'Sofitel Bangkok', span: true },
  { label: 'Address', key: 'address', type: 'text', placeholder: '189 Silom Rd, Bangkok (optional)', span: true },
  { label: 'Check-in', key: 'check_in', type: 'datetime-local' },
  { label: 'Check-out', key: 'check_out', type: 'datetime-local' },
  { label: 'Confirmation #', key: 'confirmation_number', type: 'text', placeholder: 'BKG-123456 (optional)' },
  { label: 'Notes', key: 'notes', type: 'text', placeholder: 'e.g. pool view room, early check-in requested (optional)', span: true },
]

function StayFormFields({ stayForm, setStayForm }: {
  stayForm: StayFormState
  setStayForm: React.Dispatch<React.SetStateAction<StayFormState>>
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', marginBottom: '12px' }}>
      {STAY_FIELDS.map(({ label, key, type, placeholder, span }) => (
        <div key={key} style={span ? { gridColumn: '1 / -1' } : undefined}>
          <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
            {label}
          </div>
          <input
            type={type}
            value={stayForm[key] as string}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setStayForm(prev => ({ ...prev, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))
            }
            placeholder={placeholder}
            style={{
              width: '100%', boxSizing: 'border-box',
              border: '1px solid var(--color-border)', borderRadius: 'var(--radius)',
              padding: '8px 10px', fontSize: '13px', outline: 'none',
              background: 'white',
            }}
          />
        </div>
      ))}
    </div>
  )
}

const VALID_STATUSES = ['GENERATING', 'ACTIVE', 'COMPLETED']

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  GENERATING: { bg: '#F5F3FF', text: '#6D28D9' },
  ACTIVE:     { bg: '#F0FDF6', text: '#166534' },
  COMPLETED:  { bg: '#F8F8F8', text: '#6B7280' },
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
      }}
    >
      {label}
    </button>
  )
}

export default function AdminTripPage() {
  const { tripId } = useParams<{ tripId: string }>()
  const navigate = useNavigate()
  const [trip, setTrip] = useState<TripDetail | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'itinerary' | 'messages' | 'flights' | 'stays' | 'documents' | 'travel_notes'>('itinerary')

  function switchTab(next: 'itinerary' | 'messages' | 'flights' | 'stays' | 'documents' | 'travel_notes') {
    setTab(next)
    if (next === 'messages' && tripId) {
      markAdminMessagesRead(tripId)
      setMessages(prev => prev.map(m => m.sender_type === 'CLIENT' ? { ...m, is_read: true } : m))
    }
  }

  // Status update
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [actionError, setActionError] = useState('')
  const [sendMessageError, setSendMessageError] = useState('')

  // Delete trip
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDeleteTrip() {
    if (!tripId) return
    setDeleting(true)
    try {
      await adminDeleteTrip(tripId)
      navigate('/admin')
    } catch {
      setActionError('Failed to delete trip')
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  // Admin notes
  const [notes, setNotes] = useState('')
  const [notesSaving, setNotesSaving] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)

  // Flights
  const [flights, setFlights] = useState<Flight[]>([])
  const [flightFormOpen, setFlightFormOpen] = useState(false)
  const [editingFlight, setEditingFlight] = useState<Flight | null>(null)
  const [flightForm, setFlightForm] = useState<FlightFormState>({
    leg_order: 1, flight_number: '', airline: '', departure_airport: '', arrival_airport: '',
    departure_time: '', arrival_time: '', terminal_departure: '', terminal_arrival: '', booking_ref: '',
  })
  const [flightSaving, setFlightSaving] = useState(false)
  const [flightError, setFlightError] = useState('')
  const [lookupFlightNum, setLookupFlightNum] = useState('')
  const [lookupDate, setLookupDate] = useState('')
  const [flightLooking, setFlightLooking] = useState(false)
  const [lookupError, setLookupError] = useState('')
  const [flightScanning, setFlightScanning] = useState(false)

  // Stays
  const [stays, setStays] = useState<Stay[]>([])
  const [stayFormOpen, setStayFormOpen] = useState(false)
  const [editingStay, setEditingStay] = useState<Stay | null>(null)
  const [stayForm, setStayForm] = useState<StayFormState>({
    stay_order: 1, name: '', address: '', check_in: '', check_out: '', confirmation_number: '', notes: '',
  })
  const [staySaving, setStaySaving] = useState(false)
  const [stayError, setStayError] = useState('')
  const [stayScanning, setStayScanning] = useState(false)

  // Documents
  const [documents, setDocuments] = useState<TripDocument[]>([])
  const [docUploading, setDocUploading] = useState(false)
  const [docError, setDocError] = useState('')

  // Itinerary generation
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState('')
  const [regenInstructions, setRegenInstructions] = useState('')
  const [selectedItineraryVersion, setSelectedItineraryVersion] = useState<number | null>(null)
  const [selectedDay, setSelectedDay] = useState(0)

  // Title editing
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [titleSaving, setTitleSaving] = useState(false)

  useEffect(() => {
    if (!tripId) return
    getAdminTrip(tripId)
      .then(data => {
        setTrip(data)
        setMessages(data.messages)
        setFlights((data.flights || []).slice().sort((a, b) => (a.departure_time || '').localeCompare(b.departure_time || '')))
        setStays((data.stays || []).slice().sort((a, b) => (a.check_in || '').localeCompare(b.check_in || '')))
        listAdminDocuments(tripId).then(setDocuments).catch(() => {})
        setNotes(data.admin_notes || '')
        if (data.itineraries.length > 0) {
          const latest = Math.max(...data.itineraries.map(i => i.version))
          setSelectedItineraryVersion(latest)
        }
      })
      .catch(e => setError(getApiError(e)))
      .finally(() => setLoading(false))
  }, [tripId])

  async function handleSaveTitle() {
    if (!tripId || !trip || !titleDraft.trim()) return
    setTitleSaving(true)
    try {
      const updated = await updateAdminTrip(tripId, { title: titleDraft.trim() })
      setTrip(updated)
      setEditingTitle(false)
    } catch { /* ignore */ } finally {
      setTitleSaving(false)
    }
  }

  async function handleStatusChange(newStatus: string) {
    if (!tripId || !trip) return
    setStatusUpdating(true)
    setActionError('')
    try {
      const updated = await updateAdminTrip(tripId, { status: newStatus })
      setTrip(updated)
      setMessages(updated.messages)
    } catch (e) {
      setActionError('Failed to update status: ' + getApiError(e))
    } finally {
      setStatusUpdating(false)
    }
  }

  // Poll for itinerary when generation is running in the background
  useEffect(() => {
    if (!tripId || !trip || trip.status !== 'GENERATING') return
    setGenerating(true)
    const interval = setInterval(async () => {
      try {
        const updated = await getAdminTrip(tripId)
        if (updated.status !== 'GENERATING') {
          setTrip(updated)
          setGenerating(false)
          clearInterval(interval)
          if (updated.itineraries.length > 0) {
            setSelectedItineraryVersion(updated.itineraries[updated.itineraries.length - 1].version)
          }
        }
      } catch { /* keep polling */ }
    }, 5000)
    return () => clearInterval(interval)
  }, [tripId, trip?.status])

  async function handleGenerate() {
    if (!tripId) return
    setGenError('')
    try {
      await generateItinerary(tripId)
      setTrip(prev => prev ? { ...prev, status: 'GENERATING' } : prev)
    } catch (e) {
      setGenError(getApiError(e))
    }
  }

  async function handleRegenerate() {
    if (!tripId || !regenInstructions.trim()) return
    setGenError('')
    try {
      await regenerateItinerary(tripId, regenInstructions)
      setTrip(prev => prev ? { ...prev, status: 'GENERATING' } : prev)
      setRegenInstructions('')
    } catch (e) {
      setGenError(getApiError(e))
    }
  }

  async function handleSaveNotes() {
    if (!tripId) return
    setNotesSaving(true)
    setNotesSaved(false)
    setActionError('')
    try {
      const updated = await updateAdminTrip(tripId, { admin_notes: notes })
      setTrip(updated)
      setNotesSaved(true)
      setTimeout(() => setNotesSaved(false), 2500)
    } catch (e) {
      setActionError('Failed to save notes: ' + getApiError(e))
    } finally {
      setNotesSaving(false)
    }
  }

  function openNewFlightForm() {
    setEditingFlight(null)
    setFlightForm({
      leg_order: flights.length + 1, flight_number: '', airline: '',
      departure_airport: '', arrival_airport: '', departure_time: '', arrival_time: '',
      terminal_departure: '', terminal_arrival: '', booking_ref: '',
    })
    setFlightError('')
    setLookupFlightNum('')
    setLookupDate('')
    setLookupError('')
    setFlightFormOpen(true)
  }

  function openEditFlightForm(flight: Flight) {
    setEditingFlight(flight)
    setFlightForm({
      leg_order: flight.leg_order,
      flight_number: flight.flight_number,
      airline: flight.airline,
      departure_airport: flight.departure_airport,
      arrival_airport: flight.arrival_airport,
      departure_time: flight.departure_time.slice(0, 16),
      arrival_time: flight.arrival_time.slice(0, 16),
      terminal_departure: flight.terminal_departure || '',
      terminal_arrival: flight.terminal_arrival || '',
      booking_ref: flight.booking_ref || '',
    })
    setFlightError('')
    setLookupFlightNum(flight.flight_number)
    setLookupDate(flight.departure_time.slice(0, 10))
    setLookupError('')
    setFlightFormOpen(true)
  }

  async function handleLookupFlight() {
    if (!lookupFlightNum.trim() || !lookupDate) return
    setFlightLooking(true)
    setLookupError('')
    try {
      const result = await lookupFlight(lookupFlightNum.trim(), lookupDate)
      setFlightForm(prev => ({
        ...prev,
        flight_number: result.flight_number,
        airline: result.airline,
        departure_airport: result.departure_airport,
        arrival_airport: result.arrival_airport,
        departure_time: result.departure_time,
        arrival_time: result.arrival_time,
        terminal_departure: result.terminal_departure,
        terminal_arrival: result.terminal_arrival,
      }))
    } catch (e) {
      setLookupError(getApiError(e))
    } finally {
      setFlightLooking(false)
    }
  }

  async function handleScanFlight(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !tripId) return
    e.target.value = ''
    setFlightScanning(true)
    setFlightError('')
    try {
      const scanned = await parseScreenshot(file, 'flight')
      // Sort by departure time
      const sorted = [...scanned].sort((a, b) =>
        (a.departure_time || '').localeCompare(b.departure_time || '')
      )
      if (sorted.length === 1) {
        // Single flight: fill the form for review
        const data = sorted[0]
        setFlightForm(prev => ({
          ...prev,
          flight_number: data.flight_number || prev.flight_number,
          airline: data.airline || prev.airline,
          departure_airport: data.departure_airport || prev.departure_airport,
          arrival_airport: data.arrival_airport || prev.arrival_airport,
          departure_time: data.departure_time || prev.departure_time,
          arrival_time: data.arrival_time || prev.arrival_time,
          terminal_departure: data.terminal_departure || prev.terminal_departure,
          terminal_arrival: data.terminal_arrival || prev.terminal_arrival,
          booking_ref: data.booking_ref || prev.booking_ref,
        }))
      } else {
        // Multiple flights: add them all directly, leg_order continuing from existing
        let nextOrder = flights.length + 1
        const created: Flight[] = []
        for (const data of sorted) {
          const payload: FlightPayload = {
            leg_order: nextOrder++,
            flight_number: data.flight_number || '',
            airline: data.airline || '',
            departure_airport: data.departure_airport || '',
            arrival_airport: data.arrival_airport || '',
            departure_time: data.departure_time || '',
            arrival_time: data.arrival_time || '',
            terminal_departure: data.terminal_departure || undefined,
            terminal_arrival: data.terminal_arrival || undefined,
            booking_ref: data.booking_ref || undefined,
          }
          const flight = await addFlight(tripId, payload)
          created.push(flight)
        }
        setFlights(prev => [...prev, ...created].sort((a, b) => (a.departure_time || '').localeCompare(b.departure_time || '')))
        setFlightFormOpen(false)
      }
    } catch (e) {
      setFlightError(getApiError(e))
    } finally {
      setFlightScanning(false)
    }
  }

  async function handleScanStay(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setStayScanning(true)
    setStayError('')
    try {
      const data = await parseScreenshot(file, 'stay')
      setStayForm(prev => ({
        ...prev,
        name: data.name || prev.name,
        address: data.address || prev.address,
        check_in: data.check_in || prev.check_in,
        check_out: data.check_out || prev.check_out,
        confirmation_number: data.confirmation_number || prev.confirmation_number,
        notes: data.notes || prev.notes,
      }))
    } catch (e) {
      setStayError(getApiError(e))
    } finally {
      setStayScanning(false)
    }
  }

  async function handleSaveFlight() {
    if (!tripId) return
    setFlightSaving(true)
    setFlightError('')
    try {
      const payload: FlightPayload = {
        ...flightForm,
        terminal_departure: flightForm.terminal_departure || undefined,
        terminal_arrival: flightForm.terminal_arrival || undefined,
        booking_ref: flightForm.booking_ref || undefined,
      }
      if (editingFlight) {
        const updated = await updateFlight(tripId, editingFlight.id, payload)
        setFlights(prev => prev.map(f => f.id === updated.id ? updated : f).sort((a, b) => (a.departure_time || '').localeCompare(b.departure_time || '')))
      } else {
        const created = await addFlight(tripId, payload)
        setFlights(prev => [...prev, created].sort((a, b) => (a.departure_time || '').localeCompare(b.departure_time || '')))
      }
      setFlightFormOpen(false)
    } catch (e) {
      setFlightError(getApiError(e))
    } finally {
      setFlightSaving(false)
    }
  }

  async function handleDeleteFlight(flight: Flight) {
    if (!tripId || !window.confirm(`Delete flight ${flight.flight_number}?`)) return
    try {
      await deleteFlight(tripId, flight.id)
      setFlights(prev => prev.filter(f => f.id !== flight.id))
    } catch (e) {
      setActionError('Failed to delete flight: ' + getApiError(e))
    }
  }

  function openNewStayForm() {
    setEditingStay(null)
    setStayForm({ stay_order: stays.length + 1, name: '', address: '', check_in: '', check_out: '', confirmation_number: '', notes: '' })
    setStayError('')
    setStayFormOpen(true)
  }

  function openEditStayForm(stay: Stay) {
    setEditingStay(stay)
    setStayForm({
      stay_order: stay.stay_order,
      name: stay.name,
      address: stay.address || '',
      check_in: stay.check_in.slice(0, 16),
      check_out: stay.check_out.slice(0, 16),
      confirmation_number: stay.confirmation_number || '',
      notes: stay.notes || '',
    })
    setStayError('')
    setStayFormOpen(true)
  }

  async function handleSaveStay() {
    if (!tripId) return
    setStaySaving(true)
    setStayError('')
    try {
      const payload: StayPayload = {
        stay_order: stayForm.stay_order,
        name: stayForm.name,
        address: stayForm.address || undefined,
        check_in: stayForm.check_in,
        check_out: stayForm.check_out,
        confirmation_number: stayForm.confirmation_number || undefined,
        notes: stayForm.notes || undefined,
      }
      if (editingStay) {
        const updated = await updateStay(tripId, editingStay.id, payload)
        setStays(prev => prev.map(s => s.id === updated.id ? updated : s).sort((a, b) => (a.check_in || '').localeCompare(b.check_in || '')))
      } else {
        const created = await addStay(tripId, payload)
        setStays(prev => [...prev, created].sort((a, b) => (a.check_in || '').localeCompare(b.check_in || '')))
      }
      setStayFormOpen(false)
    } catch (e) {
      setStayError(getApiError(e))
    } finally {
      setStaySaving(false)
    }
  }

  async function handleDeleteStay(stay: Stay) {
    if (!tripId || !window.confirm(`Remove stay at ${stay.name}?`)) return
    try {
      await deleteStay(tripId, stay.id)
      setStays(prev => prev.filter(s => s.id !== stay.id))
    } catch (e) {
      setActionError('Failed to delete stay: ' + getApiError(e))
    }
  }

  async function handleUploadDocument(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !tripId) return
    e.target.value = ''
    setDocUploading(true)
    setDocError('')
    try {
      await uploadAdminDocument(tripId, file)
      const updated = await listAdminDocuments(tripId)
      setDocuments(updated)
    } catch (e) {
      setDocError(getApiError(e))
    } finally {
      setDocUploading(false)
    }
  }

  async function handleDownloadDocument(key: string) {
    if (!tripId) return
    try {
      const url = await getAdminDocumentUrl(tripId, key)
      window.open(url, '_blank')
    } catch (e) {
      setDocError(getApiError(e))
    }
  }

  async function handleDeleteDocument(key: string) {
    if (!tripId || !window.confirm('Delete this document?')) return
    try {
      await deleteAdminDocument(tripId, key)
      setDocuments(prev => prev.filter(d => d.key !== key))
    } catch (e) {
      setDocError(getApiError(e))
    }
  }

  async function handleSendMessage(body: string) {
    if (!tripId) return
    setSendMessageError('')
    try {
      const msg = await sendAdminMessage(tripId, body)
      setMessages(prev => [...prev, msg])
    } catch (e) {
      setSendMessageError(getApiError(e))
    }
  }

  // Destination photo hooks — must be called before any early returns (Rules of Hooks)
  const latestItineraryForHero = trip?.itineraries?.length
    ? trip.itineraries.reduce((a, b) => a.version > b.version ? a : b)
    : null
  const heroDests = latestItineraryForHero?.itinerary_json?.destinations || []
  const { photos: heroPhotos } = useDestinationPhotos([
    heroDests[0]?.name || trip?.title || '',
    heroDests[1]?.name || '',
    heroDests[2]?.name || '',
  ])
  const [heroPhoto0, heroPhoto1, heroPhoto2] = heroPhotos

  if (loading) {
    return (
      <Layout variant="admin">
        <LoadingSpinner label="Loading trip..." />
      </Layout>
    )
  }

  if (error || !trip) {
    return (
      <Layout variant="admin">
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
          <Link to="/admin" style={{ color: 'var(--color-primary)' }}>← Back to Dashboard</Link>
        </div>
      </Layout>
    )
  }

  const statusColors = STATUS_COLORS[trip.status] || STATUS_COLORS.GENERATING
  const selectedItinerary = trip.itineraries.find(i => i.version === selectedItineraryVersion) || null
  const tripDays = Math.ceil(
    (new Date(trip.end_date).getTime() - new Date(trip.start_date).getTime()) / (1000 * 60 * 60 * 24)
  )
  const showMosaic = heroDests.length >= 2
  const thumbDests = heroDests.slice(1, 3)
  const thumbPhotos = [heroPhoto1, heroPhoto2]

  return (
    <Layout variant="admin">

      {/* ── HERO (matches client view) ── */}
      <div style={{ position: 'relative', width: '100%', height: 400, overflow: 'hidden', flexShrink: 0, background: 'var(--color-secondary)' }}>
        {showMosaic ? (
          <div style={{ display: 'grid', gridTemplateColumns: '62% 38%', gridTemplateRows: `repeat(${thumbDests.length === 1 ? 1 : 2}, 1fr)`, gap: 3, height: '100%' }}>
            <div style={{ gridRow: `1 / ${thumbDests.length === 1 ? 2 : 3}`, position: 'relative', overflow: 'hidden', background: 'var(--color-secondary)' }}>
              {heroPhoto0 && <img src={heroPhoto0} alt={heroDests[0]?.name || trip.title} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'saturate(1.35) brightness(1.08) contrast(1.05)' }} />}
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.18) 50%, rgba(0,0,0,0.04) 100%)' }} />
            </div>
            {thumbDests.map((dest, i) => (
              <div key={dest.name} style={{ position: 'relative', overflow: 'hidden', background: 'var(--color-secondary)' }}>
                {thumbPhotos[i] && <img src={thumbPhotos[i]!} alt={dest.name} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'saturate(1.35) brightness(1.08) contrast(1.05)' }} />}
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.0) 60%)' }} />
                <div style={{ position: 'absolute', bottom: 10, left: 12, background: 'rgba(0,0,0,0.50)', backdropFilter: 'blur(6px)', color: 'white', fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 5 }}>{dest.name}</div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {heroPhoto0 && <img src={heroPhoto0} alt={trip.title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'saturate(1.35) brightness(1.08) contrast(1.05)' }} />}
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.35) 55%, rgba(0,0,0,0.10) 100%)' }} />
          </>
        )}

        {/* Top row: breadcrumb + admin controls */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '22px 40px', zIndex: 2 }}>
          <Link to="/admin" style={{ color: 'rgba(255,255,255,0.72)', fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>← All Trips</Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <select
              value={trip.status}
              onChange={e => handleStatusChange(e.target.value)}
              disabled={statusUpdating}
              style={{ background: statusColors.bg, border: 'none', color: statusColors.text, borderRadius: 'var(--radius)', padding: '6px 12px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
            >
              {VALID_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {statusUpdating && <LoadingSpinner size={16} label="" />}
            {confirmDelete ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>Delete trip?</span>
                <button onClick={handleDeleteTrip} disabled={deleting} style={{ background: '#EF4444', border: 'none', borderRadius: 6, padding: '4px 10px', color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{deleting ? '...' : 'Yes, delete'}</button>
                <button onClick={() => setConfirmDelete(false)} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)} style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 8, padding: '5px 12px', color: 'rgba(255,255,255,0.7)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Delete trip</button>
            )}
          </div>
        </div>

        {/* Bottom: title + client info + meta */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: showMosaic ? '38%' : 0, padding: '0 40px 36px', zIndex: 2 }}>
          {editingTitle ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <input
                autoFocus
                value={titleDraft}
                onChange={e => setTitleDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveTitle(); if (e.key === 'Escape') setEditingTitle(false) }}
                style={{ fontSize: showMosaic ? '28px' : '36px', fontWeight: 900, color: 'white', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 8, padding: '4px 12px', outline: 'none', fontFamily: 'inherit', flex: 1 }}
              />
              <button onClick={handleSaveTitle} disabled={titleSaving} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 6, padding: '6px 12px', color: 'white', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600 }}>{titleSaving ? '...' : 'Save'}</button>
              <button onClick={() => setEditingTitle(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>Cancel</button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, cursor: 'pointer' }} onClick={() => { setTitleDraft(trip.title); setEditingTitle(true) }}>
              <h1 style={{ fontSize: showMosaic ? '36px' : '46px', fontWeight: 900, color: 'white', margin: 0, lineHeight: 1.05, letterSpacing: '-0.5px', textShadow: '0 2px 24px rgba(0,0,0,0.4)' }}>{trip.title}</h1>
              <Pencil size={16} color="rgba(255,255,255,0.5)" strokeWidth={2} style={{ flexShrink: 0, marginTop: 4 }} />
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <User size={13} color="rgba(255,255,255,0.5)" strokeWidth={2} />
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{trip.client.name} · {trip.client.email}</span>
          </div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            {[
              { Icon: PlaneTakeoff, label: `From ${trip.origin_city}` },
              { Icon: Calendar, label: `${new Date(trip.start_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })} — ${new Date(trip.end_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}` },
              { Icon: Clock, label: `${tripDays} days` },
              { Icon: Wallet, label: trip.budget_range },
              { Icon: Gauge, label: trip.pace },
            ].map(({ Icon, label }) => (
              <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: 'rgba(255,255,255,0.65)', fontWeight: 500 }}>
                <Icon size={13} color="rgba(255,255,255,0.4)" strokeWidth={2} />
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div style={{ width: 'min(90vw, 1440px)', margin: '0 auto', padding: '0 0 60px' }}>

        {/* Action error banner */}
        {actionError && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 'var(--radius)', padding: '12px 16px', margin: '16px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle size={15} strokeWidth={2} color="#B91C1C" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '13px', color: '#B91C1C', flex: 1 }}>{actionError}</span>
            <button onClick={() => setActionError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B91C1C', fontSize: '16px', lineHeight: 1, padding: 0 }}>×</button>
          </div>
        )}

        {/* Tabs */}
        <TabBar style={{ marginBottom: 32, marginTop: 8 }}>
          <Tab label="Itinerary" active={tab === 'itinerary'} onClick={() => switchTab('itinerary')} />
          <Tab label="Accommodation" active={tab === 'stays'} onClick={() => switchTab('stays')} />
          <Tab label="Flights" active={tab === 'flights'} onClick={() => switchTab('flights')} />
          <Tab label="Travel Notes" active={tab === 'travel_notes'} onClick={() => switchTab('travel_notes')} />
          <Tab label={`Documents${documents.length > 0 ? ` (${documents.length})` : ''}`} active={tab === 'documents'} onClick={() => switchTab('documents')} />
          <Tab label={`Messages${messages.filter(m => m.sender_type === 'CLIENT' && !m.is_read).length > 0 ? ` (${messages.filter(m => m.sender_type === 'CLIENT' && !m.is_read).length} new)` : ''}`} active={tab === 'messages'} onClick={() => switchTab('messages')} />
        </TabBar>

        <div>
          {/* ── ITINERARY TAB ── */}
          {tab === 'itinerary' && (
            <div>
              {/* Admin toolbar: version selector + regenerate */}
              <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: '14px 16px', marginBottom: '20px' }}>
                {trip.itineraries.length === 0 ? (
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    {generating || trip.status === 'GENERATING' ? (
                      <>
                        <LoadingSpinner size={16} label="" />
                        <span style={{ fontSize: '13px', color: 'var(--color-text-muted)', fontWeight: 500 }}>Generating itinerary with Claude...</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle size={15} color="#B91C1C" strokeWidth={2} />
                        <span style={{ fontSize: '13px', color: '#B91C1C' }}>Generation failed.</span>
                        <button onClick={handleGenerate} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', padding: 0 }}>Retry</button>
                      </>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    {/* Version pills */}
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Version:</span>
                      {trip.itineraries.map((it: Itinerary) => (
                        <button
                          key={it.version}
                          onClick={() => setSelectedItineraryVersion(it.version)}
                          style={{
                            background: selectedItineraryVersion === it.version ? 'var(--color-secondary)' : 'white',
                            color: selectedItineraryVersion === it.version ? 'white' : 'var(--color-text)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius)',
                            padding: '4px 10px',
                            fontSize: '12px',
                            cursor: 'pointer',
                            fontWeight: selectedItineraryVersion === it.version ? 600 : 400,
                          }}
                        >
                          v{it.version} <span style={{ fontSize: '10px', opacity: 0.6, marginLeft: 3 }}>{new Date(it.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</span>
                        </button>
                      ))}
                    </div>
                    {/* Regen input */}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <input
                        type="text"
                        value={regenInstructions}
                        onChange={e => setRegenInstructions(e.target.value)}
                        placeholder="Regeneration instructions..."
                        style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: '6px 10px', fontSize: '12px', outline: 'none', width: 260 }}
                      />
                      <button
                        onClick={handleRegenerate}
                        disabled={generating || !regenInstructions.trim()}
                        style={{ background: !regenInstructions.trim() || generating ? 'var(--color-border)' : 'var(--color-secondary)', color: 'white', border: 'none', borderRadius: 'var(--radius)', padding: '6px 14px', fontSize: '12px', fontWeight: 600, cursor: !regenInstructions.trim() || generating ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}
                      >
                        {generating ? <LoadingSpinner size={12} color="white" label="" /> : <RefreshCw size={12} strokeWidth={2} />}
                        {generating ? 'Generating...' : 'Regenerate'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {genError && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <AlertCircle size={15} strokeWidth={2} color="#B91C1C" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: '13px', color: '#B91C1C', flex: 1 }}>{genError}</span>
                  <button onClick={trip.itineraries.length === 0 ? handleGenerate : handleRegenerate} style={{ background: 'none', border: 'none', color: '#B91C1C', fontSize: '13px', fontWeight: 600, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <RefreshCw size={12} strokeWidth={2} /> Retry
                  </button>
                </div>
              )}

              {/* Generating animation */}
              {(generating || trip.status === 'GENERATING') && trip.itineraries.length === 0 && (
                <div style={{ maxWidth: 480, margin: '48px auto', padding: '0 20px', textAlign: 'center' }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🌴</div>
                  <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Building itinerary…</h3>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: 14, lineHeight: 1.6 }}>Usually takes 1–2 minutes. This page updates automatically.</p>
                  <LoadingSpinner label="" />
                </div>
              )}

              {/* ── CLIENT VIEW (shared component) ── */}
              {selectedItinerary && (
                <TripItineraryView
                  itinerary={selectedItinerary}
                  trip={trip}
                  itineraryCount={trip.itineraries.length}
                  selectedDay={selectedDay}
                  onDaySelect={setSelectedDay}
                />
              )}
            </div>
          )}

          {/* ── FLIGHTS TAB ── */}
          {tab === 'flights' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
              {/* Route map — same as client */}
              {flights.length > 0 ? (
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', marginBottom: 12 }}>Route</h3>
                  <Suspense fallback={<div style={{ height: 260, background: 'var(--color-secondary)', borderRadius: 'var(--radius-lg)' }} />}>
                    <FlightMap flights={flights} originCity={trip.origin_city} />
                  </Suspense>
                </div>
              ) : (
                <div style={{ background: 'var(--color-bg)', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '28px 24px', textAlign: 'center' }}>
                  <PlaneTakeoff size={32} color="var(--color-text-muted)" strokeWidth={1.5} style={{ marginBottom: 10 }} />
                  <p style={{ fontSize: 14, color: 'var(--color-text-muted)', margin: 0 }}>No flights added yet.</p>
                </div>
              )}

              {/* Confirmed flights — client-style cards */}
              {flights.length > 0 && (
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', marginBottom: 12 }}>Confirmed Flights</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {flights.map(flight => (
                      <div key={flight.id} style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <div style={{ background: 'var(--color-secondary)', color: 'white', borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>{flight.flight_number}</div>
                        <div style={{ flex: 1, minWidth: 160 }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{flight.departure_airport} → {flight.arrival_airport} <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>{flight.airline}</span></div>
                          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 2 }}>
                            <span>Dep: {new Date(flight.departure_time).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}{flight.terminal_departure ? ` · ${flight.terminal_departure}` : ''}</span>
                            <span>Arr: {new Date(flight.arrival_time).toLocaleString('en-AU', { timeStyle: 'short' })}{flight.terminal_arrival ? ` · ${flight.terminal_arrival}` : ''}</span>
                          </div>
                        </div>
                        {flight.booking_ref && <div style={{ fontSize: 12, color: 'var(--color-text-muted)', background: 'white', border: '1px solid var(--color-border)', borderRadius: 6, padding: '4px 10px' }}>Ref: <strong style={{ color: 'var(--color-text)', letterSpacing: 1 }}>{flight.booking_ref}</strong></div>}
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => openEditFlightForm(flight)} title="Edit" style={{ background: 'white', border: '1px solid var(--color-border)', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><Pencil size={13} strokeWidth={2} color="#475569" /></button>
                          <button onClick={() => handleDeleteFlight(flight)} title="Delete" style={{ background: '#FEF2F2', border: 'none', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><Trash2 size={13} strokeWidth={2} color="#B91C1C" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Admin: Add/Edit flight form */}
              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-secondary)', margin: 0 }}>Manage Flights</h3>
                  {!flightFormOpen && (
                    <button onClick={openNewFlightForm} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: 'var(--radius)', padding: '8px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                      <Plus size={14} strokeWidth={2.5} /> Add Flight
                    </button>
                  )}
                </div>

                {/* Flight form */}
                {flightFormOpen && (
                  <div style={{
                    background: 'var(--color-bg)', border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius)', padding: '20px', marginBottom: '20px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-text)' }}>
                        {editingFlight ? 'Edit Flight' : 'New Flight'}
                      </span>
                      <button onClick={() => setFlightFormOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}>
                        <X size={16} strokeWidth={2} />
                      </button>
                    </div>
                    {/* Quick Lookup */}
                    <div style={{
                      background: 'white', border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius)', padding: '12px 14px', marginBottom: '16px',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', color: 'var(--color-text-muted)' }}>
                          Auto-fill from flight number
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 600, color: 'var(--color-primary)', cursor: 'pointer' }}>
                          <input type="file" accept="image/*" onChange={handleScanFlight} style={{ display: 'none' }} />
                          {flightScanning ? <LoadingSpinner size={12} color="var(--color-primary)" label="" /> : <Sparkles size={12} strokeWidth={2.5} />}
                          {flightScanning ? 'Scanning...' : 'Scan screenshot'}
                        </label>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <input
                          type="text"
                          value={lookupFlightNum}
                          onChange={e => setLookupFlightNum(e.target.value.toUpperCase())}
                          placeholder="QF1"
                          style={{
                            border: '1px solid var(--color-border)', borderRadius: 'var(--radius)',
                            padding: '7px 10px', fontSize: '13px', outline: 'none', width: '90px', background: 'white',
                          }}
                        />
                        <DatePicker
                          value={lookupDate}
                          onChange={setLookupDate}
                          placeholder="Flight date"
                          style={{ width: 150 }}
                        />
                        <button
                          onClick={handleLookupFlight}
                          disabled={flightLooking || !lookupFlightNum.trim() || !lookupDate}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            background: flightLooking || !lookupFlightNum.trim() || !lookupDate
                              ? 'var(--color-border)' : 'var(--color-primary)',
                            color: 'white', border: 'none', borderRadius: 'var(--radius)',
                            padding: '7px 14px', fontSize: '13px', fontWeight: 600,
                            cursor: flightLooking || !lookupFlightNum.trim() || !lookupDate ? 'default' : 'pointer',
                          }}
                        >
                          {flightLooking
                            ? <LoadingSpinner size={13} color="white" label="" />
                            : <Search size={13} strokeWidth={2.5} />}
                          {flightLooking ? 'Looking up...' : 'Lookup'}
                        </button>
                        {lookupError && (
                          <span style={{ fontSize: '12px', color: '#B91C1C' }}>{lookupError}</span>
                        )}
                      </div>
                    </div>

                    <FlightFormFields flightForm={flightForm} setFlightForm={setFlightForm} />
                    {flightError && (
                      <p style={{ fontSize: '13px', color: '#B91C1C', marginBottom: '10px' }}>{flightError}</p>
                    )}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={handleSaveFlight}
                        disabled={flightSaving || !flightForm.flight_number || !flightForm.airline || !flightForm.departure_time || !flightForm.arrival_time}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '6px',
                          background: (flightSaving || !flightForm.flight_number || !flightForm.airline || !flightForm.departure_time || !flightForm.arrival_time)
                            ? 'var(--color-border)' : 'var(--color-secondary)',
                          color: 'white', border: 'none', borderRadius: 'var(--radius)',
                          padding: '8px 18px', fontSize: '13px', fontWeight: 600,
                          cursor: (flightSaving || !flightForm.flight_number || !flightForm.airline || !flightForm.departure_time || !flightForm.arrival_time)
                            ? 'default' : 'pointer',
                        }}
                      >
                        {flightSaving ? <LoadingSpinner size={13} color="white" label="" /> : <Check size={13} strokeWidth={2.5} />}
                        {flightSaving ? 'Saving...' : 'Save Flight'}
                      </button>
                      <button
                        onClick={() => setFlightFormOpen(false)}
                        style={{
                          background: 'white', color: 'var(--color-text-muted)',
                          border: '1px solid var(--color-border)', borderRadius: 'var(--radius)',
                          padding: '8px 14px', fontSize: '13px', cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}

          {/* ── ACCOMMODATION TAB ── */}
          {tab === 'stays' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
              {/* Confirmed stays — client-style view */}
              {stays.length > 0 ? (
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', marginBottom: 12 }}>Confirmed Accommodation</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {stays.map(stay => {
                      const nights = Math.round((new Date(stay.check_out).getTime() - new Date(stay.check_in).getTime()) / 86400000)
                      return (
                        <div key={stay.id} style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                          <div style={{ background: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>{nights} night{nights !== 1 ? 's' : ''}</div>
                          <div style={{ flex: 1, minWidth: 200 }}>
                            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>{stay.name}</div>
                            {stay.address && <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 3 }}>{stay.address}</div>}
                            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                              <span>Check-in: {new Date(stay.check_in).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                              <span>Check-out: {new Date(stay.check_out).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                            </div>
                            {stay.notes && <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 3, fontStyle: 'italic' }}>{stay.notes}</div>}
                          </div>
                          {stay.confirmation_number && <div style={{ fontSize: 12, background: 'white', border: '1px solid var(--color-border)', borderRadius: 6, padding: '4px 10px' }}>Ref: <strong style={{ color: 'var(--color-text)', letterSpacing: 1 }}>{stay.confirmation_number}</strong></div>}
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => openEditStayForm(stay)} title="Edit" style={{ background: 'white', border: '1px solid var(--color-border)', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><Pencil size={13} strokeWidth={2} color="#475569" /></button>
                            <button onClick={() => handleDeleteStay(stay)} title="Delete" style={{ background: '#FEF2F2', border: 'none', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><Trash2 size={13} strokeWidth={2} color="#B91C1C" /></button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div style={{ background: 'var(--color-bg)', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '28px 24px', textAlign: 'center' }}>
                  <p style={{ fontSize: 14, color: 'var(--color-text-muted)', margin: 0 }}>No accommodation added yet. Use the form below to add stays.</p>
                </div>
              )}

              {/* Admin: Add/Edit stay form */}
              <div style={{ borderTop: stays.length > 0 ? '1px solid var(--color-border)' : 'none', paddingTop: stays.length > 0 ? 24 : 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-secondary)', margin: 0 }}>Manage Accommodation</h3>
                  {!stayFormOpen && (
                    <button onClick={openNewStayForm} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: 'var(--radius)', padding: '8px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                      <Plus size={14} strokeWidth={2.5} /> Add Stay
                    </button>
                  )}
                </div>

                {stayFormOpen && (
                  <div style={{
                    background: 'var(--color-bg)', border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius)', padding: '20px', marginBottom: '20px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-text)' }}>
                        {editingStay ? 'Edit Stay' : 'New Stay'}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 600, color: 'var(--color-primary)', cursor: 'pointer' }}>
                          <input type="file" accept="image/*" onChange={handleScanStay} style={{ display: 'none' }} />
                          {stayScanning ? <LoadingSpinner size={12} color="var(--color-primary)" label="" /> : <Sparkles size={12} strokeWidth={2.5} />}
                          {stayScanning ? 'Scanning...' : 'Scan screenshot'}
                        </label>
                        <button onClick={() => setStayFormOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}>
                          <X size={16} strokeWidth={2} />
                        </button>
                      </div>
                    </div>
                    <StayFormFields stayForm={stayForm} setStayForm={setStayForm} />
                    {stayError && (
                      <p style={{ fontSize: '13px', color: '#B91C1C', marginBottom: '10px' }}>{stayError}</p>
                    )}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={handleSaveStay}
                        disabled={staySaving || !stayForm.name || !stayForm.check_in || !stayForm.check_out}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '6px',
                          background: staySaving ? 'var(--color-border)' : 'var(--color-secondary)',
                          color: 'white', border: 'none', borderRadius: 'var(--radius)',
                          padding: '8px 18px', fontSize: '13px', fontWeight: 600,
                          cursor: staySaving ? 'default' : 'pointer',
                        }}
                      >
                        {staySaving ? <LoadingSpinner size={13} color="white" label="" /> : <Check size={13} strokeWidth={2.5} />}
                        {staySaving ? 'Saving...' : 'Save Stay'}
                      </button>
                      <button
                        onClick={() => setStayFormOpen(false)}
                        style={{
                          background: 'white', color: 'var(--color-text-muted)',
                          border: '1px solid var(--color-border)', borderRadius: 'var(--radius)',
                          padding: '8px 14px', fontSize: '13px', cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}

          {/* ── TRAVEL NOTES TAB ── */}
          {tab === 'travel_notes' && (
            selectedItinerary
              ? <TravelNotesTab data={selectedItinerary.itinerary_json} />
              : <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--color-text-muted)', fontSize: 14 }}>No itinerary available yet.</div>
          )}


          {/* ── MESSAGES TAB ── */}
            {tab === 'messages' && (
              <>
                {sendMessageError && (
                  <div style={{
                    background: '#FEF2F2', border: '1px solid #FECACA',
                    borderRadius: 'var(--radius)', padding: '10px 14px',
                    marginBottom: '12px', fontSize: '13px', color: '#B91C1C',
                    display: 'flex', alignItems: 'center', gap: '8px',
                  }}>
                    <AlertCircle size={14} strokeWidth={2} color="#B91C1C" />
                    {sendMessageError}
                  </div>
                )}
                <MessageThread
                  messages={messages}
                  currentRole="ADMIN"
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
                    <input type="file" onChange={handleUploadDocument} style={{ display: 'none' }} disabled={docUploading} />
                    {docUploading ? <LoadingSpinner size={13} color="white" label="" /> : <Plus size={13} strokeWidth={2.5} />}
                    {docUploading ? 'Uploading...' : 'Upload Document'}
                  </label>
                </div>
                {docError && (
                  <p style={{ fontSize: '13px', color: '#B91C1C', marginBottom: '12px' }}>{docError}</p>
                )}
                {documents.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-text-muted)' }}>
                    <p style={{ fontSize: '14px' }}>No documents uploaded yet.</p>
                    <p style={{ fontSize: '13px', marginTop: '4px' }}>Upload booking confirmations, visas, insurance certificates and more.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {documents.map(doc => (
                      <div key={doc.key} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        background: 'white', border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius)', padding: '12px 16px', gap: '12px',
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {doc.filename}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                            Uploaded by {doc.uploaded_by === 'admin' ? 'Admin' : 'Client'} · {(doc.size / 1024).toFixed(0)} KB · {new Date(doc.uploaded_at).toLocaleDateString()}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                          <button
                            onClick={() => handleDownloadDocument(doc.key)}
                            style={{ background: 'var(--color-secondary)', color: 'white', border: 'none', borderRadius: 'var(--radius)', padding: '6px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                          >
                            Download
                          </button>
                          <button
                            onClick={() => handleDeleteDocument(doc.key)}
                            style={{ background: 'white', color: '#EF4444', border: '1px solid #FECACA', borderRadius: 'var(--radius)', padding: '6px 10px', fontSize: '12px', cursor: 'pointer' }}
                          >
                            <Trash2 size={13} strokeWidth={2} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
    </Layout>
  )
}
