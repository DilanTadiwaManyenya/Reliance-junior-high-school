import { useEffect, useMemo, useState } from 'react'
import { calculateGrade } from '../../utils/GradeCalculator'
import { getJuniorReportBook } from '../../utils/CurriculumData'
import { useAuth } from '../../context/useAuth'
import PortalNotice from './PortalNotice'

const currentTerm = () => String(Math.min(3, Math.floor(new Date().getMonth() / 4) + 1))
const blank = () => ({ subject: '', component: '', developmentArea: '', score: '', possibleMark: '100', paperOneScore: '', paperOnePossible: '50', paperTwoScore: '', paperTwoPossible: '50', rating: '', term: currentTerm(), year: new Date().getFullYear(), comment: '' })

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
  const isGradeThreeSeven = /^Grade [3-7]$/.test(classLevel)
  const subjectOptions = reportBook?.subjects || []
  const selectedSubject = subjectOptions.find(item => item.subject === form.subject)
  const components = selectedSubject?.components || []
  const visible = useMemo(() => students.filter(student => student.class_level === classLevel), [students, classLevel])
  const learner = visible.find(student => student.id === studentId)
  const activeItem = isEcd ? form.developmentArea : isGradeThreeSeven ? form.subject : form.component ? `${form.subject} · ${form.component}` : form.subject
  const percentage = form.score === '' || !Number(form.possibleMark) ? null : (Number(form.score) / Number(form.possibleMark)) * 100
  const combinedPossible = Number(form.paperOnePossible || 0) + Number(form.paperTwoPossible || 0)
  const combinedScore = Number(form.paperOneScore || 0) + Number(form.paperTwoScore || 0)
  const combinedPercentage = combinedPossible ? (combinedScore / combinedPossible) * 100 : null
  const outcome = !isEcd && (isGradeThreeSeven ? combinedPossible === 100 ? calculateGrade(combinedPercentage, learner?.class_level || classLevel) : null : percentage != null ? calculateGrade(percentage, learner?.class_level || classLevel) : null)
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
    setForm(value => ({ ...value, component: '', score: '', possibleMark: '100', paperOneScore: '', paperOnePossible: '50', paperTwoScore: '', paperTwoPossible: '50', rating: '', comment: '' }))
  }, [form.subject, form.developmentArea])

  useEffect(() => {
    setRecordId('')
    setForm(value => ({ ...value, score: '', possibleMark: '100', rating: '', comment: '' }))
  }, [form.component])

  const selectionReady = isEcd ? Boolean(form.developmentArea) : isGradeThreeSeven ? Boolean(form.subject) : Boolean(form.subject && form.component)

  useEffect(() => {
    let active = true
    if (!learner || !selectionReady) { setRecordId(''); return () => { active = false } }
    const loadRecord = async () => {
      setLoadingRecord(true); setError(''); setNotice('')
      const query = isEcd
        ? supabase.from('junior_developmental_ratings').select('id,rating,comment').eq('student_id', learner.id).eq('development_area', form.developmentArea).eq('term', form.term).eq('year', Number(form.year)).maybeSingle()
        : isGradeThreeSeven
          ? supabase.from('junior_component_marks').select('id,component,score,possible_mark,comment').eq('student_id', learner.id).eq('subject', form.subject).in('component', ['Paper 1', 'Paper 2']).eq('term', form.term).eq('year', Number(form.year))
        : supabase.from('junior_component_marks').select('id,score,possible_mark,comment').eq('student_id', learner.id).eq('subject', form.subject).eq('component', form.component).eq('term', form.term).eq('year', Number(form.year)).maybeSingle()
      const { data, error: requestError } = await query
      if (!active) return
      if (requestError) { setError(requestError.message); setLoadingRecord(false); return }
      const paperOne = isGradeThreeSeven ? (data || []).find(row => row.component === 'Paper 1') : null
      const paperTwo = isGradeThreeSeven ? (data || []).find(row => row.component === 'Paper 2') : null
      setRecordId(isGradeThreeSeven ? paperOne?.id || paperTwo?.id || '' : data?.id || '')
      setForm(value => isEcd
        ? { ...value, rating: data?.rating?.toString() || '', comment: data?.comment || '' }
        : isGradeThreeSeven
          ? { ...value, paperOneScore: paperOne?.score ?? '', paperOnePossible: paperOne?.possible_mark ?? '50', paperTwoScore: paperTwo?.score ?? '', paperTwoPossible: paperTwo?.possible_mark ?? '50', comment: paperOne?.comment || paperTwo?.comment || '' }
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
      : isGradeThreeSeven
        ? supabase.from('junior_component_marks').select('student_id,component').eq('subject', form.subject).in('component', ['Paper 1', 'Paper 2']).eq('term', form.term).eq('year', Number(form.year)).in('student_id', ids)
      : supabase.from('junior_component_marks').select('student_id').eq('subject', form.subject).eq('component', form.component).eq('term', form.term).eq('year', Number(form.year)).in('student_id', ids)
    query.then(({ data, error: requestError }) => {
      if (!active) return
      if (requestError) setError(requestError.message)
      else if (isGradeThreeSeven) {
        const complete = new Map()
        ;(data || []).forEach(row => complete.set(row.student_id, (complete.get(row.student_id) || 0) + 1))
        setMarkedStudentIds(new Set([...complete].filter(([, count]) => count === 2).map(([studentId]) => studentId)))
      } else setMarkedStudentIds(new Set((data || []).map(row => row.student_id)))
    })
    return () => { active = false }
  }, [selectionReady, isEcd, form.subject, form.component, form.developmentArea, form.term, form.year, supabase, visible.map(student => student.id).join('|')])

  const save = async event => {
    event.preventDefault(); setError(''); setNotice('')
    if (!assignedLevels.includes(classLevel) || !learner || !selectionReady) return setError('Choose your class, learner, and report-book item first.')
    if (isEcd && !form.rating) return setError('Choose a developmental rating from 1 to 5.')
    if (isGradeThreeSeven) {
      const paperOneValid = form.paperOneScore !== '' && Number(form.paperOnePossible) > 0 && Number(form.paperOneScore) <= Number(form.paperOnePossible)
      const paperTwoValid = form.paperTwoScore !== '' && Number(form.paperTwoPossible) > 0 && Number(form.paperTwoScore) <= Number(form.paperTwoPossible)
      if (!paperOneValid || !paperTwoValid) return setError('Enter a valid score for both papers. A score cannot exceed its possible mark.')
      if (combinedPossible !== 100) return setError('Paper 1 and Paper 2 possible marks must combine to exactly 100.')
    } else if (!isEcd && (form.score === '' || !Number(form.possibleMark) || Number(form.score) > Number(form.possibleMark))) return setError('Enter a valid mark that does not exceed the possible mark.')
    setSaving(true)
    const payload = isEcd
      ? { student_id: learner.id, development_area: form.developmentArea, rating: Number(form.rating), term: form.term, year: Number(form.year), comment: form.comment || null, recorded_by: user?.id || null }
      : isGradeThreeSeven
        ? ['Paper 1', 'Paper 2'].map((component, index) => ({ student_id: learner.id, subject: form.subject, component, score: Number(index ? form.paperTwoScore : form.paperOneScore), possible_mark: Number(index ? form.paperTwoPossible : form.paperOnePossible), term: form.term, year: Number(form.year), comment: form.comment || null, recorded_by: user?.id || null }))
      : { student_id: learner.id, subject: form.subject, component: form.component, score: Number(form.score), possible_mark: Number(form.possibleMark), term: form.term, year: Number(form.year), comment: form.comment || null, recorded_by: user?.id || null }
    const table = isEcd ? 'junior_developmental_ratings' : 'junior_component_marks'
    const onConflict = isEcd ? 'student_id,development_area,term,year' : 'student_id,subject,component,term,year'
    const request = supabase.from(table).upsert(payload, { onConflict }).select('id')
    const { data, error: requestError } = isGradeThreeSeven ? await request : await request.single()
    setSaving(false)
    if (requestError) return setError(requestError.message || 'The report-book entry could not be saved.')
    setRecordId(isGradeThreeSeven ? data?.[0]?.id || recordId : data?.id || recordId); setMarkedStudentIds(current => new Set([...current, learner.id]))
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
        {isEcd ? <label>Development area<select value={form.developmentArea} onChange={change('developmentArea')} disabled={!classLevel}><option value="">Choose area</option>{(reportBook?.areas || []).map(area => <option key={area}>{area}</option>)}</select></label> : <><label>Subject<select value={form.subject} onChange={change('subject')} disabled={!classLevel}><option value="">Choose subject</option>{subjectOptions.map(item => <option key={item.subject}>{item.subject}</option>)}</select></label>{!isGradeThreeSeven && <label>Component<select value={form.component} onChange={change('component')} disabled={!form.subject}><option value="">Choose component</option>{components.map(component => <option key={component}>{component}</option>)}</select></label>}</>}
        <label>Learner<select value={studentId} onChange={event => setStudentId(event.target.value)} disabled={!selectionReady}><option value="">Select a learner</option>{visible.map(student => <option key={student.id} value={student.id}>{student.full_name} — {student.admission_number}</option>)}</select></label>
        <label>Term<select value={form.term} onChange={change('term')}><option value="1">Term 1</option><option value="2">Term 2</option><option value="3">Term 3</option></select></label>
        <label>Year<input type="number" min="2020" value={form.year} onChange={change('year')} /></label>
      </section>
      {learner && <div className="learner-summary"><strong>{learner.full_name}</strong><span>{learner.admission_number}</span><span>{learner.class_level}</span></div>}
      <div className="grade-main-grid"><section className="grade-form-card"><header className="grade-form-card-heading"><div><h2>{recordId ? 'Edit saved entry' : 'New report-book entry'}</h2><p>{isEcd ? 'Use the ECD scale from 1 (Below Average) to 5 (Excellent).' : isGradeThreeSeven ? 'Enter both examination papers together. Their possible marks must add to 100 before the unit is calculated.' : 'Each report-book component is recorded independently.'}</p></div>{isEcd ? form.rating && <b>Rating {form.rating}/5</b> : outcome && <b>Grade {outcome.grade}</b>}</header><div className="grade-fields-v2">{isEcd ? <><label className="wide">Development area<input readOnly value={form.developmentArea} placeholder="Choose an area" /></label><label>Rating<select required value={form.rating} onChange={change('rating')} disabled={loadingRecord || !learner}><option value="">Choose 1–5</option>{[1, 2, 3, 4, 5].map(value => <option key={value} value={value}>{value} — {reportBook.ratingScale[value - 1].replace(/^\d\s*/, '')}</option>)}</select></label></> : isGradeThreeSeven ? <><label className="wide">Subject<input readOnly value={form.subject} placeholder="Choose subject" /></label><div className="combined-paper-card"><div><span>Paper 1</span><label>Score<input required type="number" min="0" max={form.paperOnePossible || undefined} value={form.paperOneScore} onChange={change('paperOneScore')} disabled={loadingRecord || !learner} /></label><label>Out of<input required type="number" min="1" value={form.paperOnePossible} onChange={change('paperOnePossible')} disabled={loadingRecord || !learner} /></label></div><div><span>Paper 2</span><label>Score<input required type="number" min="0" max={form.paperTwoPossible || undefined} value={form.paperTwoScore} onChange={change('paperTwoScore')} disabled={loadingRecord || !learner} /></label><label>Out of<input required type="number" min="1" value={form.paperTwoPossible} onChange={change('paperTwoPossible')} disabled={loadingRecord || !learner} /></label></div><aside><span>Combined result</span><strong>{combinedScore || '—'} / {combinedPossible || '—'}</strong><small>{combinedPossible === 100 ? outcome ? `Grade ${outcome.grade}` : 'Enter both scores' : 'Possible marks must total 100'}</small></aside></div><p className={`paper-total-note ${combinedPossible === 100 ? 'ready' : ''}`}>Paper 1 + Paper 2 possible marks: <strong>{combinedPossible}/100</strong>. Use any split that totals 100, such as 50 + 50 or 40 + 60.</p></> : <><label>Subject<input readOnly value={form.subject} placeholder="Choose subject" /></label><label>Component<input readOnly value={form.component} placeholder="Choose component" /></label><label>Mark<input required type="number" min="0" max={form.possibleMark || undefined} value={form.score} onChange={change('score')} disabled={loadingRecord || !learner} /></label><label>Possible mark<input required type="number" min="1" value={form.possibleMark} onChange={change('possibleMark')} disabled={loadingRecord || !learner} /></label><label>Grade / unit<input readOnly value={outcome?.grade || ''} placeholder="Calculated" /></label></>}<label className="wide">Teacher’s comment<textarea value={form.comment} onChange={change('comment')} disabled={loadingRecord || !learner} placeholder="Add constructive feedback, strengths, or next steps…" /></label></div><footer className="grade-form-actions"><p>{loadingRecord ? 'Loading saved entry…' : isEcd ? 'Each rating will appear in the ECD report book.' : isGradeThreeSeven ? combinedPossible === 100 ? outcome?.description || 'Both papers will be saved together.' : 'Set the two possible marks to a combined total of 100.' : outcome?.description || 'Enter a mark to preview the calculated grade.'}</p><button className="btn primary" disabled={saving || loadingRecord || !learner || !selectionReady}>{saving ? 'Saving…' : recordId ? 'Update entry' : 'Save entry'}</button></footer></section><aside className="subject-progress"><header><span>{activeItem || (isEcd ? 'Development area' : 'Component')} progress</span><strong>{markedCount}/{visible.length} learners recorded</strong><div className="subject-progress-bar"><i style={{ width: `${progress}%` }} /></div></header><p>{learner ? (recordId ? 'Saved entry can be edited at any time.' : 'No entry saved for this learner yet.') : 'Select a learner to enter a report-book value.'}</p></aside></div>
    </form>
  </section>
}
