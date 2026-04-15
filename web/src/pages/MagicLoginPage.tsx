import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { api, storeToken, getApiError } from '../api/client'
import type { TokenResponse } from '../types'
import PapayaLogo from '../components/PapayaLogo'
import LoadingSpinner from '../components/LoadingSpinner'

export default function MagicLoginPage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) {
      setError('Invalid login link.')
      return
    }
    api.get<TokenResponse>(`/auth/magic/${token}`)
      .then(res => {
        storeToken(res.data.access_token, res.data.role)
        const next = searchParams.get('next') || '/portal'
        navigate(next, { replace: true })
      })
      .catch(e => {
        setError(getApiError(e))
      })
  }, [token, navigate])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--color-bg)',
      padding: '24px',
    }}>
      <div style={{ marginBottom: '36px' }}>
        <PapayaLogo size={110} />
      </div>

      {error ? (
        <div style={{
          textAlign: 'center',
          maxWidth: '400px',
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-xl)',
          padding: '40px',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--color-border)',
        }}>
          <div style={{
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: 'var(--radius-lg)',
            padding: '16px 20px',
            marginBottom: '24px',
            color: '#B91C1C',
            fontSize: '14px',
            lineHeight: '1.6',
          }}>
            {error}
          </div>
          <a
            href="/login"
            style={{
              color: 'var(--color-primary)',
              fontSize: '14px',
              textDecoration: 'none',
              fontWeight: 700,
            }}
          >
            Request a new login link →
          </a>
        </div>
      ) : (
        <div style={{ textAlign: 'center' }}>
          <LoadingSpinner label="Logging you in..." />
        </div>
      )}
    </div>
  )
}
