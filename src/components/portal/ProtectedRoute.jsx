import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'

export default function ProtectedRoute({ roles }) {
  const { user, profile, loading, supabase } = useAuth()
  const location = useLocation()

  if (!supabase) return <Navigate to="/portal/login" replace state={{ message: 'The Portal is not configured yet.' }} />
  if (loading) return <main className="portal-loading">Loading your portal…</main>
  if (!user) return <Navigate to="/portal/login" replace />

  if (profile?.role === 'teacher' && profile?.must_update_credentials && location.pathname !== '/portal/first-login') {
    return <Navigate to="/portal/first-login" replace />
  }

  if (roles && (!profile || !roles.includes(profile.role))) return <Navigate to="/portal/dashboard" replace />
  return <Outlet />
}
