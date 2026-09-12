import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { AuthContext } from './authContext'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(Boolean(supabase))
  const profileRequest = useRef(0)

  const loadProfile = useCallback(async user => {
    const requestId = ++profileRequest.current
    if (!supabase || !user) { setProfile(null); return null }
    const { data } = await supabase.from('profiles').select('*, user_roles(role), teacher_class_assignments(class_level, class_stream)').eq('id', user.id).single()
    if (requestId === profileRequest.current) setProfile(data ?? null)
    return data ?? null
  }, [])

  useEffect(() => {
    if (!supabase) return undefined
    const initialise = async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      setSession(currentSession)
      await loadProfile(currentSession?.user)
      setLoading(false)
    }
    initialise()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      loadProfile(nextSession?.user)
    })
    return () => subscription.unsubscribe()
  }, [loadProfile])

  const signOut = async () => {
    if (!supabase) return
    profileRequest.current += 1
    const result = await supabase.auth.signOut()
    if (result.error) throw result.error
    setSession(null); setProfile(null)
    return result
  }

  const roles = profile?.user_roles?.map(({ role }) => role) ?? (profile?.role ? [profile.role] : [])
  const activeRole = profile?.active_role ?? profile?.role ?? null
  const setActiveRole = async role => {
    if (!roles.includes(role)) throw new Error('That role is not assigned to this account.')
    const { error } = await supabase.rpc('set_active_role', { requested_role: role })
    if (error) throw error
    sessionStorage.setItem('reliance-active-role', role)
    setProfile(current => ({ ...current, active_role: role }))
  }

  return <AuthContext.Provider value={{ session, user: session?.user ?? null, profile, roles, activeRole, setActiveRole, refreshProfile: loadProfile, loading, signOut, supabase }}>{children}</AuthContext.Provider>
}