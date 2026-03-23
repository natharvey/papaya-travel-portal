import { useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import LoadingSpinner from '../components/LoadingSpinner'
import { submitIntake, getApiError } from '../api/client'
import type { IntakeCreatePayload, IntakeSubmitResponse } from '../types'

const INTERESTS = [
  'Beach & Swimming', 'Culture & History', 'Food & Dining', 'Adventure Sports',
  'Wildlife & Nature', 'Art & Museums', 'Nightlife', 'Shopping', 'Hiking & Trekking',
  'Spiritual & Wellness', 'Photography', 'Family Activities', 'Diving & Snorkelling',
  'Local Markets', 'Architecture', 'Wine & Gastronomy',
]

const PACE_OPTIONS = [
  { value: 'relaxed', label: '😌 Relaxed', desc: 'Few activities per day, lots of downtime' },
  { value: 'moderate', label: '🚶 Moderate', desc: 'Mix of activities and rest days' },
  { value: 'packed', label: '⚡ Packed', desc: 'Maximum sights and experiences each day' },
]

const ACCOMMODATION_STYLES = [
  'Budget / Hostel', 'Guesthouse / B&B', 'Mid-range Hotel', 'Boutique Hotel',
  'Luxury Hotel / Resort', 'Serviced Apartment', 'Villa / Private House', 'Eco-lodge',
]

function Step1({ data, onChange }: { data: Partial<IntakeCreatePayload>; onChange: (k: string, v: unknown) => void }) {
  return (
    <div>
      <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '6px' }}>Tell us about yourself</h2>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: '28px' }}>We'll create your personalised portal with these details.</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <label style={labelStyle}>Full Name *</label>
          <input
            type="text"
            value={data.client_name || ''}
            onChange={e => onChange('client_name', e.target.value)}
            placeholder="Jane Smith"
            style={inputStyle}
            required
          />
        </div>
        <div>
          <label style={labelStyle}>Email Address *</label>
          <input
            type="email"
            value={data.client_email || ''}
            onChange={e => onChange('client_email', e.target.value)}
            placeholder="jane@example.com"
            style={inputStyle}
            required
          />
          <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            This will be your login email for the client portal.
          </p>
        </div>
      </div>
    </div>
  )
}

