import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './shared/context/AuthContext'
import LoginPage from './pages/LoginPage'
import UserDashboard from './pages/user/DashboardPage'
import DriverDashboard from './pages/driver/DashboardPage'
import AdminDashboard from './pages/admin/DashboardPage'
import { TrackingPage } from './features/tracking/TrackingPage'

function ProtectedRoute({ children, role }: { children: React.ReactNode; role?: string }) {
  const { user, isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>Loading...</div>
  }

  if (!isAuthenticated) {
    return <Navigate to="/login/user" replace />
  }

  if (role && user?.role !== role) {
    return <Navigate to={`/login/${role.toLowerCase()}`} replace />
  }

  return <>{children}</>
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login/:role" element={<LoginPage />} />

          {/* Protected */}
          <Route path="/user/dashboard" element={
            <ProtectedRoute role="USER">
              <UserDashboard />
            </ProtectedRoute>
          } />
          <Route path="/driver/dashboard" element={
            <ProtectedRoute role="DRIVER">
              <DriverDashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin/dashboard" element={
            <ProtectedRoute role="ADMIN">
              <AdminDashboard />
            </ProtectedRoute>
          } />

          {/* Order tracking - protected, available to all authenticated users */}
          <Route path="/track/:orderId" element={
            <ProtectedRoute>
              <TrackingPage />
            </ProtectedRoute>
          } />

          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/login/user" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
