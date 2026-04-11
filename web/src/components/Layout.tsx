import { ReactNode } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import PapayaLogo from './PapayaLogo'

interface LayoutProps {
  children: ReactNode
  variant?: 'client' | 'admin' | 'public'
}

export default function Layout({ children, variant = 'public' }: LayoutProps) {
  const { isAuthenticated, userRole, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  function handleLogout() {
    logout()
    navigate(userRole === 'admin' ? '/admin/login' : '/login')
  }

  const isAdmin = variant === 'admin'

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--color-bg)' }}>
      <header style={{
        background: isAdmin ? 'var(--color-secondary)' : 'var(--color-surface)',
        borderBottom: isAdmin ? 'none' : '1px solid var(--color-border)',
        padding: '0 32px',
        height: '64px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: isAdmin ? '0 2px 12px rgba(45,74,90,0.18)' : '0 1px 4px rgba(45,74,90,0.06)',
      }}>
        <Link
          to={isAdmin ? '/admin' : isAuthenticated && userRole === 'client' ? '/portal' : '/intake'}
          style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}
        >
          {isAdmin ? (
            <>
              <PapayaLogo size={72} light />
              <span style={{
                fontSize: '10px',
                fontWeight: 700,
                color: 'var(--color-primary)',
                background: 'rgba(240,115,50,0.15)',
                padding: '2px 8px',
                borderRadius: '100px',
                letterSpacing: '0.8px',
                textTransform: 'uppercase',
              }}>
                Admin
              </span>
            </>
          ) : (
            <PapayaLogo size={72} />
          )}
        </Link>

        <nav style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {variant === 'client' && isAuthenticated && userRole === 'client' && (
            <>
              <Link
                to="/portal"
                style={{
                  color: 'var(--color-text-muted)',
                  fontSize: '14px',
                  fontWeight: 500,
                  textDecoration: 'none',
                  padding: '7px 14px',
                  borderRadius: 'var(--radius)',
                  transition: 'color 0.15s, background 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-text)'; e.currentTarget.style.background = 'var(--color-bg)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-text-muted)'; e.currentTarget.style.background = 'transparent' }}
              >
                My Trips
              </Link>
              <button
                onClick={handleLogout}
                style={{
                  background: 'transparent',
                  border: '1.5px solid var(--color-border)',
                  color: 'var(--color-text-muted)',
                  padding: '7px 16px',
                  borderRadius: 'var(--radius)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-text-muted)'; e.currentTarget.style.color = 'var(--color-text)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.color = 'var(--color-text-muted)' }}
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
                border: '1.5px solid rgba(255,255,255,0.15)',
                color: 'rgba(255,255,255,0.6)',
                padding: '7px 16px',
                borderRadius: 'var(--radius)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.35)'; e.currentTarget.style.color = 'white' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)' }}
            >
              Sign out
            </button>
          )}

          {variant === 'public' && (
            <>
              <Link
                to="/architecture"
                style={{
                  color: 'var(--color-text-muted)',
                  fontSize: '14px',
                  fontWeight: 500,
                  textDecoration: 'none',
                  padding: '7px 14px',
                  borderRadius: 'var(--radius)',
                  transition: 'color 0.15s, background 0.15s',
                  background: location.pathname === '/architecture' ? 'var(--color-bg)' : 'transparent',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-text)'; e.currentTarget.style.background = 'var(--color-bg)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-text-muted)'; e.currentTarget.style.background = location.pathname === '/architecture' ? 'var(--color-bg)' : 'transparent' }}
              >
                Architecture
              </Link>
              <Link
                to="/login"
                style={{
                  color: 'var(--color-text-muted)',
                  fontSize: '14px',
                  fontWeight: 500,
                  textDecoration: 'none',
                  padding: '7px 14px',
                  borderRadius: 'var(--radius)',
                  transition: 'color 0.15s, background 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-text)'; e.currentTarget.style.background = 'var(--color-bg)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-text-muted)'; e.currentTarget.style.background = 'transparent' }}
              >
                Client Login
              </Link>
              <Link
                to="/intake"
                style={{
                  background: 'var(--color-primary)',
                  color: 'white',
                  padding: '8px 18px',
                  borderRadius: 'var(--radius)',
                  fontSize: '14px',
                  fontWeight: 700,
                  textDecoration: 'none',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--color-primary-dark)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--color-primary)'}
              >
                Plan a Trip
              </Link>
            </>
          )}
        </nav>
      </header>

      <main style={{ flex: 1 }}>
        {children}
      </main>

      <footer style={{
        background: 'var(--color-secondary)',
        color: 'rgba(255,255,255,0.45)',
        textAlign: 'center',
        padding: '24px',
        fontSize: '13px',
        fontWeight: 400,
      }}>
        <div>© {new Date().getFullYear()} Travel Papaya · Crafting unforgettable journeys for Australian travellers</div>
        <div style={{ marginTop: 8 }}>
          <Link
            to="/architecture"
            style={{ color: 'rgba(255,255,255,0.3)', textDecoration: 'none', fontSize: '12px', transition: 'color 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.6)'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}
          >
            System Architecture
          </Link>
        </div>
      </footer>
    </div>
  )
}
