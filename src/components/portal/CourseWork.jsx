import { useEffect, useMemo, useState } from 'react'
import Button from '../ui/Button'
import Card from '../ui/Card'
import CourseworkMarks from './CourseworkMarks'
import PortalNotice from './PortalNotice'
import { useAuth } from '../../context/useAuth'
import { useSection } from './StaffPortalLayout'

const currentTerm = () => String(Math.min(3, Math.floor(new Date().getMonth() / 4) + 1))
const blankAssessment = () => ({ title: '', assessment_type: 'weekly', total_marks: '100', assessment_date: new Date().toISOString().slice(0, 10), term: currentTerm(), academic_year: new Date().getFullYear() })

export default function CourseWork() {
  const { supabase, user, profile } = useAuth()
  const { selectedSubject, selectedSubjectLevel, selectedSubjectAllocationId, clearSubjectGroup } = useSection()
  const [allocations, setAllocations] = useState([])
  const [students, setStudents] = useState([])
  const [assessments, setAssessments] = useState([])
  const [form, setForm] = useState(blankAssessment)
  const [marks, setMarks] = useState({})
  const [selected, setSelected] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const selectedAllocation = useMemo(() => allocations.find(allocation => allocation.id === selectedSubjectAllocationId) || null, [allocations, selectedSubjectAllocationId])
  const hasSubjectScope = Boolean(selectedAllocation && selectedSubject === selectedAllocation.subject && selectedSubjectLevel === selectedAllocation.class_level)
  const scopeStream = selectedAllocation?.class_stream || ''
  const scopeLabel = selectedAllocation ? `${selectedAllocation.subject} · ${selectedAllocation.class_level}${scopeStream ? ` · ${scopeStream}` : ' · all assigned streams'}` : ''
  const scopedAssessments = useMemo(() => assessments.filter(assessment => (
    assessment.subject === selectedSubject &&
    assessment.class_level === selectedSubjectLevel &&
    (assessment.class_stream || '') === scopeStream
  )), [assessments, selectedSubject, selectedSubjectLevel, scopeStream])
  const selectedAssessment = scopedAssessments.find(row => row.id === selected) || null

  const load = async () => {
    setLoading(true)
    setError('')
    const [allocationResult, assessmentResult] = await Promise.all([
      supabase.from('teacher_class_subject_assignments').select('id,class_level,class_stream,subject,campus').eq('teacher_id', user.id).order('class_level').order('subject'),
      supabase.from('coursework_assessments').select('*').eq('teacher_id', user.id).order('assessment_date', { ascending: false }),
    ])
    if (allocationResult.error || assessmentResult.error) setError(allocationResult.error?.message || assessmentResult.error?.message)
    setAllocations(allocationResult.data || [])
    setAssessments(assessmentResult.data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [supabase, user.id])
  useEffect(() => {
    setSelected('')
    setStudents([])
    setMarks({})
  }, [selectedSubjectAllocationId])
  useEffect(() => {
    if (!selected) { setStudents([]); setMarks({}); return }
    Promise.all([
      supabase.rpc('coursework_learners', { requested_assessment_id: selected }),
      supabase.from('coursework_marks').select('student_id,score').eq('assessment_id', selected),
    ]).then(([learnerResult, markResult]) => {
      if (learnerResult.error || markResult.error) setError(learnerResult.error?.message || markResult.error?.message)
      setStudents(learnerResult.data || [])
      setMarks(Object.fromEntries((markResult.data || []).map(row => [row.student_id, String(row.score)])))
    })
  }, [selected, supabase])

  const create = async event => {
    event.preventDefault(); setError(''); setNotice('')
    if (!hasSubjectScope) return setError('Return to Subject allocations and choose one of your current subject assignments.')
    if (!form.title.trim()) return setError('Enter an assessment title.')
    if (!Number(form.total_marks) || Number(form.total_marks) < 1) return setError('Enter a total mark greater than zero.')
    setSaving(true)
    const { data, error: requestError } = await supabase.from('coursework_assessments').insert({
      teacher_id: user.id,
      campus: selectedAllocation.campus || profile?.campus || 'senior',
      class_level: selectedAllocation.class_level,
      // A stream allocation remains stream-specific; a whole-form allocation remains whole-form.
      class_stream: selectedAllocation.class_stream || null,
      subject: selectedAllocation.subject,
      title: form.title.trim(),
      assessment_type: form.assessment_type,
      total_marks: Number(form.total_marks),
      assessment_date: form.assessment_date,
      term: form.term,
      academic_year: Number(form.academic_year),
    }).select().single()
    setSaving(false)
    if (requestError) return setError(requestError.message)
    setAssessments(rows => [data, ...rows]); setSelected(data.id); setMarks({}); setForm(blankAssessment())
    setNotice(`Assessment created for ${scopeLabel}. Enter marks below, then save once.`)
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
    setNotice(`${rows.length} coursework mark${rows.length === 1 ? '' : 's'} saved.`)
  }

  return <section className="coursework-page">
    <header className="grade-entry-heading"><Button type="button" variant="secondary" className="coursework-back" onClick={clearSubjectGroup}>← Subject allocations</Button><p className="eyebrow">Subject workspace</p><h1>Course Work</h1><p>{hasSubjectScope ? `${scopeLabel} — only learners in this allocation can be assessed.` : 'Choose a subject allocation before creating or entering course work.'}</p></header>
    {error && <PortalNotice tone="error">{error}</PortalNotice>}{notice && <PortalNotice>{notice}</PortalNotice>}
    {loading && <PortalNotice>Loading your subject allocations…</PortalNotice>}
    {!loading && !allocations.length && <PortalNotice tone="error">No subject allocations are assigned to you yet. Ask the Main Admin to add your subject allocation.</PortalNotice>}
    {!loading && !hasSubjectScope && <PortalNotice tone="error">This course-work link does not match one of your active allocations. Return to Subject allocations and select the class, subject, and stream again.</PortalNotice>}
    {hasSubjectScope && <div className="coursework-scope"><span>Active allocation</span><strong>{scopeLabel}</strong><small>{scopeStream ? 'This assessment is restricted to the selected stream.' : 'This assessment covers the whole assigned form.'}</small></div>}
    <Card><form className="form portal-form" onSubmit={create}><h2>1. Create an assessment</h2><label className="coursework-context-field">Subject and form<input readOnly value={scopeLabel} placeholder="Choose a subject allocation" /></label><p className="muted" style={{ gridColumn: '1 / -1', margin: 0 }}>{scopeStream ? `This assessment will include only active learners in ${selectedAllocation?.class_level} · ${scopeStream}.` : 'This assessment will include every active learner in your whole-form allocation.'}</p><label>Assessment title<input required value={form.title} onChange={e => setForm(value => ({ ...value, title: e.target.value }))} placeholder="e.g. Week 4 fractions test" disabled={!hasSubjectScope} /></label><label>Type<select value={form.assessment_type} onChange={e => setForm(value => ({ ...value, assessment_type: e.target.value }))} disabled={!hasSubjectScope}><option value="weekly">Weekly assessment</option><option value="monthly">Monthly assessment</option><option value="exam">Exam</option></select></label><label>Total marks<input required min="1" type="number" value={form.total_marks} onChange={e => setForm(value => ({ ...value, total_marks: e.target.value }))} disabled={!hasSubjectScope} /></label><label>Date<input required type="date" value={form.assessment_date} onChange={e => setForm(value => ({ ...value, assessment_date: e.target.value }))} disabled={!hasSubjectScope} /></label><Button type="submit" disabled={saving || !hasSubjectScope}>{saving ? 'Creating…' : 'Create assessment'}</Button></form></Card>
    <Card><div className="coursework-heading"><div><h2>2. Enter marks</h2><p>Select an assessment from this allocation to see marks entered and marks still missing.</p></div><label>Assessment<select value={selected} onChange={e => setSelected(e.target.value)} disabled={!hasSubjectScope}><option value="">Choose assessment</option>{scopedAssessments.map(row => <option key={row.id} value={row.id}>{row.title} · {row.assessment_date}</option>)}</select></label></div>{hasSubjectScope && !scopedAssessments.length && <p className="muted">No assessments have been created for this allocation yet.</p>}{selectedAssessment && <CourseworkMarks students={students} marks={marks} totalMarks={selectedAssessment.total_marks} saving={saving} onMarkChange={(id, value) => setMarks(current => ({ ...current, [id]: value }))} onSave={saveMarks} />}</Card>
  </section>
}
