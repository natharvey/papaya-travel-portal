import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import Layout from '../components/Layout'
import LoadingSpinner from '../components/LoadingSpinner'
import { clientLogin, resendReferenceCode, getApiError } from '../api/client'
import { useAuth } from '../hooks/useAuth'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [refCode, setRefCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showResend, setShowResend] = useState(false)
  const [resendEmail, setResendEmail] = useState('')
  const [resendLoading, setResendLoading] = useState(false)
  const [resendMessage, setResendMessage] = useState('')
  const [resendFound, setResendFound] = useState<boolean | null>(null)
  const { login } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !refCode.trim()) {
      setError('Please enter both your email and reference code.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await clientLogin(email.trim(), refCode.trim().toUpperCase())
      login(res.access_token, res.role)
      navigate('/portal')
    } catch (err) {
      setError(getApiError(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleResend(e: React.FormEvent) {
    e.preventDefault()
    if (!resendEmail.trim()) return
    setResendLoading(true)
    setResendMessage('')
    setResendFound(null)
    try {
      const res = await resendReferenceCode(resendEmail.trim())
      setResendMessage(res.message)
      setResendFound(true)
    } catch (err) {
      setResendMessage(getApiError(err))
      setResendFound(false)
    } finally {
      setResendLoading(false)
    }
  }

  return (
    <Layout variant="public">
      <div style={{
        minHeight: 'calc(100vh - 128px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        background: 'linear-gradient(135deg, var(--color-accent) 0%, var(--color-bg) 100%)',
      }}>
        <div style={{
          background: 'white',
          borderRadius: 'var(--radius-lg)',
          padding: '40px',
          width: '100%',
          maxWidth: '420px',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--color-border)',
        }}>
          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{
              width: '56px',
              height: '56px',
              background: 'var(--color-primary)',
              borderRadius: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              margin: '0 auto 16px',
            }}>
              🌴
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '6px' }}>Client Portal Login</h1>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>
              Sign in with your email and reference code
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="jane@example.com"
                autoComplete="email"
                required
                style={{
                  width: '100%',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius)',
                  padding: '12px 14px',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>
                Reference Code
              </label>
              <input
                type="text"
                value={refCode}
                onChange={e => setRefCode(e.target.value.toUpperCase())}
                placeholder="e.g. ABC12345"
                maxLength={12}
                required
                style={{
                  width: '100%',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius)',
                  padding: '12px 14px',
                  fontSize: '18px',
                  fontWeight: 700,
                  letterSpacing: '3px',
                  outline: 'none',
                  textTransform: 'uppercase',
                  fontFamily: 'monospace',
                }}
              />
              <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                You received this code when you submitted your trip.
              </p>
            </div>

            {error && (
              <div style={{
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: 'var(--radius)',
                padding: '10px 14px',
                fontSize: '14px',
                color: '#B91C1C',
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                background: loading ? 'var(--color-border)' : 'var(--color-primary)',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius)',
                padding: '14px',
                fontSize: '15px',
                fontWeight: 700,
                cursor: loading ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              {loading ? <LoadingSpinner size={18} color="white" label="" /> : null}
              {loading ? 'Signing in...' : 'Sign In to Portal'}
            </button>
          </form>

          <div style={{ marginTop: '16px', textAlign: 'center' }}>
            <button
              type="button"
              onClick={() => { setShowResend(!showResend); setResendMessage('') }}
              style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: '13px', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Forgot your reference code?
            </button>

            {showResend && (
              <form onSubmit={handleResend} style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'left' }}>
                <input
                  type="email"
                  value={resendEmail}
                  onChange={e => setResendEmail(e.target.value)}
                  placeholder="Enter your email address"
                  required
                  style={{
                    width: '100%',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius)',
                    padding: '10px 14px',
                    fontSize: '14px',
                    outline: 'none',
                  }}
                />
                <button
                  type="submit"
                  disabled={resendLoading}
                  style={{
                    background: resendLoading ? 'var(--color-border)' : 'var(--color-secondary)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 'var(--radius)',
                    padding: '10px',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: resendLoading ? 'default' : 'pointer',
                  }}
                >
                  {resendLoading ? 'Sending...' : 'Resend my reference code'}
                </button>
                {resendMessage && (
                  <div style={{
                    background: resendFound ? '#F0FDF4' : '#FEF2F2',
                    border: `1px solid ${resendFound ? '#BBF7D0' : '#FECACA'}`,
                    borderRadius: 'var(--radius)',
                    padding: '10px 14px',
                    fontSize: '13px',
                    color: resendFound ? '#15803D' : '#B91C1C',
                  }}>
                    <p style={{ margin: '0 0 4px 0' }}>{resendMessage}</p>
                    {!resendFound && (
                      <p style={{ margin: 0 }}>
                        Haven't submitted a trip yet?{' '}
                        <Link to="/intake" style={{ color: '#B91C1C', fontWeight: 600 }}>
                          Submit an enquiry →
                        </Link>
                      </p>
                    )}
                  </div>
                )}
              </form>
            )}
          </div>

          <div style={{ textAlign: 'center', marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--color-border)' }}>
            <p style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>
              Don't have a trip yet?{' '}
              <Link to="/intake" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
                Submit an enquiry →
              </Link>
            </p>
          </div>
        </div>
      </div>
    </Layout>
  )
}
