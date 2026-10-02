import { useEffect, useMemo, useState } from 'react'
import { CURRICULUM_STRUCTURE, getSubjectGroupsByGradeStream } from '../../utils/CurriculumData'
import { calculateGrade } from '../../utils/GradeCalculator'
import { useAuth } from '../../context/useAuth'
import PortalNotice from './PortalNotice'
import { parseClassKey } from './ClassSelector'
import { logActivity } from '../../lib/logActivity'

const currentYear = new Date().getFullYear()
// Zimbabwe school calendar: Term 1 Jan–Apr, Term 2 May–Aug, Term 3 Sep–Dec.
const currentSchoolTerm = () => String(Math.min(3, Math.floor(new Date().getMonth() / 4) + 1))
const blankAcademic = { subject: '', percentage: '', term: currentSchoolTerm(), year: currentYear, comment: '' }
const blankSports = { sport: '', participated: true, term: currentSchoolTerm(), year: currentYear, note: '' }

export default function TeacherGradeEntry() {
  const { supabase, user, profile } = useAuth()
  const [students, setStudents] = useState([]); const [studentId, setStudentId] = useState(''); const [tab, setTab] = useState('academic')
  const [academic, setAcademic] = useState(blankAcademic); const [sports, setSports] = useState(blankSports); const [subjectGroup, setSubjectGroup] = useState('')
  const [savedMarks, setSavedMarks] = useState([])
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState(''); const [success, setSuccess] = useState('')
  useEffect(() => { let active = true; (async () => { const { data, error: loadError } = await supabase.from('students').select('id, full_name, admission_number, class_level, class_stream').order('full_name'); if (!active) return; setStudents(data ?? []); setError(loadError ? 'Unable to load learners assigned to you.' : ''); setLoading(false) })(); return () => { active = false } }, [supabase])
  useEffect(() => { if (success) { const timer = setTimeout(() => setSuccess(''), 3000); return () => clearTimeout(timer) } }, [success])
  const activeClassKey = sessionStorage.getItem('reliance_active_portal_class') || ''
  
  const filteredStudents = useMemo(() => {
    const { level, stream } = parseClassKey(activeClassKey)
    if (!level) return students
    return students.filter(s => s.class_level === level && (stream ? s.class_stream === stream : true))
  }, [students, activeClassKey])

  const selected = filteredStudents.find(student => student.id === studentId)
  const subjectGroups = useMemo(() => selected ? getSubjectGroupsByGradeStream(selected.class_level, selected.class_stream) : {}, [selected])
  const selectedGroupSubjects = subjectGroups[subjectGroup] ?? []
  const curriculumSubjects = useMemo(() => Object.values(subjectGroups).flat(), [subjectGroups])
  const outcome = selected ? calculateGrade(academic.percentage, selected.class_level) : null
  const updateAcademic = field => event => setAcademic(value => ({ ...value, [field]: event.target.value }))
  useEffect(() => {
    let active = true
    if (!selected || tab !== 'academic') { setSavedMarks([]); return undefined }
    supabase.from('academic_records').select('id, subject, score, grade, term, year').eq('student_id', selected.id).eq('term', String(academic.term)).eq('year', Number(academic.year)).then(({ data, error: loadError }) => {
      if (!active) return
      if (loadError) setError(loadError.message)
      else setSavedMarks(data ?? [])
    })
    return () => { active = false }
  }, [academic.term, selected, supabase, tab])
  const save = async event => { event.preventDefault(); setError(''); setSuccess('')
    if (!selected) return setError('Select a learner before saving a record.')
    const data = tab === 'academic' ? academic : sports
    if (!data.term || !data.year || (tab === 'academic' && (!data.subject || !outcome)) || (tab === 'sports' && !data.sport)) return setError('Complete all required fields with a valid mark before saving.')
    setSaving(true)
    const table = tab === 'academic' ? 'academic_records' : 'sports_records'
    const payload = tab === 'academic'
      ? { student_id: selected.id, subject: academic.subject, score: Number(academic.percentage), grade: outcome.grade, term: String(academic.term), year: Number(academic.year), comment: academic.comment || null, recorded_by: user.id }
      : { student_id: selected.id, activity: sports.sport, term: String(sports.term), year: Number(sports.year), achievement: sports.participated ? 'Participated' : 'Did not participate', note: sports.note || null, recorded_by: user.id }
    const subjectField = tab === 'academic' ? 'subject' : 'activity'
    const subjectValue = tab === 'academic' ? academic.subject : sports.sport
    const { data: existingRecord, error: existingError } = await supabase.from(table).select('id').eq('student_id', selected.id).eq(subjectField, subjectValue).eq('term', String(data.term)).eq('year', Number(data.year)).maybeSingle()
    let saveError = existingError
    if (!saveError) {
      const request = existingRecord
        ? supabase.from(table).update(payload).eq('id', existingRecord.id)
        : supabase.from(table).insert(payload)
      const { error } = await request
      saveError = error
    }
    setSaving(false); if (saveError) return setError(saveError.message || 'The record could not be saved. Please try again.')
    setSavedMarks(current => [...current.filter(row => row.subject !== academic.subject), { ...payload, id: existingRecord?.id ?? academic.subject }])
    logActivity(supabase, user, profile, { actionType: 'update', description: `Saved ${tab === 'academic' ? 'grade' : 'sports participation'} for ${selected.full_name}`, targetTable: tab === 'academic' ? 'academic_records' : 'sports_records', targetId: selected.id })
    setSuccess(tab === 'academic' ? 'Grade saved successfully.' : 'Sports participation saved successfully.'); tab === 'academic' ? setAcademic(blankAcademic) : setSports(blankSports)
  }
  if (loading) return <div className="grade-entry"><p>Loading assigned learners…</p></div>
  return <section className="grade-entry"><div className="grade-entry-heading"><div><p className="eyebrow">Academic records</p><h1>Enter learner performance</h1><p>Select a learner to reveal the appropriate curriculum and grading scale.</p></div></div>{error && <PortalNotice tone="error">{error}</PortalNotice>}{success && <PortalNotice tone="success">{success}</PortalNotice>}
    <form onSubmit={save} className="grade-entry-form" noValidate><label>Learner<select value={studentId} onChange={event => { setStudentId(event.target.value); setSubjectGroup(''); setAcademic(blankAcademic) }}><option value="">Select a learner</option>{filteredStudents.map(student => <option key={student.id} value={student.id}>{student.full_name} — {student.admission_number}</option>)}</select></label>
      {selected && <div className="learner-summary"><strong>{selected.full_name}</strong><span>{selected.admission_number}</span><span>{selected.class_level} {selected.class_stream && `· ${selected.class_stream}`}</span></div>}
      <div className="grade-tabs" role="tablist"><button type="button" className={tab === 'academic' ? 'active' : ''} onClick={() => setTab('academic')}>Academics</button><button type="button" className={tab === 'sports' ? 'active' : ''} onClick={() => setTab('sports')}>Sports</button></div>
      {tab === 'academic' ? <><section className="subject-picker" aria-label="Subject selection"><span className="subject-picker-label">1. Choose a learning area</span><div className="subject-group-list">{Object.keys(subjectGroups).map(group => <button type="button" key={group} className={subjectGroup === group ? 'active' : ''} onClick={() => { setSubjectGroup(group); setAcademic(value => ({ ...value, subject: '' })) }}>{group}</button>)}</div>{subjectGroup && <><span className="subject-picker-label">2. Choose a subject</span><div className="subject-option-list">{selectedGroupSubjects.map(subject => <button type="button" key={subject} className={academic.subject === subject ? 'active' : ''} onClick={() => setAcademic(value => ({ ...value, subject }))}>{subject}</button>)}</div></>}</section><div className="grade-fields"><label>Selected subject<input value={academic.subject || 'Choose a learning area and subject above'} readOnly /></label><label>Possible mark<input value="100" readOnly /></label><label>Actual mark (%)<input type="number" min="0" max="100" step="0.01" value={academic.percentage} onChange={updateAcademic('percentage')} /></label><label>Grade / unit<input value={outcome?.grade ?? ''} readOnly /></label><label>Points<input value={outcome?.points ?? ''} readOnly /></label><label>Term<select value={academic.term} onChange={updateAcademic('term')}><option value="1">Term 1</option><option value="2">Term 2</option><option value="3">Term 3</option></select></label><label>Year<input type="number" min="2020" value={academic.year} onChange={updateAcademic('year')} /></label><label className="wide">Teacher's comment<textarea value={academic.comment} onChange={updateAcademic('comment')} /></label>{outcome && <p className="grade-outcome">{outcome.description}</p>}</div><SubjectProgress subjects={curriculumSubjects} marks={savedMarks} term={academic.term} /></> : <div className="grade-fields"><label>Sport<select value={sports.sport} onChange={event => setSports(value => ({ ...value, sport: event.target.value }))} disabled={!selected}><option value="">Select sport</option>{CURRICULUM_STRUCTURE.sports.map(sport => <option key={sport}>{sport}</option>)}</select></label><label>Participation<select value={String(sports.participated)} onChange={event => setSports(value => ({ ...value, participated: event.target.value === 'true' }))}><option value="true">Participated</option><option value="false">Did not participate</option></select></label><label>Term<select value={sports.term} onChange={event => setSports(value => ({ ...value, term: event.target.value }))}><option value="1">Term 1</option><option value="2">Term 2</option><option value="3">Term 3</option></select></label><label>Year<input type="number" min="2020" value={sports.year} onChange={event => setSports(value => ({ ...value, year: event.target.value }))} /></label><label className="wide">Performance note<textarea value={sports.note} onChange={event => setSports(value => ({ ...value, note: event.target.value }))} /></label></div>}
      <button className="btn primary" disabled={saving || !selected}>{saving ? 'Saving…' : `Save ${tab === 'academic' ? 'grade' : 'participation'}`}</button></form></section>
}

function SubjectProgress({ subjects, marks, term }) {
  const markBySubject = new Map(marks.map(mark => [mark.subject, mark]))
  const complete = subjects.filter(subject => markBySubject.has(subject)).length
  return <aside className="subject-progress" aria-live="polite"><div className="subject-progress-heading"><div><span>Term {term} checklist</span><strong>{complete}/{subjects.length} recorded</strong></div><small>Blank subjects still need a mark.</small></div><div className="subject-progress-table"><div className="subject-progress-row heading"><span>Subject</span><span>Mark</span><span>Grade</span></div>{subjects.map(subject => { const mark = markBySubject.get(subject); return <div className={`subject-progress-row${mark ? ' complete' : ''}`} key={subject}><span>{subject}</span><span>{mark ? mark.score : 'Blank'}</span><span>{mark?.grade ?? '—'}</span></div> })}</div></aside>
}
