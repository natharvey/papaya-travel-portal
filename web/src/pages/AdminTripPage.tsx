import React, { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { User, PlaneTakeoff, Calendar, Clock, Wallet, Gauge, Sparkles, RefreshCw, AlertCircle, Send, StickyNote, Save, Plus, Trash2, Pencil, X, Check, Search } from 'lucide-react'
import Layout from '../components/Layout'
import ItineraryTimeline from '../components/ItineraryTimeline'
import MessageThread from '../components/MessageThread'
import LoadingSpinner from '../components/LoadingSpinner'
import FlightMap from '../components/FlightMap'
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
  const [tab, setTab] = useState<'itinerary' | 'messages' | 'notes' | 'flights' | 'stays' | 'documents'>('itinerary')

  function switchTab(next: 'itinerary' | 'messages' | 'notes' | 'flights' | 'stays' | 'documents') {
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

  return (
    <Layout variant="admin">
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '32px 24px 60px' }}>
        {/* Breadcrumb */}
        <div style={{ marginBottom: '20px' }}>
          <Link to="/admin" style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>
            ← All Trips
          </Link>
        </div>

        {/* Trip header */}
        <div style={{
          background: 'linear-gradient(135deg, var(--color-secondary) 0%, #1A3344 100%)',
          color: 'white',
          borderRadius: 'var(--radius-lg)',
          padding: '24px 28px',
          marginBottom: '24px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '12px' }}>{trip.title}</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                <User size={13} color="#64748B" strokeWidth={2} />
                <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>{trip.client.name} · {trip.client.email}</span>
              </div>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                {[
                  { Icon: PlaneTakeoff, label: trip.origin_city },
                  { Icon: Calendar, label: `${new Date(trip.start_date).toLocaleDateString('en-AU')} — ${new Date(trip.end_date).toLocaleDateString('en-AU')}` },
                  { Icon: Clock, label: `${tripDays} days` },
                  { Icon: Wallet, label: trip.budget_range },
                  { Icon: Gauge, label: trip.pace },
                ].map(({ Icon, label }) => (
                  <span key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>
                    <Icon size={13} color="rgba(255,255,255,0.4)" strokeWidth={2} />
                    {label}
                  </span>
                ))}
              </div>
            </div>

            {/* Status + delete */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <select
                  value={trip.status}
                  onChange={e => handleStatusChange(e.target.value)}
                  disabled={statusUpdating}
                  style={{
                    background: statusColors.bg,
                    border: 'none',
                    color: statusColors.text,
                    borderRadius: 'var(--radius)',
                    padding: '6px 12px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {VALID_STATUSES.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                {statusUpdating && <LoadingSpinner size={16} label="" />}
              </div>
              {confirmDelete ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>Delete this trip?</span>
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
        {flights.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <FlightMap flights={flights} originCity={trip.origin_city} />
          </div>
        )}

        {/* Action error banner */}
        {actionError && (
          <div style={{
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: 'var(--radius)',
            padding: '12px 16px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}>
            <AlertCircle size={15} strokeWidth={2} color="#B91C1C" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '13px', color: '#B91C1C', flex: 1 }}>{actionError}</span>
            <button onClick={() => setActionError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B91C1C', fontSize: '16px', lineHeight: 1, padding: 0 }}>×</button>
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
            <TabButton label="Flights" active={tab === 'flights'} onClick={() => switchTab('flights')} />
            <TabButton label="Accommodation" active={tab === 'stays'} onClick={() => switchTab('stays')} />
            <TabButton label="Notes" active={tab === 'notes'} onClick={() => switchTab('notes')} />
            <TabButton label={`Documents${documents.length > 0 ? ` (${documents.length})` : ''}`} active={tab === 'documents'} onClick={() => switchTab('documents')} />
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <TabButton
                label={`Messages (${messages.length})`}
                active={tab === 'messages'}
                onClick={() => switchTab('messages')}
              />
              {(() => {
                const unread = messages.filter(m => m.sender_type === 'CLIENT' && !m.is_read).length
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
          </div>

          <div style={{ padding: '24px' }}>
            {/* ── ITINERARY TAB ── */}
            {tab === 'itinerary' && (
              <div>
                {/* Generate / Version controls */}
                <div style={{
                  background: 'var(--color-bg)',
                  borderRadius: 'var(--radius)',
                  padding: '16px',
                  marginBottom: '24px',
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}>
                  {trip.itineraries.length === 0 ? (
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      {generating || trip.status === 'GENERATING' ? (
                        <>
                          <LoadingSpinner size={18} label="" />
                          <span style={{ fontSize: '14px', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                            Generating itinerary with Claude...
                          </span>
                        </>
                      ) : (
                        <>
                          <span style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>
                            Generation failed.
                          </span>
                          <button
                            onClick={handleGenerate}
                            style={{
                              background: 'none', border: 'none', color: 'var(--color-primary)',
                              fontSize: '14px', fontWeight: 600, cursor: 'pointer', padding: 0,
                            }}
                          >
                            Retry
                          </button>
                        </>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', width: '100%' }}>
                      {/* Version selector */}
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: 1, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)' }}>
                          Versions:
                        </span>
                        {trip.itineraries.map((it: Itinerary) => (
                          <button
                            key={it.version}
                            onClick={() => setSelectedItineraryVersion(it.version)}
                            style={{
                              background: selectedItineraryVersion === it.version ? 'var(--color-secondary)' : 'white',
                              color: selectedItineraryVersion === it.version ? 'white' : 'var(--color-text)',
                              border: '1px solid var(--color-border)',
                              borderRadius: 'var(--radius)',
                              padding: '6px 12px',
                              fontSize: '13px',
                              cursor: 'pointer',
                              fontWeight: selectedItineraryVersion === it.version ? 600 : 400,
                            }}
                          >
                            v{it.version}
                            <span style={{ fontSize: '10px', opacity: 0.7, marginLeft: '4px' }}>
                              {new Date(it.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Regenerate section */}
                {trip.itineraries.length > 0 && (
                  <div style={{
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius)',
                    padding: '14px',
                    marginBottom: '24px',
                  }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text)' }}>
                      <RefreshCw size={13} strokeWidth={2} color="#64748B" />
                      Regenerate with Instructions
                    </div>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      <input
                        type="text"
                        value={regenInstructions}
                        onChange={e => setRegenInstructions(e.target.value)}
                        placeholder="e.g. Focus more on off-the-beaten-path experiences, add a day in the mountains..."
                        style={{
                          flex: 1,
                          minWidth: '280px',
                          border: '1px solid var(--color-border)',
                          borderRadius: 'var(--radius)',
                          padding: '8px 12px',
                          fontSize: '13px',
                          outline: 'none',
                        }}
                      />
                      <button
                        onClick={handleRegenerate}
                        disabled={generating || !regenInstructions.trim()}
                        style={{
                          background: !regenInstructions.trim() || generating ? 'var(--color-border)' : 'var(--color-secondary)',
                          color: 'white',
                          border: 'none',
                          borderRadius: 'var(--radius)',
                          padding: '8px 18px',
                          fontSize: '13px',
                          fontWeight: 600,
                          cursor: !regenInstructions.trim() || generating ? 'default' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {generating ? <LoadingSpinner size={14} color="white" label="" /> : <RefreshCw size={13} strokeWidth={2} />}
                        {generating ? 'Generating...' : 'Regenerate'}
                      </button>
                    </div>
                  </div>
                )}

                {genError && (
                  <div style={{
                    background: '#FEF2F2',
                    border: '1px solid #FECACA',
                    borderRadius: 'var(--radius)',
                    padding: '14px 16px',
                    marginBottom: '16px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      <AlertCircle size={16} strokeWidth={2} color="#B91C1C" style={{ flexShrink: 0, marginTop: '2px' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '14px', color: '#B91C1C', fontWeight: 600, marginBottom: '4px' }}>
                          Generation failed
                        </div>
                        <div style={{ fontSize: '13px', color: '#991B1B', marginBottom: '12px' }}>
                          {genError}
                        </div>
                        <button
                          onClick={trip.itineraries.length === 0 ? handleGenerate : handleRegenerate}
                          disabled={generating || (trip.itineraries.length > 0 && !regenInstructions.trim())}
                          style={{
                            background: '#B91C1C',
                            color: 'white',
                            border: 'none',
                            borderRadius: 'var(--radius)',
                            padding: '7px 16px',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <RefreshCw size={13} strokeWidth={2} /> Try again
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {generating && trip.itineraries.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                    <LoadingSpinner label="Generating itinerary with AI... this may take 20-30 seconds" />
                  </div>
                )}

                {selectedItinerary && (
                  <ItineraryTimeline data={selectedItinerary.itinerary_json} />
                )}
              </div>
            )}

            {/* ── FLIGHTS TAB ── */}
            {tab === 'flights' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-secondary)', margin: 0 }}>
                    Flights
                  </h3>
                  {!flightFormOpen && (
                    <button
                      onClick={openNewFlightForm}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        background: 'var(--color-primary)', color: 'white', border: 'none',
                        borderRadius: 'var(--radius)', padding: '8px 16px', fontSize: '13px',
                        fontWeight: 600, cursor: 'pointer',
                      }}
                    >
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
                        <input
                          type="date"
                          value={lookupDate}
                          onChange={e => setLookupDate(e.target.value)}
                          style={{
                            border: '1px solid var(--color-border)', borderRadius: 'var(--radius)',
                            padding: '7px 10px', fontSize: '13px', outline: 'none', background: 'white',
                          }}
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

                {/* Flight list */}
                {flights.length === 0 && !flightFormOpen ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-text-muted)' }}>
                    <PlaneTakeoff size={36} strokeWidth={1.2} style={{ marginBottom: '12px', opacity: 0.4 }} />
                    <p style={{ fontSize: '14px' }}>No flights added yet.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {flights.map(flight => (
                      <div key={flight.id} style={{
                        background: 'white', border: '1px solid var(--color-border)',
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
                        <div style={{ flex: 1, minWidth: '200px' }}>
                          <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>
                            {flight.departure_airport} → {flight.arrival_airport}
                            <span style={{ fontWeight: 400, color: 'var(--color-text-muted)', marginLeft: '8px', fontSize: '13px' }}>
                              {flight.airline}
                            </span>
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                            <span>Dep: {new Date(flight.departure_time).toLocaleString('en-AU', { dateStyle: 'short', timeStyle: 'short' })}{flight.terminal_departure ? ` · ${flight.terminal_departure}` : ''}</span>
                            <span>Arr: {new Date(flight.arrival_time).toLocaleString('en-AU', { dateStyle: 'short', timeStyle: 'short' })}{flight.terminal_arrival ? ` · ${flight.terminal_arrival}` : ''}</span>
                            {flight.booking_ref && <span>Ref: <strong>{flight.booking_ref}</strong></span>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            onClick={() => openEditFlightForm(flight)}
                            title="Edit"
                            style={{
                              background: 'var(--color-bg)', border: 'none', borderRadius: '6px',
                              padding: '6px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center',
                            }}
                          >
                            <Pencil size={13} strokeWidth={2} color="#475569" />
                          </button>
                          <button
                            onClick={() => handleDeleteFlight(flight)}
                            title="Delete"
                            style={{
                              background: '#FEF2F2', border: 'none', borderRadius: '6px',
                              padding: '6px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center',
                            }}
                          >
                            <Trash2 size={13} strokeWidth={2} color="#B91C1C" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── ACCOMMODATION TAB ── */}
            {tab === 'stays' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-secondary)', margin: 0 }}>
                    Accommodation
                  </h3>
                  {!stayFormOpen && (
                    <button
                      onClick={openNewStayForm}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        background: 'var(--color-primary)', color: 'white', border: 'none',
                        borderRadius: 'var(--radius)', padding: '8px 16px', fontSize: '13px',
                        fontWeight: 600, cursor: 'pointer',
                      }}
                    >
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

                {stays.length === 0 && !stayFormOpen ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-text-muted)' }}>
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" style={{ marginBottom: '12px', opacity: 0.4, display: 'block', margin: '0 auto 12px' }}>
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
                    </svg>
                    <p style={{ fontSize: '14px' }}>No accommodation added yet.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {stays.map(stay => {
                      const nights = Math.round((new Date(stay.check_out).getTime() - new Date(stay.check_in).getTime()) / 86400000)
                      return (
                        <div key={stay.id} style={{
                          background: 'white', border: '1px solid var(--color-border)',
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
                          <div style={{ flex: 1, minWidth: '200px' }}>
                            <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>{stay.name}</div>
                            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                              <span>Check-in: {new Date(stay.check_in).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                              <span>Check-out: {new Date(stay.check_out).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                              {stay.confirmation_number && <span>Ref: <strong>{stay.confirmation_number}</strong></span>}
                            </div>
                            {stay.address && <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>{stay.address}</div>}
                            {stay.notes && <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px', fontStyle: 'italic' }}>{stay.notes}</div>}
                          </div>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              onClick={() => openEditStayForm(stay)}
                              title="Edit"
                              style={{ background: 'var(--color-bg)', border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                            >
                              <Pencil size={13} strokeWidth={2} color="#475569" />
                            </button>
                            <button
                              onClick={() => handleDeleteStay(stay)}
                              title="Delete"
                              style={{ background: '#FEF2F2', border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                            >
                              <Trash2 size={13} strokeWidth={2} color="#B91C1C" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── MESSAGES TAB ── */}
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
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
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

            {/* ── NOTES TAB ── */}
            {tab === 'notes' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <StickyNote size={16} color="#64748B" strokeWidth={2} />
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-secondary)', margin: 0 }}>
                    Internal Notes
                  </h3>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginLeft: '4px' }}>
                    — not visible to the client
                  </span>
                </div>
                <textarea
                  value={notes}
                  onChange={e => { setNotes(e.target.value); setNotesSaved(false) }}
                  placeholder="Add internal notes about this trip — client preferences, supplier contacts, booking references, special requests..."
                  rows={14}
                  style={{
                    width: '100%',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius)',
                    padding: '14px',
                    fontSize: '14px',
                    lineHeight: '1.6',
                    resize: 'vertical',
                    outline: 'none',
                    fontFamily: 'inherit',
                    color: 'var(--color-text)',
                    boxSizing: 'border-box',
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px', marginTop: '12px' }}>
                  {notesSaved && (
                    <span style={{ fontSize: '13px', color: '#15803D', fontWeight: 500 }}>
                      Saved
                    </span>
                  )}
                  <button
                    onClick={handleSaveNotes}
                    disabled={notesSaving}
                    style={{
                      background: notesSaving ? 'var(--color-border)' : 'var(--color-secondary)',
                      color: 'white',
                      border: 'none',
                      borderRadius: 'var(--radius)',
                      padding: '10px 20px',
                      fontSize: '14px',
                      fontWeight: 700,
                      cursor: notesSaving ? 'default' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    {notesSaving ? <LoadingSpinner size={14} color="white" label="" /> : <Save size={14} strokeWidth={2} />}
                    {notesSaving ? 'Saving...' : 'Save Notes'}
                  </button>
                </div>
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
      </div>
    </Layout>
  )
}
