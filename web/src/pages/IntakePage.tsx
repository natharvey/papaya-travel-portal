import { useState } from 'react'
import { Link } from 'react-router-dom'
import { User, Mail, MapPin, Calendar, Wallet, Zap, Coffee, Wind, Users, Hotel, Star, AlertCircle, FileText, CheckCircle, ArrowRight, ArrowLeft } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import Layout from '../components/Layout'
import PapayaLogo from '../components/PapayaLogo'
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
  { value: 'relaxed', label: 'Relaxed', desc: 'Few activities per day, plenty of downtime', Icon: Coffee },
  { value: 'moderate', label: 'Moderate', desc: 'A healthy mix of activities and rest', Icon: Wind },
  { value: 'packed', label: 'Packed', desc: 'Maximum sights and experiences each day', Icon: Zap },
]

const ACCOMMODATION_STYLES = [
  'Budget / Hostel', 'Guesthouse / B&B', 'Mid-range Hotel', 'Boutique Hotel',
  'Luxury Hotel / Resort', 'Serviced Apartment', 'Villa / Private House', 'Eco-lodge',
]

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
  border: '1.5px solid #E2E8F0',
  borderRadius: '10px',
  padding: '11px 14px',
  fontSize: '14px',
  outline: 'none',
  background: 'white',
  color: '#1E293B',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s',
}

function InputWithIcon({ icon: Icon, children }: { icon: LucideIcon, children: React.ReactNode }) {
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
        <Icon size={15} strokeWidth={2} color="#94A3B8" />
      </div>
      {children}
    </div>
  )
}

