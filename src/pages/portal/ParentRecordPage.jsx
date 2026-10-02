import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Card from '../../components/ui/Card'
import PortalNotice from '../../components/portal/PortalNotice'
import { DisabledLearner, totalOwing } from '../../components/portal/LearnerRecords'
import { useAuth } from '../../context/useAuth'
import { siteContent } from '../../data/siteContent'

const label = { academics: 'Academic report book', attendance: 'Attendance', behavior: 'Behaviour', sports: 'Sport', insights: 'Attendance insights' }
const recordDate = value => new Intl.DateTimeFormat('en-ZW', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`))
const termLabel = value => String(value).toLowerCase().startsWith('term') ? String(value) : `Term ${value}`

export default function ParentRecordPage() {
  const { studentId, view } = useParams()
  const { supabase, user } = useAuth()
  const [state, setState] = useState({ loading: true, error: '', student: null, records: [], fees: [] })
  useEffect(() => {
    let active = true
    const load = async () => {
      const { data: link, error: linkError } = await supabase.from('parent_student').select('student:students(*)').eq('parent_id', user.id).eq('student_id', studentId).not('verified_at', 'is', null).maybeSingle()
      if (linkError || !link?.student) { if (active) setState({ loading: false, error: linkError?.message || 'This learner record is unavailable.', student: null, records: [], fees: [] }); return }
      const table = { academics: 'academic_records', attendance: 'attendance', behavior: 'behavior_notes', sports: 'sports_records' }[view]
      const [recordResult, feeResult] = await Promise.all([
        table ? supabase.from(table).select('*').eq('student_id', studentId).order(table === 'attendance' ? 'date' : 'created_at', { ascending: false }) : Promise.resolve({ data: [] }),
        supabase.from('fee_balances').select('*').eq('student_id', studentId),
      ])
      if (active) setState({ loading: false, error: recordResult.error?.message || feeResult.error?.message || '', student: link.student, records: recordResult.data ?? [], fees: feeResult.data ?? [] })
    }
    load(); return () => { active = false }
  }, [studentId, supabase, user, view])
  const groupedAcademics = useMemo(() => state.records.reduce((groups, row) => { const term = termLabel(row.term ?? '—'); (groups[term] ||= []).push(row); return groups }, {}), [state.records])
  if (state.loading) return <section className="section white"><div className="container portal-content">Loading learner record…</div></section>
  if (!state.student) return <section className="section white"><div className="container portal-content"><PortalNotice tone="error">{state.error}</PortalNotice></div></section>
  if (state.student.status !== 'active') return <DisabledLearner reason={state.student.inactive_reason} />
  const locked = totalOwing(state.fees) > 0
  return <section className="section white"><div className="container portal-content parent-record-page"><Link className="parent-page-back" to="/portal/dashboard">← Back to dashboard</Link><p className="eyebrow">{state.student.full_name} · {label[view] ?? 'Learner record'}</p><h1>{label[view] ?? 'Learner record'}</h1>{state.error && <PortalNotice tone="error">{state.error}</PortalNotice>}
    {view === 'academics' && (locked ? <Card className="parent-report-lock"><h2>Academic results are currently locked</h2><p>The latest fee balance is <strong>${totalOwing(state.fees).toFixed(2)}</strong>. Please contact the school office once payment has been recorded.</p><a href={`tel:${siteContent.contact.phone.replaceAll(' ', '')}`}>Call {siteContent.contact.phone}</a></Card> : <div className="report-book">{Object.keys(groupedAcademics).length ? Object.entries(groupedAcademics).map(([term, rows]) => <Card key={term} className="report-book-term"><div className="report-book-heading"><div><p className="parent-record-kicker">Reliance Learning Centre</p><h2>{term} report</h2></div><span>{state.student.class_level} {state.student.class_stream}</span></div><div className="portal-table-wrap"><table className="portal-table"><thead><tr><th>Subject</th><th>Mark</th><th>Grade</th><th>Teacher comment</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><td><strong>{row.subject}</strong></td><td>{row.score}%</td><td>{row.grade}</td><td>{row.comment || '—'}</td></tr>)}</tbody></table></div></Card>) : <Card><p className="muted">No academic results have been shared yet.</p></Card>}</div>)}
    {view === 'attendance' && <Card className="parent-full-card">{state.records.length ? <div className="portal-list">{state.records.map(row => <p key={row.id}><strong>{recordDate(row.date)}</strong> <span className={`portal-status ${row.status}`}>{row.status}</span>{row.note && <><br /><span className="muted">{row.note}</span></>}</p>)}</div> : <p className="muted">No attendance records have been shared yet.</p>}</Card>}
    {view === 'behavior' && <Card className="parent-full-card">{state.records.length ? <div className="portal-list">{state.records.map(row => <p key={row.id}><span className={`portal-status ${row.severity}`}>{row.severity}</span> <strong>{row.category}</strong><br /><span className="muted">{row.description}</span></p>)}</div> : <p className="muted">No behaviour notes have been shared yet.</p>}</Card>}
    {view === 'sports' && <Card className="parent-full-card">{state.records.length ? <div className="portal-list">{state.records.map(row => <p key={row.id}><strong>{row.activity}</strong> · {termLabel(row.term)}{row.achievement && ` · ${row.achievement}`}{row.note && <><br /><span className="muted">{row.note}</span></>}</p>)}</div> : <p className="muted">No sports records have been shared yet.</p>}</Card>}
    {view === 'insights' && <AttendanceInsights records={state.records} />}
  </div></section>
}

function AttendanceInsights({ records }) {
  const summary = records.reduce((result, row) => { result.total += 1; if (row.status === 'present' || row.status === 'late') result.present += 1; if (row.status === 'late') result.late += 1; if (row.status === 'absent') result.absent += 1; return result }, { total: 0, present: 0, late: 0, absent: 0 })
  const rate = summary.total ? Math.round((summary.present / summary.total) * 100) : 0
  return <div className="parent-insight-grid"><Card><span className="parent-record-kicker">Attendance rate</span><strong className="parent-insight-number">{rate}%</strong><p className="muted">Based on all shared attendance records.</p></Card><Card><span className="parent-record-kicker">Present</span><strong className="parent-insight-number">{summary.present}</strong><p className="muted">Including late arrivals.</p></Card><Card><span className="parent-record-kicker">Absent</span><strong className="parent-insight-number">{summary.absent}</strong><p className="muted">Recorded absences.</p></Card></div>
}
