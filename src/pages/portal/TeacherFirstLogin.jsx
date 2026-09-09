import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import PhoneInput from '../../components/ui/PhoneInput'
import PasswordInput from '../../components/ui/PasswordInput'
import PortalNotice from '../../components/portal/PortalNotice'
import { invokeEdgeFunction } from '../../lib/edgeFunction'

export default function TeacherFirstLogin() {
  const { user, profile, supabase } = useAuth(), navigate = useNavigate()
  const [phone, setPhone] = useState(''), [password, setPassword] = useState(''), [confirm, setConfirm] = useState(''), [error, setError] = useState(''), [saving, setSaving] = useState(false)
  const submit = async event => { event.preventDefault(); setError(''); if (password !== confirm) return setError('Passwords do not match.'); setSaving(true); const { data, error: requestError } = await invokeEdgeFunction(supabase, 'update_teacher_credentials', { phone, password }); setSaving(false); if (requestError || data?.error) return setError(data?.error || requestError.message); navigate('/portal/teacher', { replace: true }) }
  if (!user || profile?.role !== 'teacher') return null
  return <main className="portal-auth"><section className="portal-auth-card portal-auth-animated"><p className="eyebrow">Teacher account setup</p><h1>Set your contact details</h1><p className="muted">Your school-issued login is temporary. Add your real phone number and choose a personal password to continue.</p>{error && <PortalNotice tone="error">{error}</PortalNotice>}<form className="form" onSubmit={submit}><PhoneInput value={phone} onChange={setPhone} required /><PasswordInput id="teacher-new-password" label="New password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" required /><PasswordInput id="teacher-confirm-password" label="Confirm new password" value={confirm} onChange={event => setConfirm(event.target.value)} autoComplete="new-password" required /><button className="btn primary" disabled={saving}>{saving ? 'Saving…' : 'Save and continue'}</button></form></section></main>
}
