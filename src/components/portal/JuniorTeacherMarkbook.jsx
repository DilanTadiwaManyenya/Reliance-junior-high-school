import { useEffect, useMemo, useState } from 'react'
import { calculateGrade } from '../../utils/GradeCalculator'
import { getJuniorReportBook } from '../../utils/CurriculumData'
import { useAuth } from '../../context/useAuth'
import PortalNotice from './PortalNotice'

const currentTerm = () => String(Math.min(3, Math.floor(new Date().getMonth() / 4) + 1))
const blank = () => ({ subject: '', component: '', developmentArea: '', score: '', possibleMark: '100', rating: '', term: currentTerm(), year: new Date().getFullYear(), comment: '' })

export default function JuniorTeacherMarkbook() {
  const { supabase, profile, user } = useAuth()
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
  const reportBook = useMemo(() => getJuniorReportBook(classLevel), [classLevel])
  const isEcd = reportBook?.type === 'developmental-ratings'
  const subjectOptions = reportBook?.subjects || []
  const selectedSubject = subjectOptions.find(item => item.subject === form.subject)
  const components = selectedSubject?.components || []
  const visible = useMemo(() => students.filter(student => student.class_level === classLevel), [students, classLevel])
  const learner = visible.find(student => student.id === studentId)
  const activeItem = isEcd ? form.developmentArea : form.component ? `${form.subject} · ${form.component}` : form.subject
  const percentage = form.score === '' || !Number(form.possibleMark) ? null : (Number(form.score) / Number(form.possibleMark)) * 100
  const outcome = !isEcd && percentage != null ? calculateGrade(percentage, learner?.class_level || classLevel) : null
  const change = field => event => setForm(value => ({ ...value, [field]: event.target.value }))

  useEffect(() => {
    if (!classLevel && assignedLevels.length) setClassLevel(assignedLevels[0])
  }, [assignedLevels, classLevel])

  useEffect(() => {
    let active = true
    supabase.from('students').select('id,full_name,admission_number,class_level,class_stream,status').eq('status', 'active').order('full_name').then(({ data, error: requestError }) => {
      if (!active) return
      setStudents((data || []).filter(student => assignedLevels.includes(student.class_level)))
      setError(requestError ? 'Unable to load learners in your assigned Junior class.' : '')
      setLoading(false)
    })
    return () => { active = false }
  }, [supabase, assignedLevels.join('|')])

  useEffect(() => {
    setStudentId(''); setRecordId(''); setMarkedStudentIds(new Set())
    setForm(value => ({ ...blank(), term: value.term, year: value.year }))
  }, [classLevel])

  useEffect(() => {
    setRecordId('')
    setForm(value => ({ ...value, component: '', score: '', possibleMark: '100', rating: '', comment: '' }))
  }, [form.subject, form.developmentArea])

  useEffect(() => {
    setRecordId('')
    setForm(value => ({ ...value, score: '', possibleMark: '100', rating: '', comment: '' }))
  }, [form.component])

  const selectionReady = isEcd ? Boolean(form.developmentArea) : Boolean(form.subject && form.component)

  useEffect(() => {
    let active = true
    if (!learner || !selectionReady) { setRecordId(''); return () => { active = false } }
    const loadRecord = async () => {
      setLoadingRecord(true); setError(''); setNotice('')
      const query = isEcd
        ? supabase.from('junior_developmental_ratings').select('id,rating,comment').eq('student_id', learner.id).eq('development_area', form.developmentArea).eq('term', form.term).eq('year', Number(form.year)).maybeSingle()
        : supabase.from('junior_component_marks').select('id,score,possible_mark,comment').eq('student_id', learner.id).eq('subject', form.subject).eq('component', form.component).eq('term', form.term).eq('year', Number(form.year)).maybeSingle()
      const { data, error: requestError } = await query
      if (!active) return
      if (requestError) { setError(requestError.message); setLoadingRecord(false); return }
      setRecordId(data?.id || '')
      setForm(value => isEcd
        ? { ...value, rating: data?.rating?.toString() || '', comment: data?.comment || '' }
        : { ...value, score: data?.score ?? '', possibleMark: data?.possible_mark ?? '100', comment: data?.comment || '' })
      setLoadingRecord(false)
    }
    loadRecord()
    return () => { active = false }
  }, [learner, selectionReady, isEcd, form.subject, form.component, form.developmentArea, form.term, form.year, supabase])

  useEffect(() => {
    let active = true
    const ids = visible.map(student => student.id)
    if (!selectionReady || !ids.length) { setMarkedStudentIds(new Set()); return () => { active = false } }
    const query = isEcd
      ? supabase.from('junior_developmental_ratings').select('student_id').eq('development_area', form.developmentArea).eq('term', form.term).eq('year', Number(form.year)).in('student_id', ids)
      : supabase.from('junior_component_marks').select('student_id').eq('subject', form.subject).eq('component', form.component).eq('term', form.term).eq('year', Number(form.year)).in('student_id', ids)
    query.then(({ data, error: requestError }) => {
      if (!active) return
      if (requestError) setError(requestError.message)
      else setMarkedStudentIds(new Set((data || []).map(row => row.student_id)))
    })
    return () => { active = false }
  }, [selectionReady, isEcd, form.subject, form.component, form.developmentArea, form.term, form.year, supabase, visible.map(student => student.id).join('|')])

  const save = async event => {
    event.preventDefault(); setError(''); setNotice('')
    if (!assignedLevels.includes(classLevel) || !learner || !selectionReady) return setError('Choose your class, learner, and report-book item first.')
    if (isEcd && !form.rating) return setError('Choose a developmental rating from 1 to 5.')
    if (!isEcd && (form.score === '' || !Number(form.possibleMark) || Number(form.score) > Number(form.possibleMark))) return setError('Enter a valid mark that does not exceed the possible mark.')
    setSaving(true)
    const payload = isEcd
      ? { student_id: learner.id, development_area: form.developmentArea, rating: Number(form.rating), term: form.term, year: Number(form.year), comment: form.comment || null, recorded_by: user?.id || null }
      : { student_id: learner.id, subject: form.subject, component: form.component, score: Number(form.score), possible_mark: Number(form.possibleMark), term: form.term, year: Number(form.year), comment: form.comment || null, recorded_by: user?.id || null }
    const table = isEcd ? 'junior_developmental_ratings' : 'junior_component_marks'
    const onConflict = isEcd ? 'student_id,development_area,term,year' : 'student_id,subject,component,term,year'
    const { data, error: requestError } = await supabase.from(table).upsert(payload, { onConflict }).select('id').single()
    setSaving(false)
    if (requestError) return setError(requestError.message || 'The report-book entry could not be saved.')
    setRecordId(data?.id || recordId); setMarkedStudentIds(current => new Set([...current, learner.id]))
    setNotice(recordId ? `${activeItem} updated.` : `${activeItem} saved.`)
  }

  if (loading) return <section className="grade-entry-v2"><p>Loading your Junior class…</p></section>
  const markedCount = visible.filter(student => markedStudentIds.has(student.id)).length
  const progress = visible.length ? Math.round((markedCount / visible.length) * 100) : 0
  const heading = isEcd ? 'Enter developmental ratings' : 'Enter component marks'
  const description = isEcd ? 'Record the 1–5 development ratings required by the ECD report book. Saved ratings remain editable.' : 'Choose a report-book subject and component for your assigned class. Saved marks remain editable.'

  return <section className="grade-entry grade-entry-v2">
    <header className="grade-entry-heading"><p className="eyebrow">Junior class markbook</p><h1>{heading}</h1><p>{description}</p></header>
    {error && <PortalNotice tone="error">{error}</PortalNotice>}{notice && <PortalNotice>{notice}</PortalNotice>}
    {!assignedLevels.length && <PortalNotice tone="error">No Junior class has been assigned to your account yet. Ask the Main Admin to assign your class first.</PortalNotice>}
    <form className="grade-workspace" onSubmit={save}>
      <section className="grade-filterbar" aria-label="Junior markbook filters">
        <label>Class<select value={classLevel} onChange={event => setClassLevel(event.target.value)} disabled={!assignedLevels.length}><option value="">Choose class</option>{assignedLevels.map(level => <option key={level}>{level}</option>)}</select></label>
        {isEcd ? <label>Development area<select value={form.developmentArea} onChange={change('developmentArea')} disabled={!classLevel}><option value="">Choose area</option>{(reportBook?.areas || []).map(area => <option key={area}>{area}</option>)}</select></label> : <><label>Subject<select value={form.subject} onChange={change('subject')} disabled={!classLevel}><option value="">Choose subject</option>{subjectOptions.map(item => <option key={item.subject}>{item.subject}</option>)}</select></label><label>Component<select value={form.component} onChange={change('component')} disabled={!form.subject}><option value="">Choose component</option>{components.map(component => <option key={component}>{component}</option>)}</select></label></>}
        <label>Learner<select value={studentId} onChange={event => setStudentId(event.target.value)} disabled={!selectionReady}><option value="">Select a learner</option>{visible.map(student => <option key={student.id} value={student.id}>{student.full_name} — {student.admission_number}</option>)}</select></label>
        <label>Term<select value={form.term} onChange={change('term')}><option value="1">Term 1</option><option value="2">Term 2</option><option value="3">Term 3</option></select></label>
        <label>Year<input type="number" min="2020" value={form.year} onChange={change('year')} /></label>
      </section>
      {learner && <div className="learner-summary"><strong>{learner.full_name}</strong><span>{learner.admission_number}</span><span>{learner.class_level}</span></div>}
      <div className="grade-main-grid"><section className="grade-form-card"><header className="grade-form-card-heading"><div><h2>{recordId ? 'Edit saved entry' : 'New report-book entry'}</h2><p>{isEcd ? 'Use the ECD scale from 1 (Below Average) to 5 (Excellent).' : 'Each paper and project is recorded independently for the report book.'}</p></div>{isEcd ? form.rating && <b>Rating {form.rating}/5</b> : outcome && <b>Grade {outcome.grade}</b>}</header><div className="grade-fields-v2">{isEcd ? <><label className="wide">Development area<input readOnly value={form.developmentArea} placeholder="Choose an area" /></label><label>Rating<select required value={form.rating} onChange={change('rating')} disabled={loadingRecord || !learner}><option value="">Choose 1–5</option>{[1, 2, 3, 4, 5].map(value => <option key={value} value={value}>{value} — {reportBook.ratingScale[value - 1].replace(/^\d\s*/, '')}</option>)}</select></label></> : <><label>Subject<input readOnly value={form.subject} placeholder="Choose subject" /></label><label>Component<input readOnly value={form.component} placeholder="Choose component" /></label><label>Mark<input required type="number" min="0" max={form.possibleMark || undefined} value={form.score} onChange={change('score')} disabled={loadingRecord || !learner} /></label><label>Possible mark<input required type="number" min="1" value={form.possibleMark} onChange={change('possibleMark')} disabled={loadingRecord || !learner} /></label><label>Grade / unit<input readOnly value={outcome?.grade || ''} placeholder="Calculated" /></label></>}<label className="wide">Teacher’s comment<textarea value={form.comment} onChange={change('comment')} disabled={loadingRecord || !learner} placeholder="Add constructive feedback, strengths, or next steps…" /></label></div><footer className="grade-form-actions"><p>{loadingRecord ? 'Loading saved entry…' : isEcd ? 'Each rating will appear in the ECD report book.' : outcome?.description || 'Enter a mark to preview the calculated grade.'}</p><button className="btn primary" disabled={saving || loadingRecord || !learner || !selectionReady}>{saving ? 'Saving…' : recordId ? 'Update entry' : 'Save entry'}</button></footer></section><aside className="subject-progress"><header><span>{activeItem || (isEcd ? 'Development area' : 'Component')} progress</span><strong>{markedCount}/{visible.length} learners recorded</strong><div className="subject-progress-bar"><i style={{ width: `${progress}%` }} /></div></header><p>{learner ? (recordId ? 'Saved entry can be edited at any time.' : 'No entry saved for this learner yet.') : 'Select a learner to enter a report-book value.'}</p></aside></div>
    </form>
  </section>
}
