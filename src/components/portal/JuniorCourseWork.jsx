import { useEffect, useMemo, useState } from 'react'
import Button from '../ui/Button'
import Card from '../ui/Card'
import CourseworkMarks from './CourseworkMarks'
import PortalNotice from './PortalNotice'
import { getJuniorReportBook, getSubjectsByGradeStream } from '../../utils/CurriculumData'
import { useAuth } from '../../context/useAuth'
import { useSection } from './StaffPortalLayout'

const currentTerm = () => String(Math.min(3, Math.floor(new Date().getMonth() / 4) + 1))
const blankAssessment = () => ({ title: '', assessment_type: 'weekly', total_marks: '100', assessment_date: new Date().toISOString().slice(0, 10), term: currentTerm(), academic_year: new Date().getFullYear() })

export default function JuniorCourseWork() {
  const { supabase, user, profile } = useAuth()
  const { activeClassFilter, setActiveClassFilter, setActiveClassKey, setSection } = useSection()
  const assignedClasses = useMemo(() => (profile?.teacher_class_assignments || [])
    .filter(assignment => /^Grade [1-7]$|^ECD [AB]$/.test(assignment.class_level))
    .map(assignment => ({
      level: assignment.class_level,
      stream: assignment.class_stream || '',
    })), [profile?.teacher_class_assignments])
  const assignedLevels = useMemo(() => [...new Set(assignedClasses.map(assignment => assignment.level))], [assignedClasses])
  const [classLevel, setClassLevel] = useState('')
  const [subject, setSubject] = useState('')
  const [reportComponent, setReportComponent] = useState('')
  const [assessments, setAssessments] = useState([])
  const [students, setStudents] = useState([])
  const [marks, setMarks] = useState({})
  const [selected, setSelected] = useState('')
  const [form, setForm] = useState(blankAssessment)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const reportBook = useMemo(() => getJuniorReportBook(classLevel), [classLevel])
  const isEcd = reportBook?.type === 'developmental-ratings'
  const reportSubjects = reportBook?.subjects || []
  const subjects = useMemo(() => reportSubjects.length ? reportSubjects.map(item => item.subject) : (classLevel ? getSubjectsByGradeStream(classLevel, 'Blue') : []), [classLevel, reportSubjects])
  const components = reportSubjects.find(item => item.subject === subject)?.components || []
  const isGradeOneTwo = /^Grade [12]$/.test(classLevel)
  const isJuniorProject = (/^Grade [12]$/.test(classLevel) || /^Grade [3-7]$/.test(classLevel)) && reportComponent === 'Project'
  const activeClassAssignment = assignedClasses.find(assignment => assignment.level === classLevel)
  const activeClassStream = activeClassAssignment?.stream || ''
  const classScopeLabel = activeClassStream ? `${classLevel} · ${activeClassStream}` : classLevel
  const scopedAssessments = useMemo(() => assessments.filter(item => item.class_level === classLevel && (item.class_stream || '') === activeClassStream && item.subject === subject && (item.report_component || '') === reportComponent), [assessments, classLevel, activeClassStream, subject, reportComponent])
  const selectedAssessment = assessments.find(item => item.id === selected)

  const selectClassLevel = level => {
    const assignment = assignedClasses.find(item => item.level === level)
    setClassLevel(level)
    setActiveClassKey(`${level}:${assignment?.stream || ''}`)
    setActiveClassFilter({ level, stream: assignment?.stream || null })
  }
  useEffect(() => {
    const sharedLevel = activeClassFilter.level
    if (sharedLevel && assignedLevels.includes(sharedLevel)) {
      if (classLevel !== sharedLevel) setClassLevel(sharedLevel)
      return
    }
    if (!classLevel && assignedLevels.length) selectClassLevel(assignedLevels[0])
  }, [activeClassFilter.level, assignedLevels, assignedClasses, classLevel, setActiveClassFilter, setActiveClassKey])
  useEffect(() => { setSubject(''); setReportComponent(''); setSelected(''); setStudents([]); setMarks({}) }, [classLevel])
  useEffect(() => { setReportComponent(''); setSelected('') }, [subject])
  useEffect(() => { if (isJuniorProject) setForm(value => ({ ...value, total_marks: '20' })) }, [isJuniorProject])
  useEffect(() => {
    if (isGradeOneTwo) setForm(value => ({ ...value, total_marks: value.total_marks === '100' ? '50' : value.total_marks }))
  }, [isGradeOneTwo])
  useEffect(() => {
    let active = true
    supabase.from('coursework_assessments').select('*').eq('teacher_id', user.id).eq('campus', 'junior').order('assessment_date', { ascending: false }).then(({ data, error: requestError }) => {
      if (!active) return
      setAssessments(data || []); setError(requestError?.message || ''); setLoading(false)
    })
    return () => { active = false }
  }, [supabase, user.id])
  useEffect(() => {
    let active = true
    if (!selected) { setStudents([]); setMarks({}); return () => { active = false } }
    Promise.all([supabase.rpc('coursework_learners', { requested_assessment_id: selected }), supabase.from('coursework_marks').select('student_id,score').eq('assessment_id', selected)]).then(([learnerResult, markResult]) => {
      if (!active) return
      if (learnerResult.error || markResult.error) setError(learnerResult.error?.message || markResult.error?.message)
      else { setStudents(learnerResult.data || []); setMarks(Object.fromEntries((markResult.data || []).map(row => [row.student_id, String(row.score)]))) }
    })
    return () => { active = false }
  }, [selected, supabase])

  const create = async event => {
    event.preventDefault(); setError(''); setNotice('')
    if (!assignedLevels.includes(classLevel) || !subject || !form.title.trim() || (!isGradeOneTwo && reportSubjects.length && !reportComponent)) return setError('Choose your assigned class, subject, report component, and an assessment title.')
    if (isJuniorProject && Number(form.total_marks) !== 20) return setError('Junior projects are recorded out of 20 and remain separate from the assessment total.')
    if (isGradeOneTwo && (Number(form.total_marks) < 1 || Number(form.total_marks) > 50)) return setError('Grade 1 and Grade 2 course work must be recorded out of 50 or less. Official report components are entered together in Markbook and total exactly 50.')
    setSaving(true)
    const { data, error: requestError } = await supabase.from('coursework_assessments').insert({ teacher_id: user.id, campus: 'junior', class_level: classLevel, class_stream: activeClassStream || null, subject, report_component: isGradeOneTwo ? null : reportComponent || null, title: form.title.trim(), assessment_type: form.assessment_type, total_marks: Number(form.total_marks), assessment_date: form.assessment_date, term: form.term, academic_year: Number(form.academic_year) }).select().single()
    setSaving(false)
    if (requestError) return setError(requestError.message)
    setAssessments(rows => [data, ...rows]); setSelected(data.id); setForm(blankAssessment()); setNotice('Assessment created. Enter marks below, then save once.')
  }
  const saveMarks = async () => {
    if (!selectedAssessment) return
    const invalid = Object.values(marks).some(value => value !== '' && (Number(value) < 0 || Number(value) > Number(selectedAssessment.total_marks)))
    if (invalid) return setError(`Marks must be between 0 and ${selectedAssessment.total_marks}.`)
    setSaving(true); setError('')
    const rows = students.filter(student => marks[student.id] !== '' && marks[student.id] !== undefined).map(student => ({ assessment_id: selected, student_id: student.id, score: Number(marks[student.id]) }))
    const { error: requestError } = rows.length ? await supabase.from('coursework_marks').upsert(rows, { onConflict: 'assessment_id,student_id' }) : { error: null }
    setSaving(false)
    if (requestError) return setError(requestError.message)
    const gradeOneTwoAssessment = /^Grade [12]$/.test(selectedAssessment.class_level || '')
    if (rows.length && selectedAssessment.report_component && !gradeOneTwoAssessment) {
      const reportRows = rows.map(row => ({ student_id: row.student_id, subject: selectedAssessment.subject, component: selectedAssessment.report_component, score: row.score, possible_mark: Number(selectedAssessment.total_marks), term: selectedAssessment.term, year: Number(selectedAssessment.academic_year), recorded_by: user.id }))
      const { error: reportError } = await supabase.from('junior_component_marks').upsert(reportRows, { onConflict: 'student_id,subject,component,term,year' })
      if (reportError) return setError(`Coursework marks were saved, but the report component could not be updated: ${reportError.message}`)
      setNotice(`${rows.length} coursework mark${rows.length === 1 ? '' : 's'} saved and added to ${selectedAssessment.subject} · ${selectedAssessment.report_component} on the report book.`)
    } else setNotice(gradeOneTwoAssessment ? `${rows.length} coursework mark${rows.length === 1 ? '' : 's'} saved for teaching progress. Grade 1 and 2 report components stay in Markbook, where they total exactly 50.` : `${rows.length} coursework mark${rows.length === 1 ? '' : 's'} saved.`)
  }
  if (isEcd) return <section className="coursework-page"><header className="grade-entry-heading"><Button type="button" variant="secondary" className="coursework-back" onClick={() => setSection('dashboard')}>← My class</Button><p className="eyebrow">Junior class workspace</p><h1>ECD developmental record</h1><p>ECD learners are assessed through the developmental checklist, not subject coursework.</p></header><div className="junior-class-scope"><span>Working class</span><strong>{classScopeLabel}</strong><small>Record each learner’s 1–5 developmental ratings in the ECD markbook.</small></div><Card className="ecd-coursework-notice"><p className="eyebrow">ECD assessment</p><h2>Course Work is not used for ECD</h2><p>The ECD report book does not use Grade subjects or coursework marks. Use the developmental markbook to record the required ratings for every development area.</p><Button type="button" onClick={() => setSection('entry')}>Open developmental markbook</Button></Card></section>
  return <section className="coursework-page"><header className="grade-entry-heading"><Button type="button" variant="secondary" className="coursework-back" onClick={() => setSection('dashboard')}>← My class</Button><p className="eyebrow">Junior class coursework</p><h1>Course Work</h1><p>{isGradeOneTwo ? 'Record classroom progress out of 50 or less. Official Grade 1 and 2 report components are entered together in Markbook.' : 'Create coursework for any subject in your assigned Junior class, then enter marks for its learners.'}</p></header>
    {error && <PortalNotice tone="error">{error}</PortalNotice>}{notice && <PortalNotice>{notice}</PortalNotice>}{loading && <PortalNotice>Loading your Junior coursework…</PortalNotice>}{!loading && !assignedLevels.length && <PortalNotice tone="error">No Junior class has been assigned to your account yet. Ask the Main Admin to assign your class first.</PortalNotice>}
    {classLevel && <div className="junior-class-scope"><span>Working class</span><strong>{classScopeLabel}</strong><small>Only learners in this assigned Junior class can be included.</small></div>}
    {isGradeOneTwo && <section className="grade12-coursework-guidance" aria-label="Grade 1 and 2 coursework rules"><div><span>Classroom progress</span><strong>Course Work is recorded out of 50 or less.</strong><small>It helps the teacher track learning during the term.</small></div><div><span>Official report</span><strong>Components are entered together in Markbook.</strong><small>They must total exactly 50; no units are used.</small></div><div><span>Project</span><strong>Project is recorded separately out of 20.</strong><small>It does not add to the 50-mark assessment total.</small></div><Button type="button" variant="secondary" onClick={() => setSection('entry')}>Open official Markbook</Button></section>}
    <Card className={isGradeOneTwo ? "grade12-coursework-card" : ""}><form className="form portal-form" onSubmit={create}><h2>{isGradeOneTwo ? '1. Create a classroom assessment' : '1. Create an assessment'}</h2><label>Class<select value={classLevel} onChange={event => selectClassLevel(event.target.value)} disabled={!assignedLevels.length}><option value="">Choose class</option>{assignedLevels.map(level => <option key={level}>{level}</option>)}</select></label><label>Subject<select value={subject} onChange={event => setSubject(event.target.value)} disabled={!classLevel}><option value="">Choose subject</option>{subjects.map(item => <option key={item}>{item}</option>)}</select></label>{reportSubjects.length > 0 && !isGradeOneTwo && <label>Report component<select value={reportComponent} onChange={event => setReportComponent(event.target.value)} disabled={!subject}><option value="">Choose component</option>{components.map(item => <option key={item}>{item}</option>)}</select></label>}<label>Assessment title<input required value={form.title} onChange={event => setForm(value => ({ ...value, title: event.target.value }))} placeholder="e.g. Week 4 fractions test" /></label><label>Type<select value={form.assessment_type} onChange={event => setForm(value => ({ ...value, assessment_type: event.target.value }))}><option value="weekly">Weekly assessment</option><option value="monthly">Monthly assessment</option><option value="exam">Exam</option></select></label><label>{isGradeOneTwo ? 'Assessment total · maximum 50' : 'Total marks'}<input required min="1" max={isGradeOneTwo ? "50" : undefined} type="number" value={form.total_marks} onChange={event => setForm(value => ({ ...value, total_marks: event.target.value }))} readOnly={isJuniorProject} /><small>{isJuniorProject ? 'Project is fixed at 20 marks and remains separate from the assessment total.' : isGradeOneTwo ? 'This score remains in Course Work only and does not change the official report.' : ''}</small></label><label>Date<input required type="date" value={form.assessment_date} onChange={event => setForm(value => ({ ...value, assessment_date: event.target.value }))} /></label><Button type="submit" disabled={saving || !classLevel || !subject || (!isGradeOneTwo && reportSubjects.length > 0 && !reportComponent)}>{saving ? 'Creating…' : 'Create assessment'}</Button></form></Card>
    <Card><div className="coursework-heading"><div><h2>2. Enter marks</h2><p>Select an assessment for {classScopeLabel || 'your selected Junior class and subject'}.</p></div><label>Assessment<select value={selected} onChange={event => setSelected(event.target.value)} disabled={!subject}><option value="">Choose assessment</option>{scopedAssessments.map(item => <option key={item.id} value={item.id}>{item.title} · {item.assessment_date}</option>)}</select></label></div>{selectedAssessment && <CourseworkMarks students={students} marks={marks} totalMarks={selectedAssessment.total_marks} saving={saving} onMarkChange={(id, value) => setMarks(current => ({ ...current, [id]: value }))} onSave={saveMarks} />}</Card>
  </section>
}
