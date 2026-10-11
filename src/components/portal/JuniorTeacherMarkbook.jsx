import { useEffect, useMemo, useState } from 'react'
import { calculateGrade } from '../../utils/GradeCalculator'
import { getSubjectsByGradeStream } from '../../utils/CurriculumData'
import { useAuth } from '../../context/useAuth'
import PortalNotice from './PortalNotice'

const currentTerm = () => String(Math.min(3, Math.floor(new Date().getMonth() / 4) + 1))
const blank = () => ({ subject: '', percentage: '', exam_mark: '', term: currentTerm(), year: new Date().getFullYear(), comment: '' })

export default function JuniorTeacherMarkbook() {
  const { supabase, profile } = useAuth()
  const assignedLevels = useMemo(() => [...new Set((profile?.teacher_class_assignments || [])
    .filter(assignment => /^Grade [1-7]$|^ECD [AB]$/.test(assignment.class_level))
    .map(assignment => assignment.class_level))], [profile?.teacher_class_assignments])
  const [classLevel, setClassLevel] = useState('')
  const [students, setStudents] = useState([])
  const [studentId, setStudentId] = useState('')
  const [form, setForm] = useState(blank)
  const [recordId, setRecordId] = useState('')
  const [markedStudentIds, setMarkedStudentIds] = useState(() => new Set())
  const [loading, setLoading] = useState(true)
  const [loadingRecord, setLoadingRecord] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const subjects = useMemo(() => classLevel ? getSubjectsByGradeStream(classLevel, 'Blue') : [], [classLevel])
  const visible = useMemo(() => students.filter(student => student.class_level === classLevel), [students, classLevel])
  const learner = visible.find(student => student.id === studentId)
  const activeSubject = form.subject
  const mark = form.exam_mark === '' ? form.percentage : form.exam_mark
  const outcome = learner ? calculateGrade(mark, learner.class_level) : null
  const change = field => event => setForm(value => ({ ...value, [field]: event.target.value }))

  useEffect(() => {
    if (!classLevel && assignedLevels.length) setClassLevel(assignedLevels[0])
  }, [assignedLevels, classLevel])

  useEffect(() => {
    let active = true
    supabase.from('students').select('id,full_name,admission_number,class_level,class_stream,status').eq('status', 'active').order('full_name').then(({ data, error: requestError }) => {
      if (!active) return
      const allowed = (data || []).filter(student => assignedLevels.includes(student.class_level))
      setStudents(allowed)
      setError(requestError ? 'Unable to load learners in your assigned Junior class.' : '')
      setLoading(false)
    })
    return () => { active = false }
  }, [supabase, assignedLevels.join('|')])

  useEffect(() => {
    setStudentId('')
    setRecordId('')
    setForm(value => ({ ...blank(), term: value.term, year: value.year, subject: '' }))
  }, [classLevel])

  useEffect(() => {
    let active = true
    if (!learner || !activeSubject) { setRecordId(''); return () => { active = false } }
    const loadRecord = async () => {
      setLoadingRecord(true); setError(''); setNotice('')
      const { data, error: requestError } = await supabase.from('academic_records')
        .select('id,term_mark,exam_mark,percentage,score,comment')
        .eq('student_id', learner.id).eq('subject', activeSubject).eq('term', form.term).eq('year', Number(form.year)).maybeSingle()
      if (!active) return
      if (requestError) { setError(requestError.message); setLoadingRecord(false); return }
      setRecordId(data?.id || '')
      setForm(value => ({ ...blank(), term: value.term, year: value.year, subject: activeSubject, percentage: data?.term_mark ?? data?.percentage ?? (data?.exam_mark == null ? data?.score ?? '' : ''), exam_mark: data?.exam_mark ?? '', comment: data?.comment ?? '' }))
      setLoadingRecord(false)
    }
    loadRecord()
    return () => { active = false }
  }, [learner, activeSubject, form.term, form.year, supabase])

  useEffect(() => {
    let active = true
    const ids = visible.map(student => student.id)
    if (!activeSubject || !ids.length) { setMarkedStudentIds(new Set()); return () => { active = false } }
    supabase.from('academic_records').select('student_id').eq('subject', activeSubject).eq('term', form.term).eq('year', Number(form.year)).in('student_id', ids).then(({ data, error: requestError }) => {
      if (!active) return
      if (requestError) setError(requestError.message)
      else setMarkedStudentIds(new Set((data || []).map(row => row.student_id)))
    })
    return () => { active = false }
  }, [activeSubject, classLevel, form.term, form.year, supabase, visible.map(student => student.id).join('|')])

  const save = async event => {
    event.preventDefault(); setError(''); setNotice('')
    if (!assignedLevels.includes(classLevel) || !learner || !activeSubject || !outcome) return setError('Choose your class, a curriculum subject, a learner, and a valid mark.')
    setSaving(true)
    const payload = { student_id: learner.id, subject: activeSubject, score: Number(mark), term_mark: form.percentage === '' ? null : Number(form.percentage), exam_mark: form.exam_mark === '' ? null : Number(form.exam_mark), grade: outcome.grade, term: form.term, year: Number(form.year), comment: form.comment || null }
    const wasSaved = Boolean(recordId)
    const { data, error: requestError } = await supabase.from('academic_records').upsert(payload, { onConflict: 'student_id,subject,term,year' }).select('id').single()
    setSaving(false)
    if (requestError) return setError(requestError.message || 'The mark could not be saved.')
    setRecordId(data?.id || recordId); setMarkedStudentIds(current => new Set([...current, learner.id]))
    setNotice(wasSaved ? `${activeSubject} mark updated.` : `${activeSubject} mark saved.`)
  }

  if (loading) return <section className="grade-entry-v2"><p>Loading your Junior class…</p></section>
  const markedCount = visible.filter(student => markedStudentIds.has(student.id)).length
  const progress = visible.length ? Math.round((markedCount / visible.length) * 100) : 0

  return <section className="grade-entry grade-entry-v2">
    <header className="grade-entry-heading"><p className="eyebrow">Junior class markbook</p><h1>Enter class marks</h1><p>Choose one of your assigned classes and any subject from its Junior curriculum. Saved marks remain editable.</p></header>
    {error && <PortalNotice tone="error">{error}</PortalNotice>}{notice && <PortalNotice>{notice}</PortalNotice>}
    {!assignedLevels.length && <PortalNotice tone="error">No Junior class has been assigned to your account yet. Ask the Main Admin to assign your class first.</PortalNotice>}
    <form className="grade-workspace" onSubmit={save}>
      <section className="grade-filterbar" aria-label="Junior markbook filters">
        <label>Class<select value={classLevel} onChange={event => setClassLevel(event.target.value)} disabled={!assignedLevels.length}><option value="">Choose class</option>{assignedLevels.map(level => <option key={level}>{level}</option>)}</select></label>
        <label>Subject<select value={activeSubject} onChange={change('subject')} disabled={!classLevel}><option value="">Choose subject</option>{subjects.map(subject => <option key={subject}>{subject}</option>)}</select></label>
        <label>Learner<select value={studentId} onChange={event => setStudentId(event.target.value)} disabled={!activeSubject}><option value="">Select a learner</option>{visible.map(student => <option key={student.id} value={student.id}>{student.full_name} — {student.admission_number}</option>)}</select></label>
        <label>Term<select value={form.term} onChange={change('term')}><option value="1">Term 1</option><option value="2">Term 2</option><option value="3">Term 3</option></select></label>
        <label>Year<input type="number" min="2020" value={form.year} onChange={change('year')} /></label>
      </section>
      {learner && <div className="learner-summary"><strong>{learner.full_name}</strong><span>{learner.admission_number}</span><span>{learner.class_level}</span></div>}
      <div className="grade-main-grid"><section className="grade-form-card"><header className="grade-form-card-heading"><div><h2>{recordId ? 'Edit saved mark' : 'New mark'}</h2><p>Exam mark overrides the term mark when provided.</p></div>{outcome && <b>Grade {outcome.grade}</b>}</header><div className="grade-fields-v2"><label>Subject<input readOnly value={activeSubject} placeholder="Choose subject" /></label><label>Term mark (%)<input required type="number" min="0" max="100" value={form.percentage} onChange={change('percentage')} disabled={loadingRecord || !learner} /></label><label>Grade / unit<input readOnly value={outcome?.grade || ''} placeholder="Calculated" /></label><label>Possible mark<input readOnly value="100" /></label><label>Exam mark (%)<input type="number" min="0" max="100" placeholder="Optional" value={form.exam_mark} onChange={change('exam_mark')} disabled={loadingRecord || !learner} /></label><label>Points<input readOnly value={outcome?.points || ''} placeholder="Calculated" /></label><label className="wide">Teacher’s comment<textarea value={form.comment} onChange={change('comment')} disabled={loadingRecord || !learner} placeholder="Add constructive feedback, strengths, or next steps…" /></label></div><footer className="grade-form-actions"><p>{loadingRecord ? 'Loading saved mark…' : outcome?.description || 'Enter a mark to preview the calculated grade.'}</p><button className="btn primary" disabled={saving || loadingRecord || !learner || !activeSubject}>{saving ? 'Saving mark…' : recordId ? 'Update mark' : 'Save mark'}</button></footer></section><aside className="subject-progress"><header><span>{activeSubject || 'Subject'} mark progress</span><strong>{markedCount}/{visible.length} learners marked</strong><div className="subject-progress-bar"><i style={{ width: `${progress}%` }} /></div></header><p>{learner ? (recordId ? 'Saved mark can be edited at any time.' : 'No mark saved for this learner yet.') : 'Select a learner to enter a mark.'}</p></aside></div>
    </form>
  </section>
}
