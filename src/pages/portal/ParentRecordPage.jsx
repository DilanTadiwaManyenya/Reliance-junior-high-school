import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Card from '../../components/ui/Card'
import AcademicReportCard from '../../components/portal/AcademicReportCard'
import PortalNotice from '../../components/portal/PortalNotice'
import { useAuth } from '../../context/useAuth'
import { getSubjectsByGradeStream } from '../../utils/CurriculumData'

const label = { academics: 'Academic report book', attendance: 'Attendance', behavior: 'Behaviour', sports: 'Sport', awards: 'Awards', insights: 'Attendance insights' }
const awardLabels = { most_behaved: 'Most Behaved', smartest: 'Smartest', best_in_subject: 'Best in Subject', overall_best_student: 'Overall Best Student', sports_person: 'Sports Person' }
const recordDate = value => new Intl.DateTimeFormat('en-ZW', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`))
const termLabel = value => String(value).toLowerCase().startsWith('term') ? String(value) : `Term ${value}`
const optionalAwardsError = error => ['PGRST205', '42P01'].includes(error?.code)

export default function ParentRecordPage() {
  const { studentId, view } = useParams()
  const { supabase, user } = useAuth()
  const [state, setState] = useState({ loading: true, error: '', student: null, records: [], attendance: [], behavior: [], sports: [], awards: [], fees: [], termSettings: [], reportFees: [], subjectTeachers: [] })
  useEffect(() => {
    let active = true
    const load = async () => {
      const { data: link, error: linkError } = await supabase.from('parent_student').select('student:students(*)').eq('parent_id', user.id).eq('student_id', studentId).not('verified_at', 'is', null).maybeSingle()
      if (linkError || !link?.student) { if (active) setState({ loading: false, error: linkError?.message || 'This learner record is unavailable.', student: null, records: [], attendance: [], behavior: [], sports: [], awards: [], fees: [], termSettings: [], reportFees: [], subjectTeachers: [] }); return }
      const table = { academics: 'academic_records', attendance: 'attendance', behavior: 'behavior_notes', sports: 'sports_records', awards: 'student_awards' }[view]
      const [recordResult, feeResult, attendanceResult, behaviorResult, sportsResult, awardsResult, termSettingsResult, reportFeesResult, subjectTeachersResult] = await Promise.all([
        table ? supabase.from(table).select('*').eq('student_id', studentId).order(table === 'attendance' ? 'date' : 'created_at', { ascending: false }) : Promise.resolve({ data: [] }),
        supabase.from('fee_balances').select('*').eq('student_id', studentId),
        view === 'academics' ? supabase.from('attendance').select('*').eq('student_id', studentId).order('date', { ascending: false }) : Promise.resolve({ data: [] }),
        view === 'academics' ? supabase.from('behavior_notes').select('*').eq('student_id', studentId).order('created_at', { ascending: false }) : Promise.resolve({ data: [] }),
        view === 'academics' ? supabase.from('sports_records').select('*').eq('student_id', studentId).order('created_at', { ascending: false }) : Promise.resolve({ data: [] }),
        view === 'academics' ? supabase.from('student_awards').select('*').eq('student_id', studentId).order('created_at', { ascending: false }) : Promise.resolve({ data: [] }),
        view === 'academics' ? supabase.from('term_settings').select('*') : Promise.resolve({ data: [] }),
        view === 'academics' ? supabase.from('report_term_fee_settings').select('academic_year, term, class_level, amount') : Promise.resolve({ data: [] }),
        view === 'academics' ? supabase.from('teacher_subject_assignments').select('subject, form_level, teacher_name').eq('form_level', link.student.class_level) : Promise.resolve({ data: [] }),
      ])
      const recordError = view === 'awards' && optionalAwardsError(recordResult.error) ? null : recordResult.error
      if (active) setState({ loading: false, error: recordError?.message || feeResult.error?.message || attendanceResult.error?.message || behaviorResult.error?.message || sportsResult.error?.message || (!optionalAwardsError(awardsResult.error) && awardsResult.error?.message) || termSettingsResult.error?.message || reportFeesResult.error?.message || subjectTeachersResult.error?.message || '', student: link.student, records: recordError ? [] : recordResult.data ?? [], attendance: attendanceResult.data ?? [], behavior: behaviorResult.data ?? [], sports: sportsResult.data ?? [], awards: awardsResult.data ?? [], fees: feeResult.data ?? [], termSettings: termSettingsResult.data ?? [], reportFees: reportFeesResult.data ?? [], subjectTeachers: subjectTeachersResult.data ?? [] })
    }
    load(); return () => { active = false }
  }, [studentId, supabase, user, view])
  if (state.loading) return <section className="section white"><div className="container portal-content">Loading learner record…</div></section>
  if (!state.student) return <section className="section white"><div className="container portal-content"><PortalNotice tone="error">{state.error}</PortalNotice></div></section>
  return <section className="section white"><div className="container portal-content parent-record-page"><Link className="parent-page-back" to="/portal/dashboard">← Back to dashboard</Link><p className="eyebrow">{state.student.full_name} · {label[view] ?? 'Learner record'}</p><h1>{label[view] ?? 'Learner record'}</h1>{state.student.status !== 'active' && <PortalNotice tone="error"><strong>This learner is no longer enrolled.</strong> This page contains their retained school history.</PortalNotice>}{state.error && <PortalNotice tone="error">{state.error}</PortalNotice>}
    {view === 'academics' && <AcademicReportCard student={state.student} academics={state.records} attendance={state.attendance} behavior={state.behavior} sports={state.sports} awards={state.awards} fees={state.fees} subjects={getSubjectsByGradeStream(state.student.class_level, state.student.class_stream)} subjectTeachers={state.subjectTeachers} report={Object.fromEntries(state.termSettings.map(row => [`${row.academic_year}-${row.term}`, row]))} reportFees={state.reportFees} />}
    {view === 'attendance' && <Card className="parent-full-card">{state.records.length ? <div className="portal-list">{state.records.map(row => <p key={row.id}><strong>{recordDate(row.date)}</strong> <span className={`portal-status ${row.status}`}>{row.status}</span>{row.note && <><br /><span className="muted">{row.note}</span></>}</p>)}</div> : <p className="muted">No attendance records have been shared yet.</p>}</Card>}
    {view === 'behavior' && <Card className="parent-full-card">{state.records.length ? <div className="portal-list">{state.records.map(row => <p key={row.id}><span className={`portal-status ${row.severity}`}>{row.severity}</span> <strong>{row.category}</strong><br /><span className="muted">{row.description}</span></p>)}</div> : <p className="muted">No behaviour notes have been shared yet.</p>}</Card>}
    {view === 'sports' && <Card className="parent-full-card">{state.records.length ? <div className="portal-list">{state.records.map(row => <p key={row.id}><strong>{row.activity}</strong> · {termLabel(row.term)}{row.achievement && ` · ${row.achievement}`}{row.note && <><br /><span className="muted">{row.note}</span></>}</p>)}</div> : <p className="muted">No sports records have been shared yet.</p>}</Card>}
    {view === 'awards' && <Card className="parent-full-card">{state.records.length ? <div className="portal-list">{state.records.map(row => <p key={row.id}><strong>{awardLabels[row.award_type] || row.award_type}</strong>{row.subject && ` · ${row.subject}`}{row.note && <><br /><span className="muted">{row.note}</span></>}</p>)}</div> : <p className="muted">No awards have been shared yet.</p>}</Card>}
    {view === 'insights' && <AttendanceInsights records={state.records} />}
  </div></section>
}

function AttendanceInsights({ records }) {
  const summary = records.reduce((result, row) => { result.total += 1; if (row.status === 'present' || row.status === 'late') result.present += 1; if (row.status === 'late') result.late += 1; if (row.status === 'absent') result.absent += 1; return result }, { total: 0, present: 0, late: 0, absent: 0 })
  const rate = summary.total ? Math.round((summary.present / summary.total) * 100) : 0
  return <div className="parent-insight-grid"><Card><span className="parent-record-kicker">Attendance rate</span><strong className="parent-insight-number">{rate}%</strong><p className="muted">Based on all shared attendance records.</p></Card><Card><span className="parent-record-kicker">Present</span><strong className="parent-insight-number">{summary.present}</strong><p className="muted">Including late arrivals.</p></Card><Card><span className="parent-record-kicker">Absent</span><strong className="parent-insight-number">{summary.absent}</strong><p className="muted">Recorded absences.</p></Card></div>
}