function Step1({ data, onChange }: { data: Partial<IntakeCreatePayload>; onChange: (k: string, v: unknown) => void }) {
  return (
    <div>
      <div style={{ marginBottom: '28px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1E293B', marginBottom: '6px' }}>Tell us about yourself</h2>
        <p style={{ fontSize: '14px', color: '#64748B', lineHeight: '1.5' }}>We'll use these details to create your personalised travel portal.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <div>
          <label style={labelStyle}>Full Name</label>
          <InputWithIcon icon={User}>
            <input
              type="text"
              value={data.client_name || ''}
              onChange={e => onChange('client_name', e.target.value)}
              placeholder="Jane Smith"
              style={{ ...inputStyle, paddingLeft: '36px' }}
            />
          </InputWithIcon>
        </div>
        <div>
          <label style={labelStyle}>Email Address</label>
          <InputWithIcon icon={Mail}>
            <input
              type="email"
              value={data.client_email || ''}
              onChange={e => onChange('client_email', e.target.value)}
              placeholder="jane@example.com"
              style={{ ...inputStyle, paddingLeft: '36px' }}
            />
          </InputWithIcon>
          <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: '5px' }}>
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
      <div style={{ marginBottom: '28px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1E293B', marginBottom: '6px' }}>Trip details</h2>
        <p style={{ fontSize: '14px', color: '#64748B', lineHeight: '1.5' }}>Help us understand the shape of your journey.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <div>
          <label style={labelStyle}>Trip Title</label>
          <InputWithIcon icon={Star}>
            <input
              type="text"
              value={data.trip_title || ''}
              onChange={e => onChange('trip_title', e.target.value)}
              placeholder="e.g. Honeymoon in Bali & Lombok"
              style={{ ...inputStyle, paddingLeft: '36px' }}
            />
          </InputWithIcon>
        </div>

        <div>
          <label style={labelStyle}>Departing From</label>
          <InputWithIcon icon={MapPin}>
            <input
              type="text"
              value={data.origin_city || ''}
              onChange={e => onChange('origin_city', e.target.value)}
              placeholder="e.g. Sydney"
              style={{ ...inputStyle, paddingLeft: '36px' }}
            />
          </InputWithIcon>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <div>
            <label style={labelStyle}>Departure Date</label>
            <InputWithIcon icon={Calendar}>
              <input
                type="date"
                value={data.start_date || ''}
                onChange={e => onChange('start_date', e.target.value)}
                style={{ ...inputStyle, paddingLeft: '36px' }}
              />
            </InputWithIcon>
          </div>
          <div>
            <label style={labelStyle}>Return Date</label>
            <InputWithIcon icon={Calendar}>
              <input
                type="date"
                value={data.end_date || ''}
                onChange={e => onChange('end_date', e.target.value)}
                style={{ ...inputStyle, paddingLeft: '36px' }}
              />
            </InputWithIcon>
          </div>
        </div>

        <div>
          <label style={labelStyle}>Budget Range (AUD)</label>
          <InputWithIcon icon={Wallet}>
            <input
              type="text"
              value={data.budget_range || ''}
              onChange={e => onChange('budget_range', e.target.value)}
              placeholder="e.g. $5,000 – $8,000 AUD per person"
              style={{ ...inputStyle, paddingLeft: '36px' }}
            />
          </InputWithIcon>
        </div>

        <div>
          <label style={labelStyle}>Travel Pace</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '4px' }}>
            {PACE_OPTIONS.map(({ value, label, desc, Icon }) => {
              const selected = data.pace === value
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => onChange('pace', value)}
                  style={{
                    border: `2px solid ${selected ? '#F97316' : '#E2E8F0'}`,
                    borderRadius: '12px',
                    padding: '14px 10px',
                    cursor: 'pointer',
                    background: selected ? '#FFF7ED' : 'white',
                    textAlign: 'center',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
                    <Icon size={20} strokeWidth={2} color={selected ? '#F97316' : '#94A3B8'} />
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '13px', color: selected ? '#C2410C' : '#1E293B', marginBottom: '3px' }}>{label}</div>
                  <div style={{ fontSize: '11px', color: '#94A3B8', lineHeight: '1.4' }}>{desc}</div>
                </button>
              )
            })}
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
    onChange('interests', idx === -1 ? [...current, interest] : current.filter((_, i) => i !== idx))
  }

  return (
    <div>
      <div style={{ marginBottom: '28px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1E293B', marginBottom: '6px' }}>Your preferences</h2>
        <p style={{ fontSize: '14px', color: '#64748B', lineHeight: '1.5' }}>The more detail you share, the better your personalised itinerary.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <label style={labelStyle}>Number of Travellers</label>
          <InputWithIcon icon={Users}>
            <input
              type="number"
              min="1"
              max="20"
              value={data.travellers_count || 1}
              onChange={e => onChange('travellers_count', parseInt(e.target.value))}
              style={{ ...inputStyle, paddingLeft: '36px', width: '140px' }}
            />
          </InputWithIcon>
        </div>

        <div>
          <label style={labelStyle}>Interests <span style={{ fontWeight: 400, color: '#94A3B8' }}>(select all that apply)</span></label>
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
                    border: `1.5px solid ${selected ? '#F97316' : '#E2E8F0'}`,
                    background: selected ? '#FFF7ED' : 'white',
                    color: selected ? '#C2410C' : '#475569',
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
          <label style={labelStyle}>Accommodation Style</label>
          <InputWithIcon icon={Hotel}>
            <select
              value={data.accommodation_style || ''}
              onChange={e => onChange('accommodation_style', e.target.value)}
              style={{ ...inputStyle, paddingLeft: '36px', cursor: 'pointer' }}
            >
              <option value="">Select a style...</option>
              {ACCOMMODATION_STYLES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </InputWithIcon>
        </div>

        <div>
          <label style={labelStyle}>Must-Dos <span style={{ fontWeight: 400, color: '#94A3B8' }}>(optional)</span></label>
          <textarea
            value={data.must_dos || ''}
            onChange={e => onChange('must_dos', e.target.value)}
            placeholder="Things you absolutely must experience, e.g. Eiffel Tower dinner, cooking class..."
            rows={3}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>

        <div>
          <label style={labelStyle}>Must-Avoid <span style={{ fontWeight: 400, color: '#94A3B8' }}>(optional)</span></label>
          <textarea
            value={data.must_avoid || ''}
            onChange={e => onChange('must_avoid', e.target.value)}
            placeholder="Things to avoid, e.g. very touristy areas, crowded attractions..."
            rows={2}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>

        <div>
          <label style={labelStyle}>Constraints or Requirements <span style={{ fontWeight: 400, color: '#94A3B8' }}>(optional)</span></label>
          <textarea
            value={data.constraints || ''}
            onChange={e => onChange('constraints', e.target.value)}
            placeholder="Dietary needs, mobility considerations, visa restrictions, health requirements..."
            rows={2}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>

        <div>
          <label style={labelStyle}>Anything Else? <span style={{ fontWeight: 400, color: '#94A3B8' }}>(optional)</span></label>
          <textarea
            value={data.notes || ''}
            onChange={e => onChange('notes', e.target.value)}
            placeholder="Any other details we should know about you or your trip..."
            rows={3}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>
      </div>
    </div>
  )
}

