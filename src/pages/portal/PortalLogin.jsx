import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import PortalNotice from '../../components/portal/PortalNotice'
import PhoneInput from '../../components/ui/PhoneInput'
import PasswordInput from '../../components/ui/PasswordInput'
import { buildPortalEmail, isInternationalPhone, normalizePhone } from '../../../shared/portalAuth'
import { resolvePortalDestination } from '../../lib/portalRedirect'

export default function PortalLogin({ student = false, staff = false }) {
  const { supabase } = useAuth(); const navigate = useNavigate(); const [phone, setPhone] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [submitting, setSubmitting] = useState(false)
  const submit = async (event) => {
    event.preventDefault(); setError(''); const normalized = normalizePhone(phone)
    if (!isInternationalPhone(normalized)) return setError('Phone number or password is incorrect.')
    setSubmitting(true)
    const email = buildPortalEmail(normalized)
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) { setSubmitting(false); return setError('Phone number or password is incorrect.') }
    const { destination, error: profileError } = await resolvePortalDestination(supabase, data.user.id)
    if (profileError || !destination) { await supabase.auth.signOut(); setSubmitting(false); return setError(profileError ? 'We could not load your portal access. Please contact the school office.' : 'This account does not have a recognised portal role.') }
    navigate(destination, { replace: true })
  }
  return <main className="portal-auth"><section className="portal-auth-card"><p className="eyebrow">{student ? 'Student' : staff ? 'Staff' : 'Portal'} sign in</p><h1>Welcome back</h1>{error && <PortalNotice tone="error">{error}</PortalNotice>}<form className="form" onSubmit={submit}><PhoneInput value={phone} onChange={setPhone} required /><PasswordInput id="login-password" label="Password" value={password} onChange={event => setPassword(event.target.value)} minLength={0} required /><button className="btn primary" disabled={submitting}>{submitting ? 'Signing in…' : 'Sign in'}</button></form>{!staff && <p>New {student ? 'student' : 'parent'}? <Link to={student ? '/portal/student-signup' : '/portal/signup'}>Create your account</Link></p>}</section></main>
}
