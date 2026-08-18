import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { AuthContext } from './authContext'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(Boolean(supabase))

  const loadProfile = async (user) => {
    if (!supabase || !user) { setProfile(null); return }
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setProfile(data ?? null)
  }

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
  }, [])

  const signOut = async () => {
    if (!supabase) return
    const result = await supabase.auth.signOut()
    if (result.error) throw result.error
    // The auth listener also receives SIGNED_OUT. Clearing this immediately
    // prevents a protected route from rendering stale user/profile state.
    setSession(null)
    setProfile(null)
    return result
  }

  return <AuthContext.Provider value={{ session, user: session?.user ?? null, profile, loading, signOut, supabase }}>{children}</AuthContext.Provider>
}
