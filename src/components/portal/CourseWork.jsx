import { useEffect, useMemo, useState } from 'react'
import Button from '../ui/Button'
import Card from '../ui/Card'
import PortalNotice from './PortalNotice'
import { useAuth } from '../../context/useAuth'

const currentTerm = () => String(Math.min(3, Math.floor(new Date().getMonth() / 4) + 1))
const blankAssessment = () => ({ allocationId: '', title: '', assessment_type: 'weekly', total_marks: '100', assessment_date: new Date().toISOString().slice(0, 10), term: currentTerm(), academic_year: new Date().getFullYear() })
const allocationLabel = allocation => `${allocation.subject} · ${allocation.class_level}${allocation.class_stream ? ` ${allocation.class_stream}` : ''}`

export default function CourseWork() {
  const { supabase, user, profile } = useAuth()
  const [allocations, setAllocations] = useState([])
  const [schoolClasses, setSchoolClasses] = useState([])
  const [students, setStudents] = useState([])
  const [assessments, setAssessments] = useState([])
  const [form, setForm] = useState(blankAssessment)
  const [reuseAssessment, setReuseAssessment] = useState('')
  const [reuseAllocation, setReuseAllocation] = useState('')
  const [marks, setMarks] = useState({})
  const [selected, setSelected] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const allocationOptions = useMemo(() => allocations.flatMap(allocation => allocation.class_stream ? [{ ...allocation, optionId: `${allocation.id}::${allocation.class_stream}` }] : schoolClasses.filter(schoolClass => schoolClass.active && schoolClass.class_level === allocation.class_level && schoolClass.campus === allocation.campus).map(schoolClass => ({ ...allocation, class_stream: schoolClass.class_stream || null, optionId: `${allocation.id}::${schoolClass.class_stream || '__none__'}` }))), [allocations, schoolClasses])
  const selectedAssessment = assessments.find(row => row.id === selected)
  const selectedAllocation = allocationOptions.find(row => row.optionId === form.allocationId)
  const reuseSource = assessments.find(row => row.id === reuseAssessment)
  const reuseOptions = useMemo(() => allocationOptions.filter(allocation => !reuseSource || allocation.subject.toLowerCase() === reuseSource.subject.toLowerCase()), [allocationOptions, reuseSource])

  const load = async () => {
    setLoading(true)
    setError('')
    const [allocationResult, assessmentResult, classResult] = await Promise.all([
      supabase.from('teacher_class_subject_assignments').select('id,class_level,class_stream,subject,campus').eq('teacher_id', user.id).order('class_level').order('subject'),
      supabase.from('coursework_assessments').select('*').eq('teacher_id', user.id).order('assessment_date', { ascending: false }),
      supabase.from('school_classes').select('class_level,class_stream,campus,active').eq('active', true),
    ])
    if (allocationResult.error || assessmentResult.error || classResult.error) setError(allocationResult.error?.message || assessmentResult.error?.message || classResult.error?.message)
    setAllocations(allocationResult.data || [])
    setAssessments(assessmentResult.data || [])
    setSchoolClasses(classResult.data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [supabase, user.id])
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
    if (!selectedAllocation) return setError('Choose one of your assigned class subjects.')
    if (!form.title.trim()) return setError('Enter an assessment title.')
    setSaving(true)
    const { data, error: requestError } = await supabase.from('coursework_assessments').insert({
      teacher_id: user.id,
      campus: selectedAllocation.campus || profile?.campus || 'senior',
      class_level: selectedAllocation.class_level,
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
    setNotice('Assessment created. Enter marks below, then save once.')
  }

  const reuse = async event => {
    event.preventDefault(); setError(''); setNotice('')
    const source = assessments.find(row => row.id === reuseAssessment)
    const target = allocationOptions.find(row => row.optionId === reuseAllocation)
    if (!source || !target) return setError('Choose an assessment and another allocated class subject.')
    if (source.subject.toLowerCase() !== target.subject.toLowerCase()) return setError('An assessment can only be reused for the same subject.')
    if (source.class_level === target.class_level && (source.class_stream || '') === (target.class_stream || '')) return setError('Choose a different class.')
    setSaving(true)
    const { id, created_at, ...copy } = source
    const { data, error: requestError } = await supabase.from('coursework_assessments').insert({
      ...copy,
      teacher_id: user.id,
      campus: target.campus || profile?.campus || 'senior',
      class_level: target.class_level,
      class_stream: target.class_stream || null,
      subject: target.subject,
    }).select().single()
    setSaving(false)
    if (requestError) return setError(requestError.message)
    setAssessments(rows => [data, ...rows]); setSelected(data.id); setMarks({}); setReuseAssessment(''); setReuseAllocation('')
    setNotice(`Assessment copied to ${allocationLabel(target)}. Enter marks for that class below.`)
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

  const completed = students.filter(student => marks[student.id] !== '' && marks[student.id] !== undefined).length
  return <section className="coursework-page">
    <header className="grade-entry-heading"><p className="eyebrow">Subject workspace</p><h1>Course Work</h1><p>Select an allocated subject and class, then enter weekly, monthly or exam marks. Your learner roster remains in the Classes workspace.</p></header>
    {error && <PortalNotice tone="error">{error}</PortalNotice>}{notice && <PortalNotice>{notice}</PortalNotice>}
    {loading && <PortalNotice>Loading your subject allocations…</PortalNotice>}
    {!loading && !allocations.length && <PortalNotice tone="error">No subject allocations are assigned to you yet. Ask the Main Admin to add your subject allocation.</PortalNotice>}
    <Card><form className="form portal-form" onSubmit={create}><h2>1. Create an assessment</h2><label>Allocated class subject<select required value={form.allocationId} onChange={e => setForm(value => ({ ...value, allocationId: e.target.value }))}><option value="">Choose assigned subject</option>{allocationOptions.map(allocation => <option key={allocation.optionId} value={allocation.optionId}>{allocationLabel(allocation)}</option>)}</select></label><label>Subject<input readOnly value={selectedAllocation?.subject || ''} placeholder="Select an allocated class subject" /></label><label>Assessment title<input required value={form.title} onChange={e => setForm(value => ({ ...value, title: e.target.value }))} placeholder="e.g. Week 4 fractions test" /></label><label>Type<select value={form.assessment_type} onChange={e => setForm(value => ({ ...value, assessment_type: e.target.value }))}><option value="weekly">Weekly assessment</option><option value="monthly">Monthly assessment</option><option value="exam">Exam</option></select></label><label>Total marks<input required min="1" type="number" value={form.total_marks} onChange={e => setForm(value => ({ ...value, total_marks: e.target.value }))} /></label><label>Date<input required type="date" value={form.assessment_date} onChange={e => setForm(value => ({ ...value, assessment_date: e.target.value }))} /></label><Button type="submit" disabled={saving || !allocationOptions.length}>{saving ? 'Creating…' : 'Create assessment'}</Button></form></Card>
    <Card><form className="form portal-form" onSubmit={reuse}><h2>2. Reuse for another class</h2><p className="muted" style={{ gridColumn: '1 / -1', margin: 0 }}>Copy an assessment only to another class you teach the same subject. The new class starts with blank marks.</p><label>Existing assessment<select value={reuseAssessment} onChange={e => { setReuseAssessment(e.target.value); setReuseAllocation('') }}><option value="">Choose assessment</option>{assessments.map(row => <option key={row.id} value={row.id}>{row.subject} · {row.title} ({row.class_level} {row.class_stream || ''})</option>)}</select></label><label>Other allocated class<select value={reuseAllocation} onChange={e => setReuseAllocation(e.target.value)}><option value="">Choose another class</option>{reuseOptions.map(allocation => <option key={allocation.optionId} value={allocation.optionId}>{allocationLabel(allocation)}</option>)}</select></label><Button type="submit" disabled={saving}>{saving ? 'Copying…' : 'Copy assessment to class'}</Button></form></Card>
    <Card><div className="coursework-heading"><div><h2>3. Enter class marks</h2><p>Select an assessment to see marks entered and marks still missing.</p></div><label>Assessment<select value={selected} onChange={e => setSelected(e.target.value)}><option value="">Choose assessment</option>{assessments.map(row => <option key={row.id} value={row.id}>{row.subject} · {row.title} ({row.class_level} {row.class_stream || ''})</option>)}</select></label></div>{selectedAssessment && <><p className="muted">{completed}/{students.length} marks entered · Missing marks remain blank until saved.</p><div className="portal-table-wrap"><table className="portal-table"><thead><tr><th>Learner</th><th>Admission no.</th><th>Mark / {selectedAssessment.total_marks}</th><th>Status</th></tr></thead><tbody>{students.map(student => { const value = marks[student.id] ?? ''; return <tr key={student.id}><td><strong>{student.full_name}</strong></td><td>{student.admission_number}</td><td><input aria-label={`Mark for ${student.full_name}`} type="number" min="0" max={selectedAssessment.total_marks} value={value} onChange={e => setMarks(current => ({ ...current, [student.id]: e.target.value }))} /></td><td><span className={`class-status ${value === '' ? 'is-inactive' : 'is-active'}`}>{value === '' ? 'Missing' : 'Entered'}</span></td></tr>})}</tbody></table></div><Button type="button" onClick={saveMarks} disabled={saving}>{saving ? 'Saving…' : `Save ${completed} marks`}</Button></>}</Card>
  </section>
}
