import { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

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
        padding: '0 24px',
        height: '64px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: 'var(--shadow-md)',
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
          <div style={{
            width: '36px',
            height: '36px',
            background: 'var(--color-primary)',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
          }}>
            🌴
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '18px', letterSpacing: '-0.3px' }}>Papaya</div>
            <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '-2px' }}>
              {variant === 'admin' ? 'Admin Dashboard' : 'Travel Portal'}
            </div>
          </div>
        </Link>

        <nav style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {variant === 'client' && isAuthenticated && userRole === 'client' && (
            <>
              <Link to="/portal" style={{ color: '#CBD5E1', fontSize: '14px', textDecoration: 'none' }}>
                My Trips
              </Link>
              <button
                onClick={handleLogout}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: 'white',
                  padding: '6px 16px',
                  borderRadius: 'var(--radius)',
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                Sign out
              </button>
            </>
          )}

          {variant === 'admin' && isAuthenticated && userRole === 'admin' && (
            <>
              <span style={{ color: '#94A3B8', fontSize: '13px' }}>Admin</span>
              <button
                onClick={handleLogout}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: 'white',
                  padding: '6px 16px',
                  borderRadius: 'var(--radius)',
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                Sign out
              </button>
            </>
          )}

          {variant === 'public' && (
            <>
              <Link to="/login" style={{ color: '#CBD5E1', fontSize: '14px', textDecoration: 'none' }}>
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
