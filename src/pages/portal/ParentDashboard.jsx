import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import PortalNotice from '../../components/portal/PortalNotice'
import LearnerRecords from '../../components/portal/LearnerRecords'
import { useAuth } from '../../context/useAuth'
import { siteContent } from '../../data/siteContent'

export default function ParentDashboard() {
  const { supabase, user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [recordState, setRecordState] = useState({ studentId: '', records: null, fees: [], error: '' })
  const requestedId = searchParams.get('learner')
  const selectedId = students.find(student => student.id === requestedId)?.id || students[0]?.id || ''
  const setSelectedId = id => { const next = new URLSearchParams(searchParams); next.set('learner', id); setSearchParams(next, { replace: true }) }
  useEffect(() => {
    let active = true
    supabase.from('parent_student').select('student:students(*)').eq('parent_id', user.id).not('verified_at', 'is', null).then(({ data, error: linkError }) => {
      if (!active) return
      setError(linkError?.message || '')
      setStudents(data?.map(row => row.student).filter(Boolean) || [])
      setLoading(false)
    }).catch(() => { if (active) { setError('We could not load your learner connections. Please try again.'); setLoading(false) } })
    return () => { active = false }
  }, [supabase, user.id])
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
  }, [selectedId, supabase, revision])
  const currentRecords = recordState.studentId === selectedId ? recordState : null
  const student = students.find(row => row.id === selectedId)
  if (loading) return <section className="section white"><div className="container">Loading learner records…</div></section>
  if (!students.length) return <section className="section white"><div className="container portal-content"><div className="portal-empty-state"><p className="eyebrow">Parent dashboard</p><h1>No learner connection found</h1>{error && <PortalNotice tone="error">{error}</PortalNotice>}<p className="muted">We could not find a verified learner connection for this account.</p><p>Contact the school office on <a href={`tel:${siteContent.contact.phone.replaceAll(' ', '')}`}>{siteContent.contact.phone}</a>.</p></div></div></section>
  return <section className="section white"><div className="container portal-content"><p className="eyebrow">Parent dashboard</p><h1>{student?.full_name}</h1><p className="parent-learner-context">{student?.campus === 'junior' ? 'Junior School' : 'Senior School'} · {student?.class_level} {student?.class_stream}</p>{students.length > 1 && <label className="portal-switcher">Viewing learner<select value={selectedId} onChange={e => setSelectedId(e.target.value)}>{students.map(row => <option key={row.id} value={row.id}>{row.full_name} · {row.class_level} {row.class_stream}</option>)}</select></label>}{student?.status !== 'active' && <PortalNotice tone="error"><strong>This learner is no longer enrolled at Reliance Learning Centre.</strong> You can still view their historical academic, attendance, behaviour, sport, and award records below.</PortalNotice>}{error && <PortalNotice tone="error">{error}</PortalNotice>}{currentRecords?.error ? <PortalNotice tone="error">{currentRecords.error} <button type="button" className="btn secondary" onClick={() => { setRecordState({ studentId: '', records: null, fees: [], error: '' }); setRevision(value => value + 1) }}>Retry learner records</button></PortalNotice> : currentRecords?.records ? <LearnerRecords student={student} records={currentRecords.records} fees={currentRecords.fees} /> : <p role="status">Loading this learner’s records…</p>}{student?.status === 'active' && <Link className="parent-uniform-catalogue-link" to={`/portal/uniforms?learner=${student.id}`} aria-label={`Open uniform catalogue for ${student.full_name}`}><span className="parent-uniform-catalogue-icon" aria-hidden="true">RLC</span><span><span className="parent-record-kicker">School shop</span><strong>Buy school uniforms</strong><small>Browse the uniform catalogue, add items to your cart, and choose EcoCash, bank transfer, card, or collection payment.</small></span><span className="parent-uniform-catalogue-arrow" aria-hidden="true">→</span></Link>}</div></section>
}
