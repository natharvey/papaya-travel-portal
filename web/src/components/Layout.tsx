import { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import PapayaLogo from './PapayaLogo'

interface LayoutProps {
  children: ReactNode
  variant?: 'client' | 'admin' | 'public'
}

export default function Layout({ children, variant = 'public' }: LayoutProps) {
  const { isAuthenticated, userRole, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate(userRole === 'admin' ? '/admin/login' : '/login')
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{
        background: 'var(--color-secondary)',
        color: 'white',
        padding: '0 32px',
        height: '56px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <Link
          to={variant === 'admin' ? '/admin' : isAuthenticated && userRole === 'client' ? '/portal' : '/intake'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            color: 'white',
            textDecoration: 'none',
          }}
        >
          <PapayaLogo size={32} />
          <span style={{ fontWeight: 700, fontSize: '17px', letterSpacing: '-0.3px' }}>Papaya</span>
          {variant === 'admin' && (
            <span style={{
              fontSize: '11px',
              fontWeight: 600,
              color: '#F97316',
              background: 'rgba(249,115,22,0.12)',
              padding: '2px 8px',
              borderRadius: '100px',
              letterSpacing: '0.4px',
              textTransform: 'uppercase',
            }}>
              Admin
            </span>
          )}
        </Link>

        <nav style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {variant === 'client' && isAuthenticated && userRole === 'client' && (
            <>
              <Link
                to="/portal"
                style={{
                  color: '#94A3B8',
                  fontSize: '14px',
                  fontWeight: 500,
                  textDecoration: 'none',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius)',
                  transition: 'color 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = 'white')}
                onMouseLeave={e => (e.currentTarget.style.color = '#94A3B8')}
              >
                My Trips
              </Link>
              <button
                onClick={handleLogout}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: '#94A3B8',
                  padding: '6px 14px',
                  borderRadius: 'var(--radius)',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.35)'
                  e.currentTarget.style.color = 'white'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'
                  e.currentTarget.style.color = '#94A3B8'
                }}
              >
                Sign out
              </button>
            </>
          )}

          {variant === 'admin' && isAuthenticated && (
            <button
              onClick={handleLogout}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#94A3B8',
                padding: '6px 14px',
                borderRadius: 'var(--radius)',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.35)'
                e.currentTarget.style.color = 'white'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'
                e.currentTarget.style.color = '#94A3B8'
              }}
            >
              Sign out
            </button>
          )}

          {variant === 'public' && (
            <>
              <Link
                to="/login"
                style={{
                  color: '#94A3B8',
                  fontSize: '14px',
                  fontWeight: 500,
                  textDecoration: 'none',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius)',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = 'white')}
                onMouseLeave={e => (e.currentTarget.style.color = '#94A3B8')}
              >
                Client Login
              </Link>
              <Link
                to="/intake"
                style={{
                  background: 'var(--color-primary)',
                  color: 'white',
                  padding: '7px 16px',
                  borderRadius: 'var(--radius)',
                  fontSize: '14px',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                Plan a Trip
              </Link>
            </>
          )}
        </nav>
      </header>

      <main style={{ flex: 1, padding: '0' }}>
        {children}
      </main>

      <footer style={{
        background: 'var(--color-secondary)',
        color: '#94A3B8',
        textAlign: 'center',
        padding: '20px',
        fontSize: '13px',
      }}>
        © {new Date().getFullYear()} Papaya Travel Portal · Built with care for Australian travellers
      </footer>
    </div>
  )
}
