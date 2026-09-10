import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import { portalDestinationForRole } from '../../lib/portalRedirect'

export default function ProtectedRoute({ roles }) {
  const { user, profile, activeRole, loading, supabase } = useAuth()
  const location = useLocation()
  if (!supabase) return <Navigate to="/portal/login" replace state={{ message: 'The Portal is not configured yet.' }} />
  if (loading || (user && !profile)) return <main className="portal-loading">Loading your portal…</main>
  if (!user) return <Navigate to="/portal/login" replace />
  if (activeRole === 'teacher' && profile?.must_update_credentials && location.pathname !== '/portal/first-login') return <Navigate to="/portal/first-login" replace />
  if (roles && !roles.includes(activeRole)) return <Navigate to={portalDestinationForRole(activeRole) ?? '/portal/login'} replace />
  return <Outlet />
}