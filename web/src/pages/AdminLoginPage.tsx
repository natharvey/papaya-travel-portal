import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import LoadingSpinner from '../components/LoadingSpinner'
import { adminLogin, getApiError } from '../api/client'
import { useAuth } from '../hooks/useAuth'

export default function AdminLoginPage() {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!password.trim()) {
      setError('Please enter the admin password.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await adminLogin(password)
      login(res.access_token, res.role)
      navigate('/admin')
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
        background: 'var(--color-secondary)',
      }}>
        <div style={{
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-xl)',
          padding: '48px 40px',
          width: '100%',
          maxWidth: '400px',
          boxShadow: '0 16px 48px rgba(0,0,0,0.25)',
        }}>
          <div style={{ textAlign: 'center', marginBottom: '36px' }}>
            <div style={{
              width: '56px',
              height: '56px',
              background: 'var(--color-secondary)',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
            }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                <circle cx="12" cy="16" r="1.5" fill="white" stroke="none" />
              </svg>
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '7px', color: 'var(--color-text)', letterSpacing: '-0.2px' }}>
              Admin Access
            </h1>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>
              Travel Papaya — Staff Only
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '7px', color: 'var(--color-text)' }}>
                Admin Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter admin password"
                autoFocus
                required
                style={{
                  width: '100%',
                  border: '1.5px solid var(--color-border)',
                  borderRadius: 'var(--radius)',
                  padding: '12px 14px',
                  fontSize: '14px',
                  outline: 'none',
                  fontFamily: 'inherit',
                  color: 'var(--color-text)',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => e.currentTarget.style.borderColor = 'var(--color-secondary)'}
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
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                background: loading ? 'var(--color-border)' : 'var(--color-secondary)',
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
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#1E3444' }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.background = 'var(--color-secondary)' }}
            >
              {loading ? <LoadingSpinner size={18} color="white" label="" /> : null}
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  )
}
