import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import { logActivity } from '../../lib/logActivity'

export default function ActivityLogger() {
  const location = useLocation()
  const { supabase, user, profile } = useAuth()
  useEffect(() => {
    if (!user || !profile) return
    logActivity(supabase, user, profile, { actionType: 'page_view', description: `Viewed ${location.pathname}`, metadata: { path: location.pathname } })
  }, [location.pathname, profile, supabase, user])
  return null
}
