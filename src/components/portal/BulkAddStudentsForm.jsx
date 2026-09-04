import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import Button from '../ui/Button'
import PortalNotice from './PortalNotice'

const empty = () => ({ admission_number: 'F1-2026-048', first_name: '', last_name: '', date_of_birth: '', sex: '', birth_cert_no: '', parent_phone: '', address: '', class_stream: 'White' })
const phoneOk = value => !value || /^\+263\d{9}$/.test(value)

export default function BulkAddStudentsForm({ onSaved }) {
  const [form, setForm] = useState(empty)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const update = key => event => setForm(current => ({ ...current, [key]: event.target.value }))

  const submit = async event => {
    event.preventDefault(); setError(''); setNotice('')
    if (!/^F1-2026-0(48|49)$/.test(form.admission_number)) return setError('Only F1-2026-048 and F1-2026-049 may be added here.')
    if (!phoneOk(form.parent_phone)) return setError('Parent phone must be +263 followed by nine digits.')
    if (!supabase) return setError('Supabase is not configured.')
    setSaving(true)
    const student = { full_name: `${form.first_name.trim()} ${form.last_name.trim()}`.trim(), admission_number: form.admission_number, date_of_birth: form.date_of_birth, sex: form.sex, birth_cert_no: form.birth_cert_no || null, parent_phone: form.parent_phone || null, address: form.address || null, class_level: 'Form 1', class_stream: form.class_stream, campus: 'senior', enrolled_year: 2026, status: 'active' }
    const { data, error: studentError } = await supabase.from('students').insert(student).select('id').single()
    if (studentError) { setSaving(false); return setError(studentError.message) }
    const { error: feeError } = await supabase.from('fee_balances').insert({ student_id: data.id, term: 3, academic_year: 2026, total_fees: 170, amount_paid: 0 })
    if (feeError) { await supabase.from('students').delete().eq('id', data.id); setSaving(false); return setError(`Fee record could not be created: ${feeError.message}`) }
    setNotice(`${form.admission_number} added with a Term 3 fee balance of $170.00.`); setForm(current => ({ ...empty(), admission_number: current.admission_number === 'F1-2026-048' ? 'F1-2026-049' : 'F1-2026-048' })); setSaving(false); onSaved?.()
  }
  return <section className="portal-workspace"><div className="portal-card"><h2>Add remaining Form 1 learner</h2><p className="muted">This form is restricted to admission numbers 048 and 049.</p><PortalNotice message={notice} error={error} /><form className="form portal-form" onSubmit={submit}>
    <label>Admission number<input required value={form.admission_number} onChange={update('admission_number')} /></label><label>First name<input required value={form.first_name} onChange={update('first_name')} /></label><label>Last name / surname<input required value={form.last_name} onChange={update('last_name')} /></label><label>Date of birth<input required type="date" value={form.date_of_birth} onChange={update('date_of_birth')} /></label><label>Sex<select required value={form.sex} onChange={update('sex')}><option value="">Choose</option><option value="M">M</option><option value="F">F</option></select></label><label>Class stream<select value={form.class_stream} onChange={update('class_stream')}><option>White</option><option>Green</option></select></label><label>Birth certificate<input value={form.birth_cert_no} onChange={update('birth_cert_no')} /></label><label>Parent phone<input placeholder="+2637XXXXXXXX" value={form.parent_phone} onChange={update('parent_phone')} /></label><label>Address<textarea value={form.address} onChange={update('address')} /></label><Button disabled={saving} type="submit">{saving ? 'Adding…' : 'Add learner'}</Button></form></div></section>
}
