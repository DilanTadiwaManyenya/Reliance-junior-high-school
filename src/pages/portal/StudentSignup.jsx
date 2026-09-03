import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import PortalNotice from '../../components/portal/PortalNotice'
import PhoneInput from '../../components/ui/PhoneInput'
import PasswordInput from '../../components/ui/PasswordInput'
import { buildPortalEmail, normalizePhone } from '../../../shared/portalAuth'
import { CLASS_LEVELS, getStreamsForLevel } from '../../data/classOptions'

const admissionPattern = /^\d{4,6}$/
const zimbabwePhonePattern = /^(?:\+263|0)7[1-8]\d{7}$/
const strongPassword = value => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(value)

export default function StudentSignup() {
  const { supabase } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ phone: '', password: '', confirmPassword: '', admissionNumber: '', dateOfBirth: '', classLevel: '', classStream: '', acceptedTerms: false })
  const [errors, setErrors] = useState({})
  const [submissionError, setSubmissionError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const streams = useMemo(() => getStreamsForLevel(form.classLevel), [form.classLevel])
  const update = field => event => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value
    setForm(current => ({ ...current, [field]: value, ...(field === 'classLevel' ? { classStream: getStreamsForLevel(value).length ? '' : 'N/A' } : {}) }))
    setErrors(current => ({ ...current, [field]: '' }))
  }
  const validate = () => {
    const next = {}
    if (!zimbabwePhonePattern.test(form.phone.replace(/[\s-]/g, ''))) next.phone = 'Enter a Zimbabwe mobile number beginning with +263 or 0.'
    if (!strongPassword(form.password)) next.password = 'Use at least 8 characters with uppercase, lowercase, and a number.'
    if (form.password !== form.confirmPassword) next.confirmPassword = 'Passwords do not match.'
    if (!admissionPattern.test(form.admissionNumber.trim())) next.admissionNumber = 'Admission number must contain 4 to 6 digits.'
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.dateOfBirth) || Number.isNaN(Date.parse(`${form.dateOfBirth}T00:00:00Z`))) next.dateOfBirth = 'Choose a valid date of birth.'
    if (!CLASS_LEVELS.includes(form.classLevel)) next.classLevel = 'Choose a class level.'
    if (streams.length ? !streams.includes(form.classStream) : form.classStream !== 'N/A') next.classStream = 'Choose a class stream.'
    if (!form.acceptedTerms) next.acceptedTerms = 'You must accept the terms and conditions.'
    return next
  }
  const submit = async event => {
    event.preventDefault(); setSubmissionError('')
    const nextErrors = validate(); setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    setSubmitting(true)
    const phoneNumber = normalizePhone(form.phone)
    try {
      await supabase.auth.signOut({ scope: 'local' })
      const { data, error } = await supabase.functions.invoke('register_student', { body: { phone_number: phoneNumber, password: form.password, admission_number: form.admissionNumber.trim(), date_of_birth: form.dateOfBirth, class_level: form.classLevel, class_stream: form.classStream } })
      if (error || !data?.success) throw new Error(data?.message || 'We could not create your account. Please try again.')
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: buildPortalEmail(phoneNumber), password: form.password })
      if (signInError) throw new Error('Your account was created. Please sign in to continue.')
      navigate('/portal/staff/dashboard', { replace: true })
    } catch (requestError) { setSubmissionError(requestError instanceof Error ? requestError.message : 'We could not create your account. Please try again.') } finally { setSubmitting(false) }
  }
  return <main className="portal-auth"><section className="portal-auth-card student-signup-card"><p className="eyebrow">Student portal</p><h1>Create your account</h1><p className="student-signup-intro">Enter the details supplied by the school to activate your student portal access.</p>{submissionError && <PortalNotice tone="error">{submissionError}</PortalNotice>}<form className="form student-signup-form" onSubmit={submit} noValidate>
    <label>Phone number <span className="required-mark">*</span><PhoneInput value={form.phone} onChange={phone => { setForm(current => ({ ...current, phone })); setErrors(current => ({ ...current, phone: '' })) }} required /></label>{errors.phone && <p className="field-error">{errors.phone}</p>}
    <label>Password <span className="required-mark">*</span><PasswordInput id="student-password" label="" value={form.password} onChange={update('password')} required /></label>{errors.password && <p className="field-error">{errors.password}</p>}
    <label>Confirm password <span className="required-mark">*</span><PasswordInput id="student-confirm-password" label="" value={form.confirmPassword} onChange={update('confirmPassword')} required /></label>{errors.confirmPassword && <p className="field-error">{errors.confirmPassword}</p>}
    <label>Admission number <span className="required-mark">*</span><input inputMode="numeric" maxLength="6" value={form.admissionNumber} onChange={update('admissionNumber')} /></label>{errors.admissionNumber && <p className="field-error">{errors.admissionNumber}</p>}
    <label>Date of birth <span className="required-mark">*</span><input type="date" value={form.dateOfBirth} onChange={update('dateOfBirth')} /></label>{errors.dateOfBirth && <p className="field-error">{errors.dateOfBirth}</p>}
    <label>Class level <span className="required-mark">*</span><select value={form.classLevel} onChange={update('classLevel')}><option value="">Select class level</option>{CLASS_LEVELS.map(level => <option key={level} value={level}>{level}</option>)}</select></label>{errors.classLevel && <p className="field-error">{errors.classLevel}</p>}
    <label>Class stream <span className="required-mark">*</span><select value={form.classStream} onChange={update('classStream')} disabled={!form.classLevel || !streams.length}><option value="">{form.classLevel ? (streams.length ? 'Select class stream' : 'N/A (single ECD class)') : 'Choose a class level first'}</option>{!streams.length && form.classLevel && <option value="N/A">N/A (single ECD class)</option>}{streams.map(stream => <option key={stream} value={stream}>{stream}</option>)}</select></label>{errors.classStream && <p className="field-error">{errors.classStream}</p>}
    <label className="terms-check"><input type="checkbox" checked={form.acceptedTerms} onChange={update('acceptedTerms')} /> I accept the terms and conditions <span className="required-mark">*</span></label>{errors.acceptedTerms && <p className="field-error">{errors.acceptedTerms}</p>}
    <button className="btn primary" disabled={submitting}>{submitting && <span className="button-spinner" aria-hidden="true" />} {submitting ? 'Creating accountï¿½' : 'Create account'}</button></form><p>Already registered? <Link to="/portal/student-login">Sign in</Link></p></section></main>
}