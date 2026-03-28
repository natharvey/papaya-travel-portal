import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, storeToken, getApiError } from '../api/client'
import type { TokenResponse } from '../types'
import PapayaLogo from '../components/PapayaLogo'
import LoadingSpinner from '../components/LoadingSpinner'

export default function MagicLoginPage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) {
      setError('Invalid login link.')
      return
    }
    api.get<TokenResponse>(`/auth/magic/${token}`)
      .then(res => {
        storeToken(res.data.access_token, res.data.role)
        navigate('/portal', { replace: true })
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
      <div style={{ marginBottom: '32px' }}>
        <PapayaLogo size={56} />
      </div>

      {error ? (
        <div style={{ textAlign: 'center', maxWidth: '400px' }}>
          <div style={{
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: 'var(--radius)',
            padding: '20px',
            marginBottom: '20px',
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
              fontWeight: 600,
            }}
          >
            Log in with your reference code instead →
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