const STEPS = ['Your Details', 'Trip Info', 'Preferences']

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
      if (formData.start_date && formData.end_date && formData.start_date >= formData.end_date)
        return 'Return date must be after departure date.'
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
      const result = await submitIntake(formData as IntakeCreatePayload)
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
        <div style={{ maxWidth: '520px', margin: '60px auto', padding: '0 24px', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
            <div style={{
              width: '72px',
              height: '72px',
              background: '#F0FDF4',
              border: '2px solid #BBF7D0',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <CheckCircle size={36} color="#15803D" strokeWidth={1.5} />
            </div>
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#1E293B', marginBottom: '10px' }}>
            Your trip is submitted!
          </h1>
          <p style={{ color: '#64748B', marginBottom: '32px', lineHeight: '1.6', fontSize: '15px' }}>
            Our team will start crafting your personalised itinerary. We've sent your login details to your email — check your inbox.
          </p>

          <div style={{
            background: '#1E293B',
            borderRadius: '16px',
            padding: '24px',
            textAlign: 'left',
            marginBottom: '24px',
            color: 'white',
          }}>
            <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '16px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
              Your Portal Login
            </div>
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '2px' }}>Email</div>
              <div style={{ fontSize: '15px', fontWeight: 600 }}>{success.email}</div>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '2px' }}>Reference Code</div>
              <div style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '4px', color: '#F97316' }}>
                {success.reference_code}
              </div>
            </div>
            <div style={{
              background: 'rgba(249,115,22,0.1)',
              border: '1px solid rgba(249,115,22,0.2)',
              borderRadius: '8px',
              padding: '10px 12px',
              fontSize: '12px',
              color: '#FB923C',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <AlertCircle size={14} strokeWidth={2} />
              Save your reference code — you will need it to log in.
            </div>
          </div>

          <Link
            to="/login"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: '#F97316',
              color: 'white',
              padding: '14px 32px',
              borderRadius: '12px',
              fontWeight: 700,
              fontSize: '15px',
              textDecoration: 'none',
            }}
          >
            Log in to Your Portal <ArrowRight size={16} strokeWidth={2.5} />
          </Link>
        </div>
      </Layout>
    )
  }

  return (
    <Layout variant="public">
      <div style={{ maxWidth: '620px', margin: '0 auto', padding: '40px 24px 80px' }}>
        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
            <PapayaLogo size={52} />
          </div>
          <h1 style={{ fontSize: '32px', fontWeight: 800, color: '#1E293B', marginBottom: '10px', lineHeight: '1.2' }}>
            Plan your perfect trip
          </h1>
          <p style={{ color: '#64748B', fontSize: '15px', lineHeight: '1.5' }}>
            Tell us about your dream journey and we'll craft a personalised itinerary just for you.
          </p>
        </div>

        {/* Progress bar */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
            {/* Background line */}
            <div style={{
              position: 'absolute',
              top: '16px',
              left: '16px',
              right: '16px',
              height: '2px',
              background: '#E2E8F0',
              zIndex: 0,
            }} />
            {/* Progress line */}
            <div style={{
              position: 'absolute',
              top: '16px',
              left: '16px',
              width: step === 1 ? '0%' : step === 2 ? '50%' : '100%',
              height: '2px',
              background: '#F97316',
              zIndex: 1,
              transition: 'width 0.3s ease',
            }} />

            {STEPS.map((label, i) => {
              const stepNum = i + 1
              const done = step > stepNum
              const active = step === stepNum
              return (
                <div key={stepNum} style={{ textAlign: 'center', zIndex: 2 }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: done ? '#F97316' : active ? '#FFF7ED' : 'white',
                    border: `2px solid ${done || active ? '#F97316' : '#E2E8F0'}`,
                    color: done ? 'white' : active ? '#F97316' : '#94A3B8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '13px',
                    margin: '0 auto 6px',
                    transition: 'all 0.2s',
                  }}>
                    {done ? <CheckCircle size={16} strokeWidth={2.5} /> : stepNum}
                  </div>
                  <div style={{
                    fontSize: '11px',
                    fontWeight: active ? 700 : 500,
                    color: active ? '#F97316' : done ? '#64748B' : '#94A3B8',
                    whiteSpace: 'nowrap',
                  }}>
                    {label}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Form card */}
        <div style={{
          background: 'white',
          border: '1.5px solid #E2E8F0',
          borderRadius: '16px',
          padding: '32px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
        }}>
          {step === 1 && <Step1 data={formData} onChange={handleChange} />}
          {step === 2 && <Step2 data={formData} onChange={handleChange} />}
          {step === 3 && <Step3 data={formData} onChange={handleChange} />}

          {error && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: '10px',
              padding: '12px 14px',
              fontSize: '13px',
              color: '#B91C1C',
              marginTop: '20px',
            }}>
              <AlertCircle size={15} strokeWidth={2} style={{ flexShrink: 0 }} />
              {error}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '28px', gap: '12px' }}>
            {step > 1 ? (
              <button
                type="button"
                onClick={() => { setError(''); setStep(s => s - 1) }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'white',
                  border: '1.5px solid #E2E8F0',
                  color: '#475569',
                  padding: '11px 20px',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <ArrowLeft size={15} strokeWidth={2.5} /> Back
              </button>
            ) : <div />}

            {step < 3 ? (
              <button
                type="button"
                onClick={nextStep}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#F97316',
                  color: 'white',
                  border: 'none',
                  padding: '11px 24px',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Continue <ArrowRight size={15} strokeWidth={2.5} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: loading ? '#E2E8F0' : '#F97316',
                  color: 'white',
                  border: 'none',
                  padding: '11px 24px',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: loading ? 'default' : 'pointer',
                }}
              >
                {loading ? <LoadingSpinner size={16} color="white" label="" /> : <FileText size={15} strokeWidth={2.5} />}
                {loading ? 'Submitting...' : 'Submit My Trip'}
              </button>
            )}
          </div>
        </div>

        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '14px', color: '#94A3B8' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: '#F97316', fontWeight: 600, textDecoration: 'none' }}>
            Log in here
          </Link>
        </p>
      </div>
    </Layout>
  )
}
