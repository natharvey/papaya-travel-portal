import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, Calendar, Wallet, Users, ArrowRight, ArrowLeft, Send, Loader2 } from 'lucide-react'
import Layout from '../components/Layout'
import LoadingSpinner from '../components/LoadingSpinner'
import { submitIntake, intakeChat, getClientMe, getApiError } from '../api/client'

// ─── Shared styles ────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 600,
  marginBottom: '6px',
  color: '#374151',
  letterSpacing: '0.2px',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1.5px solid var(--color-border)',
  borderRadius: '10px',
  padding: '11px 14px',
  fontSize: '14px',
  outline: 'none',
  background: 'white',
  color: 'var(--color-text)',
  boxSizing: 'border-box',
}

// ─── Step 1: Trip basics ──────────────────────────────────────────────────────

interface TripData {
  trip_title: string
  origin_city: string
  start_date: string
  end_date: string
  budget_range: string
  travellers_count: number
}

function StepTripBasics({ data, onChange }: { data: TripData; onChange: (k: keyof TripData, v: string | number) => void }) {
  return (
    <div>
      <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '6px' }}>Where are you headed?</h2>
      <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginBottom: '28px', lineHeight: '1.5' }}>
        Just the basics — Maya will handle the details in the next step.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <div>
          <label style={labelStyle}>Destination</label>
          <div style={{ position: 'relative' }}>
            <MapPin size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
            <input
              type="text"
              value={data.trip_title}
              onChange={e => onChange('trip_title', e.target.value)}
              placeholder="e.g. Bali & Lombok, Japan, Italy"
              style={{ ...inputStyle, paddingLeft: '36px' }}
              autoFocus
            />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Departing from</label>
          <div style={{ position: 'relative' }}>
            <MapPin size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
            <input
              type="text"
              value={data.origin_city}
              onChange={e => onChange('origin_city', e.target.value)}
              placeholder="e.g. Sydney, Melbourne, Brisbane"
              style={{ ...inputStyle, paddingLeft: '36px' }}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <div>
            <label style={labelStyle}>Departure date</label>
            <div style={{ position: 'relative' }}>
              <Calendar size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
              <input
                type="date"
                value={data.start_date}
                onChange={e => onChange('start_date', e.target.value)}
                style={{ ...inputStyle, paddingLeft: '36px', colorScheme: 'light' }}
              />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Return date</label>
            <div style={{ position: 'relative' }}>
              <Calendar size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
              <input
                type="date"
                value={data.end_date}
                onChange={e => onChange('end_date', e.target.value)}
                style={{ ...inputStyle, paddingLeft: '36px', colorScheme: 'light' }}
              />
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <div>
            <label style={labelStyle}>Budget (AUD)</label>
            <div style={{ position: 'relative' }}>
              <Wallet size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
              <input
                type="text"
                value={data.budget_range}
                onChange={e => onChange('budget_range', e.target.value)}
                placeholder="e.g. $5,000–$8,000"
                style={{ ...inputStyle, paddingLeft: '36px' }}
              />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Travellers</label>
            <div style={{ position: 'relative' }}>
              <Users size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
              <input
                type="number"
                min={1}
                max={20}
                value={data.travellers_count}
                onChange={e => onChange('travellers_count', parseInt(e.target.value) || 1)}
                style={{ ...inputStyle, paddingLeft: '36px' }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Step 2: AI chat ──────────────────────────────────────────────────────────

interface ChatMsg {
  role: 'user' | 'assistant'
  content: string
}

interface StepChatProps {
  seedData: Record<string, string | number>
  onComplete: (transcript: string) => void
}

function StepChat({ seedData, onComplete }: StepChatProps) {
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [started, setStarted] = useState(false)
  const [complete, setComplete] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    startChat()
  }, [])

  async function startChat() {
    setStarted(true)
    setLoading(true)
    try {
      const { message } = await intakeChat([], seedData)
      setMessages([{ role: 'assistant', content: message }])
    } catch {
      setMessages([{ role: 'assistant', content: "Hi! I'm Maya, your Papaya travel consultant. Tell me a bit about what you're hoping to get out of this trip!" }])
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  async function send() {
    const text = input.trim()
    if (!text || loading || complete) return

    const newMessages: ChatMsg[] = [...messages, { role: 'user', content: text }]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const { message, complete: done } = await intakeChat(newMessages, seedData)
      const updated: ChatMsg[] = [...newMessages, { role: 'assistant', content: message }]
      setMessages(updated)
      if (done) {
        setComplete(true)
        const transcript = updated
          .map(m => `${m.role === 'user' ? 'Client' : 'Maya'}: ${m.content}`)
          .join('\n\n')
        onComplete(transcript)
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I had a connection issue. Could you repeat that?" }])
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div>
      <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '4px' }}>Chat with Maya</h2>
      <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginBottom: '20px', lineHeight: '1.5' }}>
        She'll ask a few quick questions to personalise your itinerary.
      </p>

      <div style={{
        height: '380px',
        overflowY: 'auto',
        border: '1.5px solid var(--color-border)',
        borderRadius: '12px',
        padding: '16px',
        background: '#F8FAFC',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        marginBottom: '12px',
      }}>
        {!started && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <LoadingSpinner size={24} label="Connecting to Maya..." />
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            {msg.role === 'assistant' && (
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%',
                background: 'var(--color-primary)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                fontSize: '14px', flexShrink: 0, marginRight: '8px', marginTop: '2px',
              }}>
                🌴
              </div>
            )}
            <div style={{
              maxWidth: '80%',
              padding: '10px 14px',
              borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              background: msg.role === 'user' ? 'var(--color-primary)' : 'white',
              color: msg.role === 'user' ? 'white' : 'var(--color-text)',
              fontSize: '14px', lineHeight: '1.5',
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              border: msg.role === 'assistant' ? '1px solid var(--color-border)' : 'none',
            }}>
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%',
              background: 'var(--color-primary)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0,
            }}>🌴</div>
            <div style={{
              padding: '10px 14px', borderRadius: '16px 16px 16px 4px',
              background: 'white', border: '1px solid var(--color-border)',
              display: 'flex', gap: '4px', alignItems: 'center',
            }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: '6px', height: '6px', borderRadius: '50%',
                  background: 'var(--color-text-muted)',
                  animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                }} />
              ))}
            </div>
          </div>
        )}

        {complete && (
          <div style={{
            textAlign: 'center', padding: '12px',
            background: '#F0FDF4', border: '1px solid #BBF7D0',
            borderRadius: '10px', fontSize: '13px', color: '#15803D', fontWeight: 600,
          }}>
            ✓ All set! Click "Generate My Itinerary" below.
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {!complete && (
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Type your reply..."
            disabled={loading || !started}
            style={{ ...inputStyle, flex: 1, opacity: loading ? 0.7 : 1 }}
          />
          <button
            type="button"
            onClick={send}
            disabled={loading || !input.trim() || !started}
            style={{
              padding: '0 16px',
              background: 'var(--color-primary)', color: 'white',
              border: 'none', borderRadius: '10px',
              cursor: loading || !input.trim() ? 'default' : 'pointer',
              opacity: loading || !input.trim() ? 0.5 : 1,
              display: 'flex', alignItems: 'center',
            }}
          >
            {loading ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={18} />}
          </button>
        </div>
      )}

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; }
          40% { transform: scale(1.2); opacity: 1; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ step }: { step: number }) {
  const steps = ['Trip Basics', 'Chat with Maya']
  return (
    <div style={{ marginBottom: '32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', position: 'relative' }}>
        <div style={{
          position: 'absolute', top: '16px', left: '16px', right: '16px',
          height: '2px', background: 'var(--color-border)', zIndex: 0,
        }} />
        <div style={{
          position: 'absolute', top: '16px', left: '16px',
          width: step === 1 ? '0%' : '100%',
          height: '2px', background: 'var(--color-primary)', zIndex: 1,
          transition: 'width 0.3s ease',
        }} />
        {steps.map((label, i) => {
          const n = i + 1
          const done = step > n
          const active = step === n
          return (
            <div key={n} style={{ textAlign: 'center', zIndex: 2 }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%', margin: '0 auto 6px',
                background: done ? 'var(--color-primary)' : active ? 'var(--color-accent)' : 'white',
                border: `2px solid ${done || active ? 'var(--color-primary)' : 'var(--color-border)'}`,
                color: done ? 'white' : active ? 'var(--color-primary)' : 'var(--color-text-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: '13px', transition: 'all 0.2s',
              }}>
                {done ? '✓' : n}
              </div>
              <div style={{
                fontSize: '11px', fontWeight: active ? 700 : 500, whiteSpace: 'nowrap',
                color: active ? 'var(--color-primary)' : 'var(--color-text-muted)',
              }}>{label}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function NewTripPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [chatComplete, setChatComplete] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [clientInfo, setClientInfo] = useState<{ name: string; email: string } | null>(null)

  const [tripData, setTripData] = useState<TripData>({
    trip_title: '',
    origin_city: '',
    start_date: '',
    end_date: '',
    budget_range: '',
    travellers_count: 2,
  })

  useEffect(() => {
    getClientMe()
      .then(me => setClientInfo({ name: me.name, email: me.email }))
      .catch(() => navigate('/portal'))
  }, [])

  function validateTripData() {
    if (!tripData.trip_title.trim()) return 'Please enter your destination.'
    if (!tripData.origin_city.trim()) return 'Please enter your departure city.'
    if (!tripData.start_date) return 'Please select a departure date.'
    if (!tripData.end_date) return 'Please select a return date.'
    if (tripData.start_date >= tripData.end_date) return 'Return date must be after departure date.'
    if (!tripData.budget_range.trim()) return 'Please enter your budget.'
    return ''
  }

  function goNext() {
    const err = validateTripData()
    if (err) { setError(err); return }
    setError('')
    setStep(2)
  }

  async function handleSubmit() {
    if (!chatComplete) { setError('Please finish the conversation with Maya first.'); return }
    if (!clientInfo) return
    setSubmitting(true)
    setError('')
    try {
      const result = await submitIntake({
        client_name: clientInfo.name,
        client_email: clientInfo.email,
        trip_title: tripData.trip_title,
        origin_city: tripData.origin_city,
        start_date: tripData.start_date,
        end_date: tripData.end_date,
        budget_range: tripData.budget_range,
        pace: 'moderate',
        travellers_count: tripData.travellers_count,
        interests: [],
        constraints: '',
        accommodation_style: 'Mid-range Hotel',
        must_dos: '',
        must_avoid: '',
        notes: '',
        conversation_transcript: transcript,
      })
      // Already authenticated — go straight to the new trip
      navigate(`/portal/trips/${result.trip_id}`)
    } catch (e) {
      setError(getApiError(e))
      setSubmitting(false)
    }
  }

  const seedData = {
    destination: tripData.trip_title,
    origin_city: tripData.origin_city,
    start_date: tripData.start_date,
    end_date: tripData.end_date,
    budget_range: tripData.budget_range,
    travellers_count: tripData.travellers_count,
  }

  if (!clientInfo) {
    return (
      <Layout variant="client">
        <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <LoadingSpinner label="Loading..." />
        </div>
      </Layout>
    )
  }

  return (
    <Layout variant="client">
      <div style={{ maxWidth: '620px', margin: '0 auto', padding: '40px 24px 80px' }}>
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--color-text)', marginBottom: '6px', letterSpacing: '-0.3px' }}>
            Plan a new trip
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '15px' }}>
            Planning as <strong>{clientInfo.name}</strong>
          </p>
        </div>

        <ProgressBar step={step} />

        <div style={{
          background: 'white',
          border: '1.5px solid var(--color-border)',
          borderRadius: '16px',
          padding: '32px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
        }}>
          {step === 1 && (
            <StepTripBasics
              data={tripData}
              onChange={(k, v) => setTripData(prev => ({ ...prev, [k]: v } as TripData))}
            />
          )}
          {step === 2 && (
            <StepChat
              seedData={seedData}
              onComplete={(t) => { setTranscript(t); setChatComplete(true) }}
            />
          )}

          {error && (
            <div style={{
              background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px',
              padding: '12px 14px', fontSize: '13px', color: '#B91C1C', marginTop: '20px',
            }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '28px', gap: '12px' }}>
            {step === 2 ? (
              <button
                type="button"
                onClick={() => { setError(''); setStep(1) }}
                disabled={chatComplete}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  background: 'white', border: '1.5px solid var(--color-border)',
                  color: 'var(--color-text-muted)', padding: '11px 20px',
                  borderRadius: '10px', fontSize: '14px', fontWeight: 600,
                  cursor: chatComplete ? 'default' : 'pointer',
                  opacity: chatComplete ? 0.4 : 1,
                }}
              >
                <ArrowLeft size={15} /> Back
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigate('/portal')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  background: 'white', border: '1.5px solid var(--color-border)',
                  color: 'var(--color-text-muted)', padding: '11px 20px',
                  borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            )}

            {step === 1 ? (
              <button
                type="button"
                onClick={goNext}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  background: 'var(--color-primary)', color: 'white',
                  border: 'none', padding: '11px 24px',
                  borderRadius: '10px', fontSize: '14px', fontWeight: 700, cursor: 'pointer',
                }}
              >
                Continue <ArrowRight size={15} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!chatComplete || submitting}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  background: !chatComplete || submitting ? 'var(--color-border)' : 'var(--color-primary)',
                  color: 'white', border: 'none', padding: '11px 24px',
                  borderRadius: '10px', fontSize: '14px', fontWeight: 700,
                  cursor: !chatComplete || submitting ? 'default' : 'pointer',
                }}
              >
                {submitting ? (
                  <><LoadingSpinner size={16} color="white" label="" /> Generating...</>
                ) : (
                  <>Generate My Itinerary <ArrowRight size={15} /></>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}
