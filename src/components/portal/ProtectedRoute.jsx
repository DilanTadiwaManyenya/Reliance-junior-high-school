import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'

export default function ProtectedRoute({ roles }) {
  const { user, profile, loading, supabase } = useAuth()
  if (!supabase) return <Navigate to="/portal/login" replace state={{ message: 'The Parent Portal is not configured yet.' }} />
  if (loading) return <main className="portal-loading">Loading your portal…</main>
  if (!user) return <Navigate to="/portal/login" replace />
  if (roles && (!profile || !roles.includes(profile.role))) return <Navigate to="/portal/dashboard" replace />
  return <Outlet />
}
