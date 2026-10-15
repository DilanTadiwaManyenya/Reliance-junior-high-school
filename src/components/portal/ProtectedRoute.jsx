import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import { portalDestinationForRole } from '../../lib/portalRedirect'

export default function ProtectedRoute({ roles }) {
  const { user, profile, activeRole, loading, profileError, refreshProfile, signOut, supabase } = useAuth()
  const location = useLocation()
  if (!supabase) return <Navigate to="/portal/login" replace state={{ message: 'The Portal is not configured yet.' }} />
  if (loading) return <main className="portal-loading">Loading your portal…</main>
  if (user && !profile) return <main className="portal-loading" role="alert"><h1>We could not load your portal access</h1><p>{profileError?.message?.includes('timed out') ? 'The connection timed out. Please try again.' : 'Please retry. If this continues, contact the school office.'}</p><button className="btn primary" onClick={() => refreshProfile(user)}>Try again</button><button className="btn secondary" onClick={() => signOut().catch(() => {})}>Sign out</button></main>
  if (!user) return <Navigate to="/portal/login" replace />
  if (!portalDestinationForRole(activeRole)) return <Navigate to="/portal/login" replace state={{ message: 'This account no longer has portal access.' }} />
  if (profile?.must_change_password && location.pathname !== '/portal/set-password') return <Navigate to="/portal/set-password" replace />
  if (!profile?.must_change_password && location.pathname === '/portal/set-password') return <Navigate to={portalDestinationForRole(activeRole) ?? '/portal/login'} replace />
  if (roles && !roles.includes(activeRole)) return <Navigate to={portalDestinationForRole(activeRole) ?? '/portal/login'} replace />
  return <Outlet />
}

