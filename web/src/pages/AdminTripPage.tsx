import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { User, PlaneTakeoff, Calendar, Clock, Wallet, Gauge, Sparkles, RefreshCw, AlertCircle, Send, StickyNote, Save } from 'lucide-react'
import Layout from '../components/Layout'
import ItineraryTimeline from '../components/ItineraryTimeline'
import MessageThread from '../components/MessageThread'
import LoadingSpinner from '../components/LoadingSpinner'
import {
  getAdminTrip,
  updateAdminTrip,
  generateItinerary,
  regenerateItinerary,
  sendAdminMessage,
  markAdminMessagesRead,
  getApiError,
} from '../api/client'
import type { TripDetail, Itinerary, Message } from '../types'

const VALID_STATUSES = ['INTAKE', 'DRAFT', 'REVIEW', 'CONFIRMED', 'ARCHIVED']

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  INTAKE: { bg: '#EEF2FF', text: '#4F46E5' },
  DRAFT: { bg: '#FFF7ED', text: '#C2410C' },
  REVIEW: { bg: '#FEF9C3', text: '#A16207' },
  CONFIRMED: { bg: '#DCFCE7', text: '#15803D' },
  ARCHIVED: { bg: '#F3F4F6', text: '#6B7280' },
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
  const [trip, setTrip] = useState<TripDetail | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'itinerary' | 'intake' | 'messages' | 'notes'>('itinerary')

  function switchTab(next: 'itinerary' | 'intake' | 'messages' | 'notes') {
    setTab(next)
    if (next === 'messages' && tripId) {
      markAdminMessagesRead(tripId)
      setMessages(prev => prev.map(m => m.sender_type === 'CLIENT' ? { ...m, is_read: true } : m))
    }
  }

  // Status update
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [sendingForReview, setSendingForReview] = useState(false)
  const [actionError, setActionError] = useState('')
  const [sendMessageError, setSendMessageError] = useState('')

  // Admin notes
  const [notes, setNotes] = useState('')
  const [notesSaving, setNotesSaving] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)

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

  async function handleSendForReview() {
    if (!tripId || !trip) return
    if (!window.confirm(`This will email ${trip.client.name} their itinerary for review. Continue?`)) return
    setSendingForReview(true)
    setActionError('')
    try {
      const updated = await updateAdminTrip(tripId, { status: 'REVIEW' })
      setTrip(updated)
      setMessages(updated.messages)
    } catch (e) {
      setActionError('Failed to send for review: ' + getApiError(e))
    } finally {
      setSendingForReview(false)
    }
  }

  async function handleGenerate() {
    if (!tripId) return
    setGenerating(true)
    setGenError('')
    try {
      const itinerary = await generateItinerary(tripId)
      setTrip(prev => {
        if (!prev) return prev
        return {
          ...prev,
          itineraries: [...prev.itineraries, itinerary],
          status: prev.status === 'INTAKE' ? 'DRAFT' : prev.status,
        }
      })
      setSelectedItineraryVersion(itinerary.version)
    } catch (e) {
      setGenError(getApiError(e))
    } finally {
      setGenerating(false)
    }
  }

  async function handleRegenerate() {
    if (!tripId || !regenInstructions.trim()) return
    setGenerating(true)
    setGenError('')
    try {
      const itinerary = await regenerateItinerary(tripId, regenInstructions)
      setTrip(prev => {
        if (!prev) return prev
        return {
          ...prev,
          itineraries: [...prev.itineraries, itinerary],
        }
      })
      setSelectedItineraryVersion(itinerary.version)
      setRegenInstructions('')
    } catch (e) {
      setGenError(getApiError(e))
    } finally {
      setGenerating(false)
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

  const statusColors = STATUS_COLORS[trip.status] || STATUS_COLORS.INTAKE
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
          background: 'linear-gradient(135deg, var(--color-secondary), #1a2639)',
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
                <span style={{ fontSize: '13px', color: '#94A3B8' }}>{trip.client.name} · {trip.client.email}</span>
              </div>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                {[
                  { Icon: PlaneTakeoff, label: trip.origin_city },
                  { Icon: Calendar, label: `${new Date(trip.start_date).toLocaleDateString('en-AU')} — ${new Date(trip.end_date).toLocaleDateString('en-AU')}` },
                  { Icon: Clock, label: `${tripDays} days` },
                  { Icon: Wallet, label: trip.budget_range },
                  { Icon: Gauge, label: trip.pace },
                ].map(({ Icon, label }) => (
                  <span key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', color: '#94A3B8' }}>
                    <Icon size={13} color="#64748B" strokeWidth={2} />
                    {label}
                  </span>
                ))}
              </div>
            </div>

            {/* Status */}
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
          </div>
        </div>

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
            <TabButton label="Intake" active={tab === 'intake'} onClick={() => switchTab('intake')} />
            <TabButton label="Notes" active={tab === 'notes'} onClick={() => switchTab('notes')} />
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
                  background: '#F8FAFC',
                  borderRadius: 'var(--radius)',
                  padding: '16px',
                  marginBottom: '24px',
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}>
                  {trip.itineraries.length === 0 ? (
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <button
                        onClick={handleGenerate}
                        disabled={generating}
                        style={{
                          background: generating ? 'var(--color-border)' : 'var(--color-primary)',
                          color: 'white',
                          border: 'none',
                          borderRadius: 'var(--radius)',
                          padding: '10px 22px',
                          fontSize: '14px',
                          fontWeight: 700,
                          cursor: generating ? 'default' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                        }}
                      >
                        {generating ? <LoadingSpinner size={16} color="white" label="" /> : <Sparkles size={15} strokeWidth={2} />}
                        {generating ? 'Generating itinerary...' : 'Generate Itinerary with AI'}
                      </button>
                      <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                        Uses OpenAI GPT-4o with destination knowledge
                      </span>
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

                {/* Send for Review */}
                {trip.itineraries.length > 0 && trip.status === 'DRAFT' && (
                  <div style={{
                    background: '#FFF7ED',
                    border: '1px solid #FED7AA',
                    borderRadius: 'var(--radius)',
                    padding: '16px',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '14px', color: '#C2410C' }}>Ready to send to client?</div>
                      <div style={{ fontSize: '13px', color: '#9A3412', marginTop: '2px' }}>
                        This will email {trip.client.name} and ask them to review and approve the itinerary.
                      </div>
                    </div>
                    <button
                      onClick={handleSendForReview}
                      disabled={sendingForReview}
                      style={{
                        background: sendingForReview ? 'var(--color-border)' : '#C2410C',
                        color: 'white',
                        border: 'none',
                        borderRadius: 'var(--radius)',
                        padding: '10px 20px',
                        fontSize: '14px',
                        fontWeight: 700,
                        cursor: sendingForReview ? 'default' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {sendingForReview ? <LoadingSpinner size={14} color="white" label="" /> : <Send size={14} strokeWidth={2} />}
                      {sendingForReview ? 'Sending...' : 'Send for Review'}
                    </button>
                  </div>
                )}

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

            {/* ── INTAKE TAB ── */}
            {tab === 'intake' && (
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px', color: 'var(--color-secondary)' }}>
                  Client Intake Response
                </h3>
                {trip.intake_response ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                    {[
                      ['Travellers', trip.intake_response.travellers_count.toString()],
                      ['Accommodation Style', trip.intake_response.accommodation_style],
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
                        border: '1px solid var(--color-border)',
                      }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                          {label}
                        </div>
                        <div style={{ fontSize: '14px', color: 'var(--color-text)', lineHeight: '1.4' }}>{value}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: 'var(--color-text-muted)' }}>No intake response found for this trip.</p>
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
          </div>
        </div>
      </div>
    </Layout>
  )
}
