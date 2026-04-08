import { useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import LoadingSpinner from '../components/LoadingSpinner'
import PapayaLogo from '../components/PapayaLogo'
import { requestMagicLink, getApiError } from '../api/client'

export default function LoginPage() {
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
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
              <PapayaLogo size={56} />
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '6px' }}>Client Portal</h1>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>
              {sent ? 'Check your inbox' : 'Enter your email and we\'ll send you a login link'}
            </p>
          </div>

          {sent ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                background: '#F0FDF4',
                border: '1px solid #BBF7D0',
                borderRadius: 'var(--radius)',
                padding: '20px',
                marginBottom: '24px',
              }}>
                <p style={{ margin: '0 0 8px 0', fontWeight: 600, color: '#15803D' }}>Login link sent!</p>
                <p style={{ margin: 0, fontSize: '14px', color: '#166534' }}>
                  We've sent a login link to <strong>{email}</strong>. Click the link in the email to access your portal.
                </p>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
                The link expires in 1 hour. Didn't get it?
              </p>
              <button
                type="button"
                onClick={() => { setSent(false); setError('') }}
                style={{
                  background: 'none',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius)',
                  padding: '10px 20px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  color: 'var(--color-text)',
                }}
              >
                Try a different email
              </button>
            </div>
          ) : (
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
                  autoFocus
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
                  {error.toLowerCase().includes('no account') && (
                    <p style={{ margin: '6px 0 0 0', fontSize: '13px' }}>
                      Haven't submitted a trip yet?{' '}
                      <Link to="/intake" style={{ color: '#B91C1C', fontWeight: 600 }}>
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
                }}
              >
                {loading ? <LoadingSpinner size={18} color="white" label="" /> : null}
                {loading ? 'Sending...' : 'Send Login Link'}
              </button>
            </form>
          )}

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
