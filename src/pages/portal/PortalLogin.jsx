import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import PortalNotice from '../../components/portal/PortalNotice'
import PhoneInput from '../../components/ui/PhoneInput'
import PasswordInput from '../../components/ui/PasswordInput'
import { buildPortalEmail, isInternationalPhone, normalizePhone } from '../../../shared/portalAuth'
import { resolvePortalDestination } from '../../lib/portalRedirect'
import PortalSiteExitLink from '../../components/portal/PortalSiteExitLink'
import { logActivity } from '../../lib/logActivity'

const connectionError = error => !navigator.onLine || error?.status === 0 || /failed to fetch|network|network request failed|timeout|fetch failed/i.test(String(error?.message ?? error ?? ''))

export default function PortalLogin({ staff = false }) {
  const { supabase } = useAuth(); const navigate = useNavigate(); const [identifier, setIdentifier] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [submitting, setSubmitting] = useState(false)
  const submit = async (event) => {
    event.preventDefault(); setError(''); const normalized = normalizePhone(identifier)
    if (!navigator.onLine) return setError('You appear to be offline. Check your internet connection and try again.')
    if (!isInternationalPhone(normalized)) return setError('Enter a valid international phone number, including the country code.')
    setSubmitting(true)
    try {
    const email = buildPortalEmail(normalized)
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) { setSubmitting(false); return setError(connectionError(authError) ? 'We could not connect to the portal. Check your internet connection and try again.' : 'Phone number or password is incorrect.') }
    // AuthProvider loads the full profile once from the auth event. Login only
    // needs this small role query to route; starting a second full profile load
    // here made sign-in slower on mobile connections.
    const { destination, error: profileError, profile } = await resolvePortalDestination(supabase, data.user.id)
    if (profileError || !destination) { await supabase.auth.signOut(); setSubmitting(false); return setError(connectionError(profileError) ? 'We could not connect to the portal. Check your internet connection and try again.' : profileError ? 'We could not load your portal access. Please contact the school office.' : 'This account does not have a recognised portal role.') }
    logActivity(supabase, data.user, profile, { actionType: 'login', description: 'Signed in to the portal' })
    navigate(destination, { replace: true })
    } catch (requestError) {
      setError(connectionError(requestError) ? 'We could not connect to the portal. Check your internet connection and try again.' : 'We could not load your portal access. Please try again.')
    } finally { setSubmitting(false) }
  }
  return <main className="portal-auth"><section className="portal-auth-card"><PortalSiteExitLink className="portal-website-button">← Back to website</PortalSiteExitLink><p className="eyebrow">{staff ? 'Staff' : 'Parent'} sign in</p><h1>Welcome back</h1>{error && <PortalNotice tone="error">{error}</PortalNotice>}<form className="form" onSubmit={submit}><PhoneInput value={identifier} onChange={setIdentifier} required /><PasswordInput id="login-password" autoComplete="current-password" label="Password" value={password} onChange={event => setPassword(event.target.value)} minLength={0} required /><button className="btn primary" disabled={submitting}>{submitting ? 'Signing in…' : 'Sign in'}</button></form><p><Link to="/portal/forgot-password" state={{ staff }}>Forgot your password?</Link></p>{!staff && <p>New parent? <Link to="/portal/signup">Create your account</Link></p>}</section></main>
}

