import { useEffect, useMemo, useState } from 'react'
import { CURRICULUM_STRUCTURE, getSubjectsByGradeStream } from '../../utils/CurriculumData'
import { calculateGrade } from '../../utils/GradeCalculator'
import { useAuth } from '../../context/useAuth'
import PortalNotice from './PortalNotice'

const currentYear = new Date().getFullYear()
const blankAcademic = { subject: '', percentage: '', term: '1', year: currentYear, comment: '' }
const blankSports = { sport: '', participated: true, term: '1', year: currentYear, note: '' }

export default function TeacherGradeEntry() {
  const { supabase } = useAuth()
  const [students, setStudents] = useState([]); const [studentId, setStudentId] = useState(''); const [tab, setTab] = useState('academic')
  const [academic, setAcademic] = useState(blankAcademic); const [sports, setSports] = useState(blankSports)
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState(''); const [success, setSuccess] = useState('')
  useEffect(() => { let active = true; (async () => { const { data, error: loadError } = await supabase.from('students').select('id, full_name, admission_number, class_level, class_stream').order('full_name'); if (!active) return; setStudents(data ?? []); setError(loadError ? 'Unable to load learners assigned to you.' : ''); setLoading(false) })(); return () => { active = false } }, [supabase])
  useEffect(() => { if (success) { const timer = setTimeout(() => setSuccess(''), 3000); return () => clearTimeout(timer) } }, [success])
  const selected = students.find(student => student.id === studentId)
  const subjects = useMemo(() => selected ? getSubjectsByGradeStream(selected.class_level, selected.class_stream) : [], [selected])
  const outcome = selected ? calculateGrade(academic.percentage, selected.class_level) : null
  const updateAcademic = field => event => setAcademic(value => ({ ...value, [field]: event.target.value }))
  const save = async event => { event.preventDefault(); setError(''); setSuccess('')
    if (!selected) return setError('Select a learner before saving a record.')
    const data = tab === 'academic' ? academic : sports
    if (!data.term || !data.year || (tab === 'academic' && (!data.subject || !outcome)) || (tab === 'sports' && !data.sport)) return setError('Complete all required fields with a valid mark before saving.')
    setSaving(true)
    const payload = tab === 'academic'
      ? { student_id: selected.id, subject: academic.subject, percentage: Number(academic.percentage), score: Number(academic.percentage), grade: outcome.grade, points: outcome.points, term: Number(academic.term), year: Number(academic.year), teachers_comment: academic.comment || null, comment: academic.comment || null }
      : { student_id: selected.id, sport: sports.sport, activity: sports.sport, participated: sports.participated, performance_note: sports.note || null, note: sports.note || null, term: Number(sports.term), year: Number(sports.year) }
    const { error: saveError } = await supabase.from(tab === 'academic' ? 'academic_records' : 'sports_records').upsert(payload, { onConflict: tab === 'academic' ? 'student_id,subject,term,year' : 'student_id,sport,term,year' })
    setSaving(false); if (saveError) return setError(saveError.message || 'The record could not be saved. Please try again.')
    setSuccess(tab === 'academic' ? 'Grade saved successfully.' : 'Sports participation saved successfully.'); tab === 'academic' ? setAcademic(blankAcademic) : setSports(blankSports)
  }
  if (loading) return <div className="grade-entry"><p>Loading assigned learners…</p></div>
  return <section className="grade-entry"><div className="grade-entry-heading"><div><p className="eyebrow">Academic records</p><h1>Enter learner performance</h1><p>Select a learner to reveal the appropriate curriculum and grading scale.</p></div></div>{error && <PortalNotice tone="error">{error}</PortalNotice>}{success && <PortalNotice tone="success">{success}</PortalNotice>}
    <form onSubmit={save} className="grade-entry-form" noValidate><label>Learner<select value={studentId} onChange={event => setStudentId(event.target.value)}><option value="">Select a learner</option>{students.map(student => <option key={student.id} value={student.id}>{student.full_name} — {student.admission_number}</option>)}</select></label>
      {selected && <div className="learner-summary"><strong>{selected.full_name}</strong><span>{selected.admission_number}</span><span>{selected.class_level} {selected.class_stream && `· ${selected.class_stream}`}</span></div>}
      <div className="grade-tabs" role="tablist"><button type="button" className={tab === 'academic' ? 'active' : ''} onClick={() => setTab('academic')}>Academics</button><button type="button" className={tab === 'sports' ? 'active' : ''} onClick={() => setTab('sports')}>Sports</button></div>
      {tab === 'academic' ? <div className="grade-fields"><label>Subject<select value={academic.subject} onChange={updateAcademic('subject')} disabled={!selected}><option value="">Select subject</option>{subjects.map(subject => <option key={subject}>{subject}</option>)}</select></label><label>Possible mark<input value="100" readOnly /></label><label>Actual mark (%)<input type="number" min="0" max="100" step="0.01" value={academic.percentage} onChange={updateAcademic('percentage')} /></label><label>Grade / unit<input value={outcome?.grade ?? ''} readOnly /></label><label>Points<input value={outcome?.points ?? ''} readOnly /></label><label>Term<select value={academic.term} onChange={updateAcademic('term')}><option value="1">Term 1</option><option value="2">Term 2</option><option value="3">Term 3</option></select></label><label>Year<input type="number" min="2020" value={academic.year} onChange={updateAcademic('year')} /></label><label className="wide">Teacher's comment<textarea value={academic.comment} onChange={updateAcademic('comment')} /></label>{outcome && <p className="grade-outcome">{outcome.description}</p>}</div> : <div className="grade-fields"><label>Sport<select value={sports.sport} onChange={event => setSports(value => ({ ...value, sport: event.target.value }))} disabled={!selected}><option value="">Select sport</option>{CURRICULUM_STRUCTURE.sports.map(sport => <option key={sport}>{sport}</option>)}</select></label><label>Participation<select value={String(sports.participated)} onChange={event => setSports(value => ({ ...value, participated: event.target.value === 'true' }))}><option value="true">Participated</option><option value="false">Did not participate</option></select></label><label>Term<select value={sports.term} onChange={event => setSports(value => ({ ...value, term: event.target.value }))}><option value="1">Term 1</option><option value="2">Term 2</option><option value="3">Term 3</option></select></label><label>Year<input type="number" min="2020" value={sports.year} onChange={event => setSports(value => ({ ...value, year: event.target.value }))} /></label><label className="wide">Performance note<textarea value={sports.note} onChange={event => setSports(value => ({ ...value, note: event.target.value }))} /></label></div>}
      <button className="btn primary" disabled={saving || !selected}>{saving ? 'Saving…' : `Save ${tab === 'academic' ? 'grade' : 'participation'}`}</button></form></section>
}
