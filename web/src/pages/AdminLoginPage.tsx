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
        padding: '40px 24px',
        background: 'var(--color-secondary)',
      }}>
        <div style={{
          background: 'white',
          borderRadius: 'var(--radius-lg)',
          padding: '40px',
          width: '100%',
          maxWidth: '400px',
          boxShadow: 'var(--shadow-lg)',
        }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{
              width: '56px',
              height: '56px',
              background: 'var(--color-secondary)',
              borderRadius: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2C9.24 2 7 4.24 7 7v4H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-2V7c0-2.76-2.24-5-5-5z" />
                <path d="M9 7c0-1.66 1.34-3 3-3s3 1.34 3 3v4H9V7z" />
                <circle cx="12" cy="16" r="1.5" />
              </svg>
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '6px' }}>Admin Access</h1>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>
              Papaya Travel Portal — Staff Only
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>
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
              }}
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
