import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import PasswordInput from '../../components/ui/PasswordInput'
import PortalNotice from '../../components/portal/PortalNotice'
import { invokeEdgeFunction } from '../../lib/edgeFunction'
import { resolvePortalDestination } from '../../lib/portalRedirect'

export default function SetNewPassword() {
  const { user, profile, supabase, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async event => {
    event.preventDefault()
    setError('')
    if (password.length < 8) return setError('Choose a password of at least 8 characters.')
    if (password !== confirmPassword) return setError('Passwords do not match.')

    setSaving(true)
    const { error: passwordError } = await supabase.auth.updateUser({ password })
    if (passwordError) {
      setSaving(false)
      return setError(passwordError.message || 'We could not update your password.')
    }

    const { data, error: completionError } = await invokeEdgeFunction(supabase, 'complete_password_change', {})
    if (completionError || data?.success === false || data?.error) {
      setSaving(false)
      return setError(data?.error || completionError?.message || 'Your password was updated, but we could not complete setup. Please contact the school office.')
    }

    const updatedProfile = await refreshProfile(user)
    const { destination, error: destinationError } = await resolvePortalDestination(supabase, user.id)
    setSaving(false)
    if (!updatedProfile || destinationError || !destination) return setError('Your password was updated, but we could not open your portal. Please sign in again.')
    navigate(destination, { replace: true })
  }

  if (!user || !profile?.must_change_password) return null
  return <main className="portal-auth"><section className="portal-auth-card portal-auth-animated"><p className="eyebrow">Password update required</p><h1>Set a new password</h1><p className="muted">Your password was set by an administrator. Please choose a new password to continue.</p>{error && <PortalNotice tone="error">{error}</PortalNotice>}<form className="form" onSubmit={submit}><PasswordInput id="required-new-password" label="New password" value={password} onChange={event => setPassword(event.target.value)} minLength={8} autoComplete="new-password" required /><PasswordInput id="required-confirm-password" label="Confirm password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} minLength={8} autoComplete="new-password" required /><button className="btn primary" disabled={saving}>{saving ? 'Saving…' : 'Save and continue'}</button></form></section></main>
}
