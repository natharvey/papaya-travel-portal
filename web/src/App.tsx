import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import LoadingSpinner from './components/LoadingSpinner'
import ErrorBoundary from './components/ErrorBoundary'

const IntakePage = lazy(() => import('./pages/IntakePage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const PortalPage = lazy(() => import('./pages/PortalPage'))
const TripDetailPage = lazy(() => import('./pages/TripDetailPage'))
const AdminLoginPage = lazy(() => import('./pages/AdminLoginPage'))
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage'))
const AdminTripPage = lazy(() => import('./pages/AdminTripPage'))
const MagicLoginPage = lazy(() => import('./pages/MagicLoginPage'))
const NewTripPage = lazy(() => import('./pages/NewTripPage'))
const LandingPage = lazy(() => import('./pages/LandingPage'))
const ArchitecturePage = lazy(() => import('./pages/ArchitecturePage'))

function PageLoader() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <LoadingSpinner label="" />
    </div>
  )
}

function ProtectedRoute({ children, role }: { children: React.ReactNode; role: 'client' | 'admin' }) {
  const { token, userRole } = useAuth()
  if (!token || userRole !== role) {
    return <Navigate to={role === 'admin' ? '/admin/login' : '/login'} replace />
  }
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/intake" element={<IntakePage />} />
          <Route path="/architecture" element={<ArchitecturePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/magic/:token" element={<MagicLoginPage />} />

          {/* Client portal */}
          <Route
            path="/portal"
            element={
              <ProtectedRoute role="client">
                <PortalPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/portal/new-trip"
            element={
              <ProtectedRoute role="client">
                <NewTripPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/portal/trips/:tripId"
            element={
              <ProtectedRoute role="client">
                <ErrorBoundary>
                  <TripDetailPage />
                </ErrorBoundary>
              </ProtectedRoute>
            }
          />

          {/* trip alias used by auto-login redirect */}
          <Route
            path="/trip/:tripId"
            element={
              <ProtectedRoute role="client">
                <ErrorBoundary>
                  <TripDetailPage />
                </ErrorBoundary>
              </ProtectedRoute>
            }
          />

          {/* Admin */}
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute role="admin">
                <AdminDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/trips/:tripId"
            element={
              <ProtectedRoute role="admin">
                <AdminTripPage />
              </ProtectedRoute>
            }
          />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
