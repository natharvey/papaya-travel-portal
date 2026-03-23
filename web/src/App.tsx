import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import IntakePage from './pages/IntakePage'
import LoginPage from './pages/LoginPage'
import PortalPage from './pages/PortalPage'
import TripDetailPage from './pages/TripDetailPage'
import AdminLoginPage from './pages/AdminLoginPage'
import AdminDashboardPage from './pages/AdminDashboardPage'
import AdminTripPage from './pages/AdminTripPage'
import { useAuth } from './hooks/useAuth'

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
      <Routes>
        {/* Public */}
        <Route path="/" element={<Navigate to="/intake" replace />} />
        <Route path="/intake" element={<IntakePage />} />
        <Route path="/login" element={<LoginPage />} />

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
          path="/portal/trips/:tripId"
          element={
            <ProtectedRoute role="client">
              <TripDetailPage />
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
        <Route path="*" element={<Navigate to="/intake" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
