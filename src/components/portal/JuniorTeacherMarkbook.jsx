import { useEffect, useMemo, useRef, useState } from 'react'
import { calculateGrade } from '../../utils/GradeCalculator'
import { getJuniorReportBook } from '../../utils/CurriculumData'
import { useAuth } from '../../context/useAuth'
import PortalNotice from './PortalNotice'

const currentTerm = () => String(Math.min(3, Math.floor(new Date().getMonth() / 4) + 1))
const blank = () => ({ subject: '', component: '', developmentArea: '', score: '', possibleMark: '100', paperOneScore: '', paperOnePossible: '50', paperTwoScore: '', paperTwoPossible: '50', projectScore: '', projectPossible: '20', componentScores: {}, rating: '', term: currentTerm(), year: new Date().getFullYear(), comment: '' })

export default function JuniorTeacherMarkbook() {
  const { supabase, profile, user } = useAuth()
  const assignedClasses = useMemo(() => (profile?.teacher_class_assignments || [])
    .filter(assignment => /^Grade [1-7]$|^ECD [AB]$/.test(assignment.class_level))
    .map(assignment => ({
      level: assignment.class_level,
      stream: assignment.class_stream || '',
    })), [profile?.teacher_class_assignments])
  const assignedLevels = useMemo(() => [...new Set(assignedClasses.map(assignment => assignment.level))], [assignedClasses])
  const [classLevel, setClassLevel] = useState('')
  const [students, setStudents] = useState([])
  const [studentId, setStudentId] = useState('')
  const [form, setForm] = useState(blank)
  const [ecdRatings, setEcdRatings] = useState({})
  const [recordId, setRecordId] = useState('')
  const [markedStudentIds, setMarkedStudentIds] = useState(() => new Set())
  const [loading, setLoading] = useState(true)
  const [loadingRecord, setLoadingRecord] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [showRecordedMarks, setShowRecordedMarks] = useState(false)
  const recordedMarksRef = useRef(null)
  const openRecordedMarks = () => {
    setShowRecordedMarks(true)
    requestAnimationFrame(() => recordedMarksRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))
  }
  const reportBook = useMemo(() => getJuniorReportBook(classLevel), [classLevel])
  const isEcd = reportBook?.type === 'developmental-ratings'
  const isGradeThreeSeven = /^Grade [3-7]$/.test(classLevel)
  const isGradeOneTwo = /^Grade [12]$/.test(classLevel)
  const subjectOptions = reportBook?.subjects || []
  const selectedSubject = subjectOptions.find(item => item.subject === form.subject)
  const components = selectedSubject?.components || []
  const gradeOneTwoAssessmentPossible = components.filter(component => component !== 'Project').reduce((total, component) => total + Number(form.componentScores[component]?.possible || 0), 0)
  const visible = useMemo(() => students.filter(student => student.class_level === classLevel), [students, classLevel])
  const learner = visible.find(student => student.id === studentId)
  const activeItem = isEcd ? 'ECD developmental checklist' : isGradeThreeSeven || isGradeOneTwo ? form.subject : form.component ? `${form.subject} · ${form.component}` : form.subject
  const percentage = form.score === '' || !Number(form.possibleMark) ? null : (Number(form.score) / Number(form.possibleMark)) * 100
  const combinedPossible = Number(form.paperOnePossible || 0) + Number(form.paperTwoPossible || 0)
  const combinedScore = Number(form.paperOneScore || 0) + Number(form.paperTwoScore || 0)
  const combinedPercentage = combinedPossible ? (combinedScore / combinedPossible) * 100 : null
  const outcome = !isEcd && !isGradeOneTwo && (isGradeThreeSeven ? combinedPossible === 100 ? calculateGrade(combinedPercentage, learner?.class_level || classLevel) : null : percentage != null ? calculateGrade(percentage, learner?.class_level || classLevel) : null)
  const change = field => event => setForm(value => ({ ...value, [field]: event.target.value }))

  useEffect(() => {
    if (!classLevel && assignedLevels.length) setClassLevel(assignedLevels[0])
  }, [assignedLevels, classLevel])

  useEffect(() => {
    let active = true
    supabase.from('students').select('id,full_name,admission_number,class_level,class_stream,status').eq('status', 'active').eq('campus', 'junior').order('full_name').then(({ data, error: requestError }) => {
      if (!active) return
      setStudents((data || []).filter(student => assignedClasses.some(assignment => assignment.level === student.class_level && assignment.stream === (student.class_stream || ''))))
      setError(requestError ? 'Unable to load learners in your assigned Junior class.' : '')
      setLoading(false)
    })
    return () => { active = false }
  }, [supabase, assignedClasses.map(assignment => `${assignment.level}:${assignment.stream}`).join('|')])

  useEffect(() => {
    setStudentId(''); setRecordId(''); setMarkedStudentIds(new Set()); setEcdRatings({}); setShowRecordedMarks(false)
    setForm(value => ({ ...blank(), term: value.term, year: value.year }))
  }, [classLevel])

  useEffect(() => {
    setRecordId('')
    setShowRecordedMarks(false)
    setForm(value => ({ ...value, component: '', score: '', possibleMark: '100', paperOneScore: '', paperOnePossible: '50', paperTwoScore: '', paperTwoPossible: '50', projectScore: '', projectPossible: '20', componentScores: isGradeOneTwo ? { Project: { score: '', possible: '20' } } : {}, rating: '', comment: '' }))
  }, [form.subject, form.developmentArea, isGradeOneTwo])

  useEffect(() => {
    setRecordId('')
    setForm(value => ({ ...value, score: '', possibleMark: '100', rating: '', comment: '' }))
  }, [form.component])

  const selectionReady = isEcd ? Boolean(classLevel) : isGradeThreeSeven || isGradeOneTwo ? Boolean(form.subject) : Boolean(form.subject && form.component)

  useEffect(() => {
    let active = true
    if (!learner || !selectionReady) { setRecordId(''); return () => { active = false } }
    const loadRecord = async () => {
      setLoadingRecord(true); setError(''); setNotice('')
      const query = isEcd
        ? supabase.from('junior_developmental_ratings').select('id,development_area,rating,comment').eq('student_id', learner.id).in('development_area', reportBook?.areas || []).eq('term', form.term).eq('year', Number(form.year))
        : isGradeThreeSeven
          ? supabase.from('junior_component_marks').select('id,component,score,possible_mark,comment').eq('student_id', learner.id).eq('subject', form.subject).in('component', ['Paper 1', 'Paper 2', 'Project']).eq('term', form.term).eq('year', Number(form.year))
          : isGradeOneTwo
            ? supabase.from('junior_component_marks').select('id,component,score,possible_mark,comment').eq('student_id', learner.id).eq('subject', form.subject).in('component', components).eq('term', form.term).eq('year', Number(form.year))
        : supabase.from('junior_component_marks').select('id,score,possible_mark,comment').eq('student_id', learner.id).eq('subject', form.subject).eq('component', form.component).eq('term', form.term).eq('year', Number(form.year)).maybeSingle()
      const { data, error: requestError } = await query
      if (!active) return
      if (requestError) { setError(requestError.message); setLoadingRecord(false); return }
      const paperOne = isGradeThreeSeven ? (data || []).find(row => row.component === 'Paper 1') : null
      const paperTwo = isGradeThreeSeven ? (data || []).find(row => row.component === 'Paper 2') : null
      const project = isGradeThreeSeven ? (data || []).find(row => row.component === 'Project') : null
      const savedComponents = isGradeOneTwo ? Object.fromEntries((data || []).map(row => [row.component, { score: row.score ?? '', possible: row.possible_mark ?? '' }])) : {}
      const savedRatings = isEcd ? Object.fromEntries((data || []).map(row => [row.development_area, row.rating?.toString() || ''])) : {}
      setRecordId(isGradeThreeSeven ? paperOne?.id || paperTwo?.id || '' : isGradeOneTwo || isEcd ? data?.[0]?.id || '' : data?.id || '')
      setShowRecordedMarks(false)
      setForm(value => isEcd
        ? { ...value, comment: data?.[0]?.comment || '' }
        : isGradeThreeSeven
          ? { ...value, paperOneScore: paperOne?.score ?? '', paperOnePossible: paperOne?.possible_mark ?? '50', paperTwoScore: paperTwo?.score ?? '', paperTwoPossible: paperTwo?.possible_mark ?? '50', projectScore: project?.score ?? '', projectPossible: project?.possible_mark ?? '20', comment: paperOne?.comment || paperTwo?.comment || project?.comment || '' }
          : isGradeOneTwo
            ? { ...value, componentScores: savedComponents, comment: data?.[0]?.comment || '' }
        : { ...value, score: data?.score ?? '', possibleMark: data?.possible_mark ?? '100', comment: data?.comment || '' })
      if (isEcd) setEcdRatings(savedRatings)
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
      ? supabase.from('junior_developmental_ratings').select('student_id,development_area').in('development_area', reportBook?.areas || []).eq('term', form.term).eq('year', Number(form.year)).in('student_id', ids)
      : isGradeThreeSeven
        ? supabase.from('junior_component_marks').select('student_id,component').eq('subject', form.subject).in('component', ['Paper 1', 'Paper 2']).eq('term', form.term).eq('year', Number(form.year)).in('student_id', ids)
        : isGradeOneTwo
          ? supabase.from('junior_component_marks').select('student_id,component').eq('subject', form.subject).in('component', components).eq('term', form.term).eq('year', Number(form.year)).in('student_id', ids)
      : supabase.from('junior_component_marks').select('student_id').eq('subject', form.subject).eq('component', form.component).eq('term', form.term).eq('year', Number(form.year)).in('student_id', ids)
    query.then(({ data, error: requestError }) => {
      if (!active) return
      if (requestError) setError(requestError.message)
      else if (isEcd || isGradeThreeSeven || isGradeOneTwo) {
        const complete = new Map()
        ;(data || []).forEach(row => complete.set(row.student_id, (complete.get(row.student_id) || 0) + 1))
        const requiredCount = isEcd ? (reportBook?.areas || []).length : isGradeThreeSeven ? 2 : components.length
        setMarkedStudentIds(new Set([...complete].filter(([, count]) => count === requiredCount).map(([studentId]) => studentId)))
      } else setMarkedStudentIds(new Set((data || []).map(row => row.student_id)))
    })
    return () => { active = false }
  }, [selectionReady, isEcd, form.subject, form.component, form.developmentArea, form.term, form.year, supabase, visible.map(student => student.id).join('|')])

  const save = async event => {
    event.preventDefault(); setError(''); setNotice('')
    if (!assignedLevels.includes(classLevel) || !learner || !selectionReady) return setError('Choose your class, learner, and report-book item first.')
    if (isEcd && !(reportBook?.areas || []).every(area => ecdRatings[area])) return setError('Tick a developmental rating from 1 to 5 for every area.')
    if (isGradeThreeSeven) {
      const paperOneValid = form.paperOneScore !== '' && Number(form.paperOnePossible) > 0 && Number(form.paperOneScore) <= Number(form.paperOnePossible)
      const paperTwoValid = form.paperTwoScore !== '' && Number(form.paperTwoPossible) > 0 && Number(form.paperTwoScore) <= Number(form.paperTwoPossible)
      if (!paperOneValid || !paperTwoValid) return setError('Enter a valid score for both papers. A score cannot exceed its possible mark.')
      if (combinedPossible !== 100) return setError('Paper 1 and Paper 2 possible marks must combine to exactly 100.')
      if (form.projectScore !== '' && (Number(form.projectScore) < 0 || Number(form.projectScore) > 20)) return setError('Project must be a mark from 0 to 20.')
    } else if (isGradeOneTwo) {
      const assessmentComponents = components.filter(component => component !== 'Project')
      const assessmentEntries = assessmentComponents.map(component => form.componentScores[component] || {})
      const projectEntry = form.componentScores.Project || {}
      const assessmentValid = assessmentEntries.every(entry => entry.score !== '' && Number(entry.possible) > 0 && Number(entry.score) <= Number(entry.possible))
      const assessmentPossible = assessmentEntries.reduce((total, entry) => total + Number(entry.possible || 0), 0)
      const projectValid = projectEntry.score !== '' && Number(projectEntry.possible) === 20 && Number(projectEntry.score) >= 0 && Number(projectEntry.score) <= 20
      if (!assessmentValid || !projectValid) return setError('Enter valid marks for every assessment component and a project mark out of 20.')
      if (assessmentPossible !== 50) return setError('The assessment components for this subject must combine to exactly 50. Project is separate out of 20.')
    } else if (!isEcd && (form.score === '' || !Number(form.possibleMark) || Number(form.score) > Number(form.possibleMark))) return setError('Enter a valid mark that does not exceed the possible mark.')
    setSaving(true)
    const payload = isEcd
      ? (reportBook?.areas || []).map(development_area => ({ student_id: learner.id, development_area, rating: Number(ecdRatings[development_area]), term: form.term, year: Number(form.year), comment: form.comment || null, recorded_by: user?.id || null }))
      : isGradeThreeSeven
        ? [...['Paper 1', 'Paper 2'].map((component, index) => ({ student_id: learner.id, subject: form.subject, component, score: Number(index ? form.paperTwoScore : form.paperOneScore), possible_mark: Number(index ? form.paperTwoPossible : form.paperOnePossible), term: form.term, year: Number(form.year), comment: form.comment || null, recorded_by: user?.id || null })), ...(form.projectScore === '' ? [] : [{ student_id: learner.id, subject: form.subject, component: 'Project', score: Number(form.projectScore), possible_mark: 20, term: form.term, year: Number(form.year), comment: form.comment || null, recorded_by: user?.id || null }])]
        : isGradeOneTwo
          ? components.map(component => ({ student_id: learner.id, subject: form.subject, component, score: Number(form.componentScores[component]?.score), possible_mark: Number(form.componentScores[component]?.possible), term: form.term, year: Number(form.year), comment: form.comment || null, recorded_by: user?.id || null }))
      : { student_id: learner.id, subject: form.subject, component: form.component, score: Number(form.score), possible_mark: Number(form.possibleMark), term: form.term, year: Number(form.year), comment: form.comment || null, recorded_by: user?.id || null }
    const table = isEcd ? 'junior_developmental_ratings' : 'junior_component_marks'
    const onConflict = isEcd ? 'student_id,development_area,term,year' : 'student_id,subject,component,term,year'
    const request = supabase.from(table).upsert(payload, { onConflict }).select('id')
    const { data, error: requestError } = isEcd || isGradeThreeSeven || isGradeOneTwo ? await request : await request.single()
    setSaving(false)
    if (requestError) return setError(requestError.message || 'The report-book entry could not be saved.')
    setRecordId(isEcd || isGradeThreeSeven || isGradeOneTwo ? data?.[0]?.id || recordId : data?.id || recordId); setMarkedStudentIds(current => new Set([...current, learner.id]))
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
        {isEcd ? <div className="ecd-filter-note"><strong>ECD checklist</strong><span>Select a learner, then tick one rating for each development area.</span></div> : <><label>Subject<select value={form.subject} onChange={change('subject')} disabled={!classLevel}><option value="">Choose subject</option>{subjectOptions.map(item => <option key={item.subject}>{item.subject}</option>)}</select></label>{!isGradeThreeSeven && !isGradeOneTwo && <label>Component<select value={form.component} onChange={change('component')} disabled={!form.subject}><option value="">Choose component</option>{components.map(component => <option key={component}>{component}</option>)}</select></label>}</>}
        <label>Learner<select value={studentId} onChange={event => setStudentId(event.target.value)} disabled={!selectionReady}><option value="">Select a learner</option>{visible.map(student => <option key={student.id} value={student.id}>{student.full_name} — {student.admission_number}</option>)}</select></label>
        <label>Term<select value={form.term} onChange={change('term')}><option value="1">Term 1</option><option value="2">Term 2</option><option value="3">Term 3</option></select></label>
        <label>Year<input type="number" min="2020" value={form.year} onChange={change('year')} /></label>
      </section>
      {learner && <div className="learner-summary"><strong>{learner.full_name}</strong><span>{learner.admission_number}</span><span>{learner.class_level}</span></div>}
      {learner && isGradeOneTwo && <p className={`paper-total-note grade-one-two-total ${gradeOneTwoAssessmentPossible === 50 ? 'ready' : ''}`}>Assessment components: <strong>{gradeOneTwoAssessmentPossible}/50</strong>. Project is a separate mark out of 20 and is not part of this total.</p>}
      {learner && isGradeThreeSeven && <section className="project-entry-card"><div><strong>Project mark</strong><span>Record the project separately out of 20. It never changes the Paper 1 + Paper 2 total of 100 or the calculated grade.</span></div><label>Project score<input type="number" min="0" max="20" value={form.projectScore} onChange={change('projectScore')} disabled={loadingRecord} placeholder="Optional" /></label><label>Out of<input readOnly value="20" /></label></section>}
      <div className="grade-main-grid"><section className="grade-form-card"><header className="grade-form-card-heading"><div><h2>{recordId ? 'Edit saved entry' : 'New report-book entry'}</h2><p>{isEcd ? 'Tick one rating in every row. This completes the learner’s ECD developmental checklist in one clear step.' : isGradeThreeSeven ? 'Enter both examination papers together. Their possible marks must add to 100 before the mark is recorded.' : isGradeOneTwo ? 'Enter all subject components together. Their possible marks must add to 50; Grade 1 and 2 reports do not use units.' : 'Each report-book component is recorded independently.'}</p></div></header><div className="grade-fields-v2">{isEcd ? <><div className="ecd-rating-grid"><div className="ecd-rating-head"><span>Development area</span>{[1, 2, 3, 4, 5].map(value => <span key={value}>{value}</span>)}</div>{(reportBook?.areas || []).map(area => <div className="ecd-rating-row" key={area}><strong>{area}</strong>{[1, 2, 3, 4, 5].map(value => <label key={value} title={reportBook.ratingScale[value - 1]}><input type="radio" name={`ecd-${area}`} checked={ecdRatings[area] === String(value)} onChange={() => setEcdRatings(current => ({ ...current, [area]: String(value) }))} disabled={loadingRecord || !learner} /><span className="sr-only">{value}</span></label>)}</div>)}</div><p className={`paper-total-note ${Object.keys(ecdRatings).length === (reportBook?.areas || []).length ? 'ready' : ''}`}>Checklist complete: <strong>{Object.keys(ecdRatings).filter(area => ecdRatings[area]).length}/{(reportBook?.areas || []).length}</strong> areas rated.</p></> : isGradeThreeSeven ? <><label className="wide">Subject<input readOnly value={form.subject} placeholder="Choose subject" /></label><div className="combined-paper-card"><div><span>Paper 1</span><label>Score<input required type="number" min="0" max={form.paperOnePossible || undefined} value={form.paperOneScore} onChange={change('paperOneScore')} disabled={loadingRecord || !learner} /></label><label>Out of<input required type="number" min="1" value={form.paperOnePossible} onChange={change('paperOnePossible')} disabled={loadingRecord || !learner} /></label></div><div><span>Paper 2</span><label>Score<input required type="number" min="0" max={form.paperTwoPossible || undefined} value={form.paperTwoScore} onChange={change('paperTwoScore')} disabled={loadingRecord || !learner} /></label><label>Out of<input required type="number" min="1" value={form.paperTwoPossible} onChange={change('paperTwoPossible')} disabled={loadingRecord || !learner} /></label></div><aside><span>Combined mark</span><strong>{combinedScore || '—'} / {combinedPossible || '—'}</strong><small>{combinedPossible === 100 ? 'Ready to save' : 'Possible marks must total 100'}</small></aside></div><p className={`paper-total-note ${combinedPossible === 100 ? 'ready' : ''}`}>Paper 1 + Paper 2 possible marks: <strong>{combinedPossible}/100</strong>. Use any split that totals 100, such as 50 + 50 or 40 + 60.</p></> : isGradeOneTwo ? <><label className="wide">Subject<input readOnly value={form.subject} placeholder="Choose subject" /></label><div className="component-total-grid">{components.map(component => <div key={component}><strong>{component}</strong><label>Score<input required type="number" min="0" max={form.componentScores[component]?.possible || undefined} value={form.componentScores[component]?.score || ''} onChange={event => setForm(value => ({ ...value, componentScores: { ...value.componentScores, [component]: { ...(value.componentScores[component] || {}), score: event.target.value } } }))} disabled={loadingRecord || !learner} /></label><label>Out of<input required type="number" min="1" value={form.componentScores[component]?.possible || ''} onChange={event => setForm(value => ({ ...value, componentScores: { ...value.componentScores, [component]: { ...(value.componentScores[component] || {}), possible: event.target.value } } }))} disabled={loadingRecord || !learner} /></label></div>)}</div><p className={`paper-total-note ${components.reduce((total, component) => total + Number(form.componentScores[component]?.possible || 0), 0) === 50 ? 'ready' : ''}`}>Subject possible marks: <strong>{components.reduce((total, component) => total + Number(form.componentScores[component]?.possible || 0), 0)}/50</strong>. There is no grade or unit for Grade 1 and Grade 2.</p></> : <><label>Subject<input readOnly value={form.subject} placeholder="Choose subject" /></label><label>Component<input readOnly value={form.component} placeholder="Choose component" /></label><label>Mark<input required type="number" min="0" max={form.possibleMark || undefined} value={form.score} onChange={change('score')} disabled={loadingRecord || !learner} /></label><label>Possible mark<input required type="number" min="1" value={form.possibleMark} onChange={change('possibleMark')} disabled={loadingRecord || !learner} /></label></>}<label className="wide">Teacher’s comment<textarea value={form.comment} onChange={change('comment')} disabled={loadingRecord || !learner} placeholder="Add constructive feedback, strengths, or next steps…" /></label></div><footer className="grade-form-actions"><p>{loadingRecord ? 'Loading saved entry…' : isEcd ? 'Save only once every row has one tick. Saved ratings remain editable.' : isGradeThreeSeven ? combinedPossible === 100 ? 'Both paper marks will be saved together.' : 'Set the two possible marks to a combined total of 100.' : isGradeOneTwo ? 'Save all subject components together once their possible marks total 50.' : 'Enter a mark and save.'}</p><div className="grade-action-buttons">{recordId && <button type="button" className="btn subtle" onClick={openRecordedMarks}>Open recorded marks</button>}<button className="btn primary" disabled={saving || loadingRecord || !learner || !selectionReady}>{saving ? 'Saving…' : recordId ? 'Update entry' : 'Save entry'}</button></div></footer></section><aside className="subject-progress"><header><span>{activeItem || (isEcd ? 'Developmental checklist' : 'Component')} progress</span><strong>{markedCount}/{visible.length} learners recorded</strong><div className="subject-progress-bar"><i style={{ width: `${progress}%` }} /></div></header><p>{learner ? (recordId ? 'Saved entry can be edited at any time.' : 'No entry saved for this learner yet.') : 'Select a learner to enter a report-book value.'}</p></aside></div>
      {learner && recordId && <section ref={recordedMarksRef} className={`private-mark-record ${showRecordedMarks ? 'revealed' : ''}`} onMouseEnter={() => setShowRecordedMarks(true)} onMouseLeave={() => setShowRecordedMarks(false)}><div><span>Confidential teacher record</span><strong>Saved marks only</strong><small>Hover to reveal on a computer, or tap the button on a phone. Grades and units are not shown.</small></div><button type="button" className="btn subtle" onClick={() => setShowRecordedMarks(value => !value)} aria-expanded={showRecordedMarks}>{showRecordedMarks ? 'Hide marks' : 'View recorded marks'}</button><div className="private-mark-table" aria-hidden={!showRecordedMarks}>{isEcd ? <><span>ECD checklist</span><span>Term {form.term}</span><span>{Object.keys(ecdRatings).filter(area => ecdRatings[area]).length}/{(reportBook?.areas || []).length} rated</span></> : isGradeThreeSeven ? <><span>{form.subject}</span><span>Paper 1: {form.paperOneScore}/{form.paperOnePossible} · Paper 2: {form.paperTwoScore}/{form.paperTwoPossible}</span><span>{combinedScore}/{combinedPossible}</span></> : isGradeOneTwo ? <><span>{form.subject}</span><span>{components.map(component => `${component}: ${form.componentScores[component]?.score || '—'}/${form.componentScores[component]?.possible || '—'}`).join(' · ')}</span><span>{components.reduce((total, component) => total + Number(form.componentScores[component]?.score || 0), 0)}/50</span></> : <><span>{form.subject} · {form.component}</span><span>Term {form.term}</span><span>{form.score}/{form.possibleMark}</span></>}</div></section>}
    </form>
  </section>
}
