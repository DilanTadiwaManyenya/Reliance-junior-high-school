import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { fetchPortalProfile } from '../lib/portalProfile'
import { AuthContext } from './authContext'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [profileError, setProfileError] = useState(null)
  const [loading, setLoading] = useState(Boolean(supabase))
  const profileRequest = useRef(0)

  const loadProfile = useCallback(async user => {
    const requestId = ++profileRequest.current
    setProfileError(null)
    if (!supabase || !user) {
      setProfile(null)
      setLoading(false)
      return null
    }
    setLoading(true)
    const result = await fetchPortalProfile(supabase, user.id)
    if (requestId === profileRequest.current) {
      setProfile(result.profile)
      setProfileError(result.error)
      setLoading(false)
    }
    return result.profile
  }, [])

  useEffect(() => {
    if (!supabase) return undefined
    let disposed = false
    let authRevision = 0
    let profileTimer
    const initialise = async () => {
      const revision = authRevision
      try {
        const { data, error } = await supabase.auth.getSession()
        if (disposed || revision !== authRevision) return
        if (error) throw error
        setSession(data.session)
        await loadProfile(data.session?.user)
      } catch (error) {
        if (!disposed && revision === authRevision) {
          setProfileError(error)
          setLoading(false)
        }
      }
    }
    initialise()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      authRevision += 1
      profileRequest.current += 1
      setSession(nextSession)
      setProfile(null)
      setProfileError(null)
      setLoading(Boolean(nextSession))
      clearTimeout(profileTimer)
      // Start database work after the auth callback releases its session lock.
      profileTimer = setTimeout(() => {
        if (!disposed) loadProfile(nextSession?.user)
      }, 0)
    })
    return () => {
      disposed = true
      profileRequest.current += 1
      clearTimeout(profileTimer)
      subscription.unsubscribe()
    }
  }, [loadProfile])

  const signOut = async () => {
    if (!supabase) return
    profileRequest.current += 1
    const result = await supabase.auth.signOut()
    if (result.error) throw result.error
    setSession(null); setProfile(null); setProfileError(null); setLoading(false)
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

  return <AuthContext.Provider value={{ session, user: session?.user ?? null, profile, profileError, roles, activeRole, setActiveRole, refreshProfile: loadProfile, loading, signOut, supabase }}>{children}</AuthContext.Provider>
}