function Step2({ data, onChange }: { data: Partial<IntakeCreatePayload>; onChange: (k: string, v: unknown) => void }) {
  return (
    <div>
      <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '6px' }}>Trip Details</h2>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: '28px' }}>Help us understand the shape of your journey.</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <label style={labelStyle}>Trip Title *</label>
          <input
            type="text"
            value={data.trip_title || ''}
            onChange={e => onChange('trip_title', e.target.value)}
            placeholder="e.g. Honeymoon in Bali & Lombok"
            style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>Departing From *</label>
          <input
            type="text"
            value={data.origin_city || ''}
            onChange={e => onChange('origin_city', e.target.value)}
            placeholder="e.g. Sydney"
            style={inputStyle}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={labelStyle}>Departure Date *</label>
            <input
              type="date"
              value={data.start_date || ''}
              onChange={e => onChange('start_date', e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Return Date *</label>
            <input
              type="date"
              value={data.end_date || ''}
              onChange={e => onChange('end_date', e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Budget Range (AUD) *</label>
          <input
            type="text"
            value={data.budget_range || ''}
            onChange={e => onChange('budget_range', e.target.value)}
            placeholder="e.g. $5,000 – $8,000 AUD per person"
            style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>Travel Pace *</label>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {PACE_OPTIONS.map(opt => (
              <label
                key={opt.value}
                style={{
                  flex: '1 1 200px',
                  border: `2px solid ${data.pace === opt.value ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  borderRadius: 'var(--radius)',
                  padding: '14px',
                  cursor: 'pointer',
                  background: data.pace === opt.value ? 'var(--color-accent)' : 'white',
                  transition: 'all 0.2s',
                }}
              >
                <input
                  type="radio"
                  name="pace"
                  value={opt.value}
                  checked={data.pace === opt.value}
                  onChange={() => onChange('pace', opt.value)}
                  style={{ display: 'none' }}
                />
                <div style={{ fontWeight: 600, marginBottom: '4px' }}>{opt.label}</div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{opt.desc}</div>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function Step3({ data, onChange }: { data: Partial<IntakeCreatePayload>; onChange: (k: string, v: unknown) => void }) {
  const interests = data.interests || []

  function toggleInterest(interest: string) {
    const current = [...interests]
    const idx = current.indexOf(interest)
    if (idx === -1) {
      onChange('interests', [...current, interest])
    } else {
      onChange('interests', current.filter((_, i) => i !== idx))
    }
  }

  return (
    <div>
      <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '6px' }}>Your Preferences</h2>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: '28px' }}>The more detail you share, the better your personalised itinerary.</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div>
          <label style={labelStyle}>Number of Travellers *</label>
          <input
            type="number"
            min="1"
            max="20"
            value={data.travellers_count || 1}
            onChange={e => onChange('travellers_count', parseInt(e.target.value))}
            style={{ ...inputStyle, width: '120px' }}
          />
        </div>

        <div>
          <label style={labelStyle}>Interests (select all that apply)</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
            {INTERESTS.map(interest => {
              const selected = interests.includes(interest)
              return (
                <button
                  key={interest}
                  type="button"
                  onClick={() => toggleInterest(interest)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '100px',
                    border: `2px solid ${selected ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    background: selected ? 'var(--color-primary)' : 'white',
                    color: selected ? 'white' : 'var(--color-text)',
                    fontSize: '13px',
                    fontWeight: selected ? 600 : 400,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {interest}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <label style={labelStyle}>Accommodation Style *</label>
          <select
            value={data.accommodation_style || ''}
            onChange={e => onChange('accommodation_style', e.target.value)}
            style={inputStyle}
          >
            <option value="">Select style...</option>
            {ACCOMMODATION_STYLES.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={labelStyle}>Must-Dos</label>
          <textarea
            value={data.must_dos || ''}
            onChange={e => onChange('must_dos', e.target.value)}
            placeholder="Things you absolutely must experience, e.g. Eiffel Tower dinner, cooking class..."
            rows={3}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>

        <div>
          <label style={labelStyle}>Must-Avoid</label>
          <textarea
            value={data.must_avoid || ''}
            onChange={e => onChange('must_avoid', e.target.value)}
            placeholder="Things to avoid, e.g. very touristy places, crowded attractions..."
            rows={2}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>

        <div>
          <label style={labelStyle}>Any Constraints or Requirements?</label>
          <textarea
            value={data.constraints || ''}
            onChange={e => onChange('constraints', e.target.value)}
            placeholder="Dietary requirements, mobility needs, health considerations, visa restrictions..."
            rows={2}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>

        <div>
          <label style={labelStyle}>Additional Notes</label>
          <textarea
            value={data.notes || ''}
            onChange={e => onChange('notes', e.target.value)}
            placeholder="Anything else we should know about you or your trip..."
            rows={3}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '14px',
  fontWeight: 600,
  marginBottom: '6px',
  color: 'var(--color-text)',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius)',
  padding: '10px 14px',
  fontSize: '14px',
  outline: 'none',
  transition: 'border-color 0.2s',
  background: 'white',
}

export default function IntakePage() {
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState<Partial<IntakeCreatePayload>>({
    travellers_count: 2,
    interests: [],
    constraints: '',
    must_dos: '',
    must_avoid: '',
    notes: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<IntakeSubmitResponse | null>(null)

  function handleChange(key: string, value: unknown) {
    setFormData(prev => ({ ...prev, [key]: value }))
  }

  function validateStep(s: number): string {
    if (s === 1) {
      if (!formData.client_name?.trim()) return 'Please enter your name.'
      if (!formData.client_email?.trim()) return 'Please enter your email.'
    }
    if (s === 2) {
      if (!formData.trip_title?.trim()) return 'Please enter a trip title.'
      if (!formData.origin_city?.trim()) return 'Please enter your departure city.'
      if (!formData.start_date) return 'Please select a departure date.'
      if (!formData.end_date) return 'Please select a return date.'
      if (formData.start_date && formData.end_date && formData.start_date >= formData.end_date) {
        return 'Return date must be after departure date.'
      }
      if (!formData.budget_range?.trim()) return 'Please enter your budget range.'
      if (!formData.pace) return 'Please select a travel pace.'
    }
    if (s === 3) {
      if (!formData.accommodation_style) return 'Please select an accommodation style.'
    }
    return ''
  }

  function nextStep() {
    const err = validateStep(step)
    if (err) { setError(err); return }
    setError('')
    setStep(s => s + 1)
  }

  async function handleSubmit() {
    const err = validateStep(3)
    if (err) { setError(err); return }
    setLoading(true)
    setError('')
    try {
      const payload = formData as IntakeCreatePayload
      const result = await submitIntake(payload)
      setSuccess(result)
    } catch (e) {
      setError(getApiError(e))
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <Layout variant="public">
        <div style={{
          maxWidth: '560px',
          margin: '60px auto',
          padding: '0 24px',
          textAlign: 'center',
        }}>
          <div style={{
            width: '72px',
            height: '72px',
            background: 'var(--color-success)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '36px',
            margin: '0 auto 24px',
          }}>
            ✓
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '12px' }}>
            Your trip is submitted!
          </h1>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: '32px', lineHeight: '1.6' }}>
            Our team will start working on your personalised itinerary. You can log in to your portal to check progress and send messages.
          </p>

          <div style={{
            background: 'var(--color-secondary)',
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
            textAlign: 'left',
            marginBottom: '24px',
            color: 'white',
          }}>
            <div style={{ fontSize: '13px', color: '#94A3B8', marginBottom: '8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              Your Portal Login Credentials
            </div>
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '12px', color: '#94A3B8' }}>Email</div>
              <div style={{ fontSize: '16px', fontWeight: 600 }}>{success.email}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#94A3B8' }}>Reference Code</div>
              <div style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '3px', color: 'var(--color-primary)' }}>
                {success.reference_code}
              </div>
            </div>
            <div style={{
              background: 'rgba(255,107,53,0.15)',
              border: '1px solid rgba(255,107,53,0.3)',
              borderRadius: 'var(--radius)',
              padding: '10px 12px',
              fontSize: '12px',
              color: '#FFA07A',
              marginTop: '16px',
            }}>
              💾 Save your reference code — you will need it to log in.
            </div>
          </div>

          <Link
            to="/login"
            style={{
              display: 'inline-block',
              background: 'var(--color-primary)',
              color: 'white',
              padding: '14px 32px',
              borderRadius: 'var(--radius)',
              fontWeight: 700,
              fontSize: '16px',
              textDecoration: 'none',
            }}
          >
            Log in to Your Portal →
          </Link>
        </div>
      </Layout>
    )
  }

  return (
    <Layout variant="public">
      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '40px 24px 80px' }}>
        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-primary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Papaya Travel Portal
          </div>
          <h1 style={{ fontSize: '36px', fontWeight: 800, color: 'var(--color-secondary)', marginBottom: '12px', lineHeight: '1.2' }}>
            Plan your perfect trip
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '16px' }}>
            Tell us about your dream journey and we'll craft a personalised itinerary just for you.
          </p>
        </div>

        {/* Progress steps */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0', marginBottom: '40px' }}>
          {['Your Details', 'Trip Info', 'Preferences'].map((label, i) => {
            const stepNum = i + 1
            const active = step === stepNum
            const done = step > stepNum
            return (
              <div key={stepNum} style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: done ? 'var(--color-success)' : active ? 'var(--color-primary)' : 'var(--color-border)',
                    color: done || active ? 'white' : 'var(--color-text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '14px',
                    margin: '0 auto 4px',
                    transition: 'all 0.2s',
                  }}>
                    {done ? '✓' : stepNum}
                  </div>
                  <div style={{ fontSize: '11px', color: active ? 'var(--color-primary)' : 'var(--color-text-muted)', fontWeight: active ? 600 : 400, whiteSpace: 'nowrap' }}>
                    {label}
                  </div>
                </div>
                {i < 2 && (
                  <div style={{
                    width: '60px',
                    height: '2px',
                    background: done ? 'var(--color-success)' : 'var(--color-border)',
                    margin: '-16px 8px 0',
                    transition: 'background 0.2s',
                  }} />
                )}
              </div>
            )
          })}
        </div>

        {/* Form card */}
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '32px',
          boxShadow: 'var(--shadow-md)',
        }}>
          {step === 1 && <Step1 data={formData} onChange={handleChange} />}
          {step === 2 && <Step2 data={formData} onChange={handleChange} />}
          {step === 3 && <Step3 data={formData} onChange={handleChange} />}

          {error && (
            <div style={{
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: 'var(--radius)',
              padding: '10px 14px',
              fontSize: '14px',
              color: '#B91C1C',
              marginTop: '20px',
            }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '28px', gap: '12px' }}>
            {step > 1 ? (
              <button
                type="button"
                onClick={() => { setError(''); setStep(s => s - 1) }}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)',
                  padding: '12px 24px',
                  borderRadius: 'var(--radius)',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                ← Back
              </button>
            ) : (
              <div />
            )}

            {step < 3 ? (
              <button
                type="button"
                onClick={nextStep}
                style={{
                  background: 'var(--color-primary)',
                  color: 'white',
                  border: 'none',
                  padding: '12px 32px',
                  borderRadius: 'var(--radius)',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Next →
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                style={{
                  background: loading ? 'var(--color-border)' : 'var(--color-primary)',
                  color: 'white',
                  border: 'none',
                  padding: '12px 32px',
                  borderRadius: 'var(--radius)',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: loading ? 'default' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                {loading ? <LoadingSpinner size={18} color="white" label="" /> : null}
                {loading ? 'Submitting...' : 'Submit My Trip →'}
              </button>
            )}
          </div>
        </div>

        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
            Log in here
          </Link>
        </p>
      </div>
    </Layout>
  )
}
