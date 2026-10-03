import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import { portalDestinationForRole } from '../../lib/portalRedirect'

export default function ProtectedRoute({ roles }) {
  const { user, profile, activeRole, loading, supabase } = useAuth()
  const location = useLocation()
  if (!supabase) return <Navigate to="/portal/login" replace state={{ message: 'The Portal is not configured yet.' }} />
  if (loading || (user && !profile)) return <main className="portal-loading">Loading your portal…</main>
  if (!user) return <Navigate to="/portal/login" replace />
  if (!portalDestinationForRole(activeRole)) return <Navigate to="/portal/login" replace state={{ message: 'This account no longer has portal access.' }} />
  if (profile?.must_change_password && location.pathname !== '/portal/set-password') return <Navigate to="/portal/set-password" replace />
  if (!profile?.must_change_password && location.pathname === '/portal/set-password') return <Navigate to={portalDestinationForRole(activeRole) ?? '/portal/login'} replace />
  if (roles && !roles.includes(activeRole)) return <Navigate to={portalDestinationForRole(activeRole) ?? '/portal/login'} replace />
  return <Outlet />
}
