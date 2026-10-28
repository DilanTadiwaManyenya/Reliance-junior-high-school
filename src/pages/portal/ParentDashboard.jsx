import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import PortalNotice from '../../components/portal/PortalNotice'
import LearnerRecords from '../../components/portal/LearnerRecords'
import ParentLibraryLauncher from '../../components/portal/ParentLibraryLauncher'
import Card from '../../components/ui/Card'
import DateOfBirthInput from '../../components/ui/DateOfBirthInput'
import { useAuth } from '../../context/useAuth'
import { siteContent } from '../../data/siteContent'
import { normalizeStudentAdmission, validStudentAdmission } from '../../../shared/studentRegistration.js'

export default function ParentDashboard() {
  const { supabase, user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [students, setStudents] = useState([])
  const [pendingStudents, setPendingStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [connectionRevision, setConnectionRevision] = useState(0)
  const [recordsRevision, setRecordsRevision] = useState(0)
  const [connectionError, setConnectionError] = useState('')
  const [pendingError, setPendingError] = useState('')
  const [pendingLoading, setPendingLoading] = useState(true)
  const [pendingRevision, setPendingRevision] = useState(0)
  const [newLearner, setNewLearner] = useState({ admissionNumber: '', dateOfBirth: '' })
  const [linkSubmitting, setLinkSubmitting] = useState(false)
  const [linkError, setLinkError] = useState('')
  const [linkNotice, setLinkNotice] = useState('')
  const [recordState, setRecordState] = useState({ studentId: '', records: null, fees: [], error: '' })
  const requestedId = searchParams.get('learner')
  const selectedId = students.find(student => student.id === requestedId)?.id || students[0]?.id || ''
  const setSelectedId = id => { const next = new URLSearchParams(searchParams); next.set('learner', id); setSearchParams(next, { replace: true }) }
  useEffect(() => {
    let active = true
    Promise.resolve()
      .then(() => supabase.from('parent_student').select('student:students(id,full_name,campus,class_level,class_stream,status)').eq('parent_id', user.id).not('verified_at', 'is', null))
      .then(({ data, error: requestError }) => {
        if (!active) return
        setConnectionError(requestError ? 'We could not load your verified learner connections. Please try again.' : '')
        setStudents(requestError ? [] : (data || []).map(row => row.student).filter(Boolean))
        setLoading(false)
      }).catch(() => {
        if (!active) return
        setConnectionError('We could not load your verified learner connections. Please try again.')
        setStudents([])
        setLoading(false)
      })
    return () => { active = false }
  }, [supabase, user.id, connectionRevision])
  useEffect(() => {
    let active = true
    Promise.resolve()
      .then(() => supabase.rpc('parent_pending_student_links'))
      .then(({ data, error: requestError }) => {
        if (!active) return
        setPendingError(requestError ? 'We could not load your pending learner requests. Please try again.' : '')
        setPendingStudents(requestError ? [] : data || [])
        setPendingLoading(false)
      }).catch(() => {
        if (!active) return
        setPendingError('We could not load your pending learner requests. Please try again.')
        setPendingStudents([])
        setPendingLoading(false)
      })
    return () => { active = false }
  }, [supabase, pendingRevision])
  useEffect(() => {
    if (requestedId && selectedId && requestedId !== selectedId) {
      const next = new URLSearchParams(searchParams)
      next.set('learner', selectedId)
      setSearchParams(next, { replace: true })
    }
  }, [requestedId, searchParams, selectedId, setSearchParams])
  const retryConnections = () => {
    setLoading(true)
    setConnectionRevision(value => value + 1)
  }
  const retryPendingRequests = () => {
    setPendingLoading(true)
    setPendingRevision(value => value + 1)
  }
  const requestAnotherLearner = async event => {
    event.preventDefault()
    setLinkError('')
    setLinkNotice('')
    const admissionNumber = normalizeStudentAdmission(newLearner.admissionNumber)
    if (!validStudentAdmission(admissionNumber)) {
      setLinkError('Enter a valid learner admission number.')
      return
    }
    if (!newLearner.dateOfBirth) {
      setLinkError('Enter the learner’s date of birth.')
      return
    }
    setLinkSubmitting(true)
    try {
      const { data, error: requestError } = await supabase.rpc('request_parent_student_link', {
        requested_admission_number: admissionNumber,
        requested_date_of_birth: newLearner.dateOfBirth,
      })
      if (requestError) {
        const message = requestError.message || ''
        setLinkError(requestError.code === '23505' || message.includes('already linked')
          ? 'This learner is already linked to a parent account. Contact the school office if this is incorrect.'
          : 'We could not submit that learner connection. Check the details or contact the school office.')
        return
      }
      if (!data) {
        setLinkError('We could not verify that admission number and date of birth. Check the details and try again.')
        return
      }
      setNewLearner({ admissionNumber: '', dateOfBirth: '' })
      setLinkNotice('Request sent. The school must verify this learner before their records appear in your account.')
      setPendingLoading(true)
      setPendingRevision(value => value + 1)
    } catch {
      setLinkError('We could not connect to the school. Check your connection and try again.')
    } finally {
      setLinkSubmitting(false)
    }
  }
  useEffect(() => {
    if (!selectedId) return
    let active = true
    Promise.all([
      supabase.from('academic_records').select('*').eq('student_id', selectedId).order('created_at', { ascending: false }),
      supabase.from('coursework_marks').select('*, assessment:coursework_assessments(*)').eq('student_id', selectedId).order('created_at', { ascending: false }),
      supabase.from('attendance').select('*').eq('student_id', selectedId).order('date', { ascending: false }),
      supabase.from('behavior_notes').select('*').eq('student_id', selectedId).order('created_at', { ascending: false }),
      supabase.from('sports_records').select('*').eq('student_id', selectedId).order('created_at', { ascending: false }),
      supabase.from('student_awards').select('*').eq('student_id', selectedId).order('created_at', { ascending: false }),
      supabase.from('fee_balances').select('*').eq('student_id', selectedId),
    ]).then(([academics, coursework, attendance, behavior, sports, awards, balances]) => {
      if (!active) return
      const failed = [academics, coursework, attendance, behavior, sports, balances].find(result => result.error)
      setRecordState({ studentId: selectedId, error: failed?.error?.message || '', records: failed ? null : { academics: academics.data || [], coursework: coursework.data || [], attendance: attendance.data || [], behavior: behavior.data || [], sports: sports.data || [], awards: awards.error ? [] : awards.data || [] }, fees: balances.data || [] })
    }).catch(() => { if (active) setRecordState({ studentId: selectedId, error: 'We could not load this learner’s records. Please try again.', records: null, fees: [] }) })
    return () => { active = false }
  }, [selectedId, supabase, recordsRevision])
  const currentRecords = recordState.studentId === selectedId ? recordState : null
  const student = students.find(row => row.id === selectedId)
  if (loading) return <section className="section white parent-dashboard-section"><div className="container portal-content parent-dashboard-content"><p className="parent-dashboard-loading" role="status">Loading your learner connections…</p></div></section>
  if (connectionError) return <section className="section white parent-dashboard-section"><div className="container portal-content parent-dashboard-content">
    <header className="parent-dashboard-heading parent-dashboard-heading-empty"><div><p className="eyebrow">Parent workspace</p><h1>Your learner connections</h1><p className="parent-dashboard-intro">We couldn’t confirm which learners are connected to this account yet.</p></div></header>
    <PortalNotice tone="error">{connectionError} <button type="button" className="btn secondary" onClick={retryConnections}>Retry learner connections</button></PortalNotice>
  </div></section>
  if (!students.length) return <section className="section white parent-dashboard-section"><div className="container portal-content parent-dashboard-content">
    <header className="parent-dashboard-heading parent-dashboard-heading-empty"><div><p className="eyebrow">Parent workspace</p><h1>Connect your learners</h1><p className="parent-dashboard-intro">Use this account to request access to each of your children’s school records. The school verifies every learner connection.</p></div></header>
    <div className="parent-connection-grid">
      <LearnerLinkRequest firstLearner value={newLearner} onChange={setNewLearner} onSubmit={requestAnotherLearner} error={linkError} notice={linkNotice} submitting={linkSubmitting} />
      <PendingLearnerRequests students={pendingStudents} loading={pendingLoading} error={pendingError} onRetry={retryPendingRequests} />
      <aside className="parent-first-learner-help"><span className="parent-panel-kicker">Need help?</span><p>For assistance connecting a learner, contact the school office.</p><a href={`tel:${siteContent.contact.phone.replaceAll(' ', '')}`}>{siteContent.contact.phone}</a></aside>
    </div>
  </div></section>
  return <section className="section white parent-dashboard-section"><div className="container portal-content parent-dashboard-content">
    <header className="parent-dashboard-heading">
      <div className="parent-dashboard-heading-copy"><p className="eyebrow">Parent workspace</p><h1>{student?.full_name}</h1><div className="parent-dashboard-meta parent-learner-context"><span>{student?.campus === 'junior' ? 'Junior School' : 'Senior School'}</span><span>{student?.class_level}{student?.class_stream ? ` · ${student.class_stream}` : ''}</span><span>{student?.status === 'active' ? 'Enrolled' : 'Historical records'}</span></div></div>
      {students.length > 1 && <label className="parent-dashboard-switcher">Viewing learner<select value={selectedId} onChange={e => setSelectedId(e.target.value)}>{students.map(row => <option key={row.id} value={row.id}>{row.full_name} · {row.campus === 'junior' ? 'Junior' : 'Senior'} School · {row.class_level} {row.class_stream}</option>)}</select></label>}
    </header>
    {student?.status !== 'active' && <PortalNotice tone="error"><strong>This learner is no longer enrolled at Reliance Learning Centre.</strong> You can still view their historical academic, attendance, behaviour, sport, and award records below.</PortalNotice>}
    <div className={`parent-connection-grid${pendingStudents.length ? '' : ' parent-connection-grid-single'}`}>
      <LearnerLinkRequest value={newLearner} onChange={setNewLearner} onSubmit={requestAnotherLearner} error={linkError} notice={linkNotice} submitting={linkSubmitting} />
      <PendingLearnerRequests students={pendingStudents} loading={pendingLoading} error={pendingError} onRetry={retryPendingRequests} />
    </div>
    <section className="parent-records-region" aria-labelledby="parent-records-heading">
      <div className="parent-records-heading"><div><span className="parent-panel-kicker">School updates</span><h2 id="parent-records-heading">Learner records</h2></div><p>Academic progress, attendance, and other records shared by the school.</p></div>
      {currentRecords?.error ? <PortalNotice tone="error">{currentRecords.error} <button type="button" className="btn secondary" onClick={() => { setRecordState({ studentId: '', records: null, fees: [], error: '' }); setRecordsRevision(value => value + 1) }}>Retry learner records</button></PortalNotice> : currentRecords?.records ? <LearnerRecords student={student} records={currentRecords.records} fees={currentRecords.fees} /> : <p className="parent-dashboard-loading" role="status">Loading learner records…</p>}
      <ParentLibraryLauncher student={student} />
      {student?.status === 'active' && <Link className="parent-uniform-catalogue-link" to={`/portal/uniforms?learner=${student.id}`} aria-label={`Open uniform catalogue for ${student.full_name}`}><span className="parent-uniform-catalogue-icon" aria-hidden="true">RLC</span><span><span className="parent-record-kicker">School shop</span><strong>Buy school uniforms</strong><small>Browse the uniform catalogue, add items to your cart, and choose EcoCash, bank transfer, card, or collection payment.</small></span><span className="parent-uniform-catalogue-arrow" aria-hidden="true">→</span></Link>}
    </section>
  </div></section>
}

function PendingLearnerRequests({ students, loading, error, onRetry }) {
  if (!loading && !error && !students.length) return null
  return <Card className="parent-pending-learners"><div className="parent-panel-heading"><div><span className="parent-panel-kicker">Waiting for review</span><h2>Pending requests</h2></div>{!error && !loading && <span className="parent-pending-count">{students.length}</span>}</div>
    {error ? <PortalNotice tone="error">{error} <button type="button" className="btn secondary" onClick={onRetry}>Retry pending requests</button></PortalNotice> : loading ? <p className="muted" role="status">Checking for pending requests…</p> : <><p className="muted">These learners will appear in your options after the school verifies each connection.</p><ul>{students.map(row => <li key={row.id}><strong>{row.full_name}</strong><span>{row.campus === 'junior' ? 'Junior' : 'Senior'} School · {row.class_level}{row.class_stream ? ` · ${row.class_stream}` : ''}</span></li>)}</ul></>}
  </Card>
}

function LearnerLinkRequest({ value, onChange, onSubmit, error, notice, submitting, firstLearner = false }) {
  return <Card className="parent-add-learner"><div className="parent-panel-heading"><div><span className="parent-panel-kicker">Family access</span><h2>{firstLearner ? 'Connect your first learner' : 'Add another learner'}</h2></div><span className="parent-add-learner-icon" aria-hidden="true">+</span></div><p className="muted">A learner can only be linked to one parent account. Enter their admission number and date of birth to request access.</p>{error && <PortalNotice tone="error">{error}</PortalNotice>}{notice && <PortalNotice role="status" aria-live="polite">{notice}</PortalNotice>}<form className="form" onSubmit={onSubmit}><label>Learner admission number<input value={value.admissionNumber} onChange={event => onChange(current => ({ ...current, admissionNumber: event.target.value }))} autoComplete="off" required /></label><label>Learner date of birth<DateOfBirthInput value={value.dateOfBirth} onChange={event => onChange(current => ({ ...current, dateOfBirth: event.target.value }))} required /></label><button className="btn primary parent-request-button" type="submit" disabled={submitting}>{submitting ? 'Sending request…' : 'Request learner access'}</button></form></Card>
}
