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

export default function PortalLogin({ staff = false }) {
  const { supabase, refreshProfile } = useAuth(); const navigate = useNavigate(); const [identifier, setIdentifier] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [submitting, setSubmitting] = useState(false)
  const submit = async (event) => {
    event.preventDefault(); setError(''); const normalized = normalizePhone(identifier)
    if (!isInternationalPhone(normalized)) return setError('Phone number or password is incorrect.')
    setSubmitting(true)
    const email = buildPortalEmail(normalized)
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) { setSubmitting(false); return setError('Phone number or password is incorrect.') }
    const resolvedProfile = await refreshProfile(data.user)
    const { destination, error: profileError } = await resolvePortalDestination(supabase, data.user.id)
    if (!resolvedProfile) { await supabase.auth.signOut(); setSubmitting(false); return setError('We could not load your portal access. Please contact the school office.') }
    if (profileError || !destination) { await supabase.auth.signOut(); setSubmitting(false); return setError(profileError ? 'We could not load your portal access. Please contact the school office.' : 'This account does not have a recognised portal role.') }
    logActivity(supabase, data.user, resolvedProfile, { actionType: 'login', description: 'Signed in to the portal' })
    navigate(destination, { replace: true })
  }
  return <main className="portal-auth"><section className="portal-auth-card"><PortalSiteExitLink className="portal-website-button">← Back to website</PortalSiteExitLink><p className="eyebrow">{staff ? 'Staff' : 'Parent'} sign in</p><h1>Welcome back</h1>{error && <PortalNotice tone="error">{error}</PortalNotice>}<form className="form" onSubmit={submit}><PhoneInput value={identifier} onChange={setIdentifier} required /><PasswordInput id="login-password" label="Password" value={password} onChange={event => setPassword(event.target.value)} minLength={0} required /><button className="btn primary" disabled={submitting}>{submitting ? 'Signing in…' : 'Sign in'}</button></form>{!staff && <p>New parent? <Link to="/portal/signup">Create your account</Link></p>}</section></main>
}
