import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import PortalNotice from '../../components/portal/PortalNotice'
import PhoneInput from '../../components/ui/PhoneInput'
import PasswordInput from '../../components/ui/PasswordInput'
import PortalSiteExitLink from '../../components/portal/PortalSiteExitLink'
import logo from '../../assets/images/reliance-logo.jpg'
import { isInternationalPhone, normalizePhone } from '../../../shared/portalAuth'
import { invokeEdgeFunction } from '../../lib/edgeFunction'

export default function PortalSignup() {
  const { supabase } = useAuth()
  const [form, setForm] = useState({ fullName: '', phone: '', password: '', confirmPassword: '', admissionNumber: '', dateOfBirth: '' })
  const [error, setError] = useState('')
  const [complete, setComplete] = useState(false)
  const [matchedStudent, setMatchedStudent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const update = (field) => (event) => setForm(current => ({ ...current, [field]: event.target.value }))
  const handleSubmit = async (event) => {
    event.preventDefault(); setError(''); setSubmitting(true)
    if (!supabase) { setError('The Portal has not been configured yet.'); setSubmitting(false); return }
    const phone = normalizePhone(form.phone)
    if (!isInternationalPhone(phone)) { setError('Enter an international phone number with a country code, for example +263 77 123 4567 or +44 7911 123456.'); setSubmitting(false); return }
    if (form.password !== form.confirmPassword) { setError('Passwords do not match.'); setSubmitting(false); return }
    const { data, error: registrationError } = await invokeEdgeFunction(supabase, 'register-parent', { fullName: form.fullName, phone, password: form.password, admissionNumber: form.admissionNumber, dateOfBirth: form.dateOfBirth })
    if (registrationError) { setError(registrationError.message); setSubmitting(false); return }
    if (data?.error) { setError(data.error); setSubmitting(false); return }
    setMatchedStudent(Boolean(data?.matchedStudent)); setComplete(true); setSubmitting(false)
  }
  if (complete) return <main className="portal-auth"><section className="portal-auth-card portal-auth-animated"><PortalSiteExitLink className="portal-back">← Back to Reliance Learning Centre website</PortalSiteExitLink><img className="portal-auth-crest" src={logo} alt="Reliance Learning Centre crest" /><p className="eyebrow">Account created</p>{matchedStudent ? <><h1>You can now sign in</h1><PortalNotice>Your learner was verified automatically. Sign in to view their school records.</PortalNotice></> : <><h1>Contact the school office</h1><PortalNotice>We could not find a learner matching that admission number and date of birth. Please contact the school office to confirm the learner details or roster entry.</PortalNotice></>}<p><Link to="/portal/login">Return to sign in</Link></p></section></main>
  return <main className="portal-auth"><section className="portal-auth-card portal-auth-animated"><PortalSiteExitLink className="portal-back">← Back to Reliance Learning Centre website</PortalSiteExitLink><img className="portal-auth-crest" src={logo} alt="Reliance Learning Centre crest" /><p className="eyebrow">Portal</p><h1>Create a parent account</h1><p className="muted">Enter your details and your learner’s details for school verification.</p>{error && <PortalNotice tone="error">{error}</PortalNotice>}<form className="form" onSubmit={handleSubmit}><label>Full name<input value={form.fullName} onChange={update('fullName')} autoComplete="name" required /></label><PhoneInput value={form.phone} onChange={(phone) => setForm(current => ({ ...current, phone }))} required /><PasswordInput id="signup-password" label="Password" value={form.password} onChange={update('password')} autoComplete="new-password" required /><PasswordInput id="signup-confirm-password" label="Confirm password" value={form.confirmPassword} onChange={update('confirmPassword')} autoComplete="new-password" required /><label>Learner admission number<input value={form.admissionNumber} onChange={update('admissionNumber')} required /></label><label>Learner date of birth<input type="date" value={form.dateOfBirth} onChange={update('dateOfBirth')} required /></label><button className="btn primary" disabled={submitting}>{submitting ? 'Creating account…' : 'Create account'}</button></form><p>Already registered? <Link to="/portal/login">Sign in</Link></p></section></main>
}
