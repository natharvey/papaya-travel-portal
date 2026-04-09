import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Layout from '../components/Layout'
import LoadingSpinner from '../components/LoadingSpinner'
import PapayaLogo from '../components/PapayaLogo'
import { requestMagicLink, getApiError } from '../api/client'

export default function LoginPage() {
  const [searchParams] = useSearchParams()
  const justSubmitted = searchParams.get('submitted') === '1'
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError('')
    try {
      await requestMagicLink(email.trim())
      setSent(true)
    } catch (err) {
      setError(getApiError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout variant="public">
      <div style={{
        minHeight: 'calc(100vh - 128px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        background: 'var(--color-bg)',
      }}>
        <div style={{
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-xl)',
          padding: '48px 40px',
          width: '100%',
          maxWidth: '420px',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--color-border)',
        }}>
          {justSubmitted && !sent && (
            <div style={{
              background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '10px',
              padding: '14px 16px', marginBottom: '24px', fontSize: '14px', color: '#15803D',
            }}>
              <strong>Enquiry received!</strong> We've emailed you a login link. Enter your email below if you need a new one.
            </div>
          )}

          <div style={{ textAlign: 'center', marginBottom: '36px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
              <PapayaLogo size={110} />
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-text)', marginBottom: '8px', letterSpacing: '-0.3px' }}>
              {sent ? 'Check your inbox' : 'Welcome back'}
            </h1>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '14px', lineHeight: '1.5' }}>
              {sent ? `We've sent a login link to ${email}` : "Enter your email and we'll send you a secure login link"}
            </p>
          </div>

          {sent ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                background: '#F0FDF6',
                border: '1px solid #A7F0C4',
                borderRadius: 'var(--radius-lg)',
                padding: '20px',
                marginBottom: '24px',
              }}>
                <p style={{ margin: '0 0 6px 0', fontWeight: 700, color: '#166534', fontSize: '15px' }}>Login link sent!</p>
                <p style={{ margin: 0, fontSize: '13px', color: '#15803D', lineHeight: '1.5' }}>
                  Click the link in the email to access your portal. It expires in 1 hour.
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setSent(false); setError('') }}
                style={{
                  background: 'none',
                  border: '1.5px solid var(--color-border)',
                  borderRadius: 'var(--radius)',
                  padding: '10px 20px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  color: 'var(--color-text-muted)',
                  fontWeight: 500,
                  fontFamily: 'inherit',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-text-muted)'; e.currentTarget.style.color = 'var(--color-text)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.color = 'var(--color-text-muted)' }}
              >
                Try a different email
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '7px', color: 'var(--color-text)' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="jane@example.com"
                  autoComplete="email"
                  autoFocus
                  required
                  style={{
                    width: '100%',
                    border: '1.5px solid var(--color-border)',
                    borderRadius: 'var(--radius)',
                    padding: '12px 14px',
                    fontSize: '14px',
                    outline: 'none',
                    background: 'var(--color-surface)',
                    color: 'var(--color-text)',
                    fontFamily: 'inherit',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                  onBlur={e => e.currentTarget.style.borderColor = 'var(--color-border)'}
                />
              </div>

              {error && (
                <div style={{
                  background: '#FEF2F2',
                  border: '1px solid #FECACA',
                  borderRadius: 'var(--radius)',
                  padding: '11px 14px',
                  fontSize: '13px',
                  color: '#B91C1C',
                  lineHeight: '1.5',
                }}>
                  {error}
                  {error.toLowerCase().includes('no account') && (
                    <p style={{ margin: '6px 0 0 0' }}>
                      Haven't submitted a trip yet?{' '}
                      <Link to="/intake" style={{ color: '#B91C1C', fontWeight: 700 }}>
                        Submit an enquiry →
                      </Link>
                    </p>
                  )}
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
                  fontFamily: 'inherit',
                  marginTop: '4px',
                }}
                onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'var(--color-primary-dark)' }}
                onMouseLeave={e => { if (!loading) e.currentTarget.style.background = loading ? 'var(--color-border)' : 'var(--color-primary)' }}
              >
                {loading ? <LoadingSpinner size={18} color="white" label="" /> : null}
                {loading ? 'Sending...' : 'Send Login Link'}
              </button>
            </form>
          )}

          <div style={{ textAlign: 'center', marginTop: '28px', paddingTop: '24px', borderTop: '1px solid var(--color-border)' }}>
            <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
              New to Travel Papaya?{' '}
              <Link to="/intake" style={{ color: 'var(--color-primary)', fontWeight: 700, textDecoration: 'none' }}>
                Plan a trip →
              </Link>
            </p>
          </div>
        </div>
      </div>
    </Layout>
  )
}
