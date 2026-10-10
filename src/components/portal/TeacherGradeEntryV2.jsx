import { useEffect, useMemo, useState } from 'react'
import { calculateGrade } from '../../utils/GradeCalculator'
import { useAuth } from '../../context/useAuth'
import PortalNotice from './PortalNotice'
import { useSection } from './StaffPortalLayout'

const schoolTerm = () => String(Math.min(3, Math.floor(new Date().getMonth() / 4) + 1))
const blank = () => ({ subject: '', percentage: '', exam_mark: '', term: schoolTerm(), year: new Date().getFullYear(), comment: '' })

export default function TeacherGradeEntryV2() {
  const { supabase, profile } = useAuth()
  const { selectedSubject, selectedSubjectLevel, selectedSubjectAllocationId } = useSection()
  const [students, setStudents] = useState([])
  const [studentId, setStudentId] = useState('')
  const [form, setForm] = useState(() => ({ ...blank(), subject: selectedSubject || '' }))
  const [recordId, setRecordId] = useState('')
  const [markedStudentIds, setMarkedStudentIds] = useState(() => new Set())
  const [loading, setLoading] = useState(true)
  const [loadingRecord, setLoadingRecord] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true
    supabase.from('students').select('id, full_name, admission_number, class_level, class_stream').order('full_name').then(({ data, error: requestError }) => {
      if (!active) return
      setStudents(data || [])
      setError(requestError ? 'Unable to load your learners.' : '')
      setLoading(false)
    })
    return () => { active = false }
  }, [supabase])

  const subjectAssignments = useMemo(() => profile?.teacher_class_subject_assignments || [], [profile?.teacher_class_subject_assignments])
  const hasSubjectScope = Boolean(selectedSubject && selectedSubjectLevel && selectedSubjectAllocationId)
  const activeSubjectAssignments = useMemo(() => (
    selectedSubject && selectedSubjectLevel
      ? subjectAssignments.filter(assignment => assignment.subject === selectedSubject && assignment.class_level === selectedSubjectLevel)
      : selectedSubjectAllocationId
        ? subjectAssignments.filter(assignment => assignment.id === selectedSubjectAllocationId)
        : []
  ), [subjectAssignments, selectedSubject, selectedSubjectLevel, selectedSubjectAllocationId])
  const visible = useMemo(() => students.filter(student => activeSubjectAssignments.some(assignment => (
    assignment.class_level === student.class_level
      && (!assignment.class_stream || assignment.class_stream === (student.class_stream || ''))
  ))), [students, activeSubjectAssignments])
  const visibleStudentIds = useMemo(() => visible.map(student => student.id), [visible])
  const visibleStudentKey = visibleStudentIds.join(',')
  const learner = visible.find(row => row.id === studentId)
  const mark = form.exam_mark === '' ? form.percentage : form.exam_mark
  const outcome = learner ? calculateGrade(mark, learner.class_level) : null
  const change = field => event => setForm(value => ({ ...value, [field]: event.target.value }))

  useEffect(() => {
    let active = true
    const reset = () => {
      setRecordId('')
      setForm(value => ({ ...blank(), term: value.term, year: value.year, subject: selectedSubject || '' }))
    }
    if (!learner || !hasSubjectScope) {
      reset()
      return () => { active = false }
    }

    const loadRecord = async () => {
      setLoadingRecord(true)
      setError('')
      setNotice('')
      const { data, error: requestError } = await supabase
        .from('academic_records')
        .select('id, term_mark, exam_mark, percentage, score, comment')
        .eq('student_id', learner.id)
        .eq('subject', selectedSubject)
        .eq('term', form.term)
        .eq('year', Number(form.year))
        .maybeSingle()
      if (!active) return
      if (requestError) {
        setError(requestError.message)
        setLoadingRecord(false)
        return
      }
      setRecordId(data?.id || '')
      setForm(value => ({
        ...blank(),
        term: value.term,
        year: value.year,
        subject: selectedSubject,
        percentage: data?.term_mark ?? data?.percentage ?? (data?.exam_mark == null ? data?.score ?? '' : ''),
        exam_mark: data?.exam_mark ?? '',
        comment: data?.comment ?? '',
      }))
      setLoadingRecord(false)
    }
    loadRecord()
    return () => { active = false }
  }, [form.term, form.year, hasSubjectScope, learner, selectedSubject, supabase])

  useEffect(() => {
    let active = true
    if (!hasSubjectScope || !selectedSubject || !visibleStudentIds.length) {
      setMarkedStudentIds(new Set())
      return () => { active = false }
    }
    const loadProgress = async () => {
      const { data, error: requestError } = await supabase
        .from('academic_records')
        .select('student_id')
        .eq('subject', selectedSubject)
        .eq('term', form.term)
        .eq('year', Number(form.year))
        .in('student_id', visibleStudentIds)
      if (!active) return
      if (requestError) return setError(requestError.message)
      setMarkedStudentIds(new Set((data || []).map(row => row.student_id)))
    }
    loadProgress()
    return () => { active = false }
  }, [form.term, form.year, hasSubjectScope, selectedSubject, supabase, visibleStudentKey])

  const save = async event => {
    event.preventDefault()
    setError('')
    setNotice('')
    if (!learner || !hasSubjectScope || !selectedSubject || !outcome) {
      return setError('Select a learner and enter a valid mark before saving.')
    }
    setSaving(true)
    const payload = {
      student_id: learner.id,
      subject: selectedSubject,
      score: Number(mark),
      term_mark: form.percentage === '' ? null : Number(form.percentage),
      exam_mark: form.exam_mark === '' ? null : Number(form.exam_mark),
      grade: outcome.grade,
      term: form.term,
      year: Number(form.year),
      comment: form.comment || null,
    }
    const wasSaved = Boolean(recordId)
    const { data, error: requestError } = await supabase
      .from('academic_records')
      .upsert(payload, { onConflict: 'student_id,subject,term,year' })
      .select('id')
      .single()
    setSaving(false)
    if (requestError) return setError(requestError.message || 'The mark could not be saved. Please try again.')
    setRecordId(data?.id || recordId)
    setMarkedStudentIds(current => new Set([...current, learner.id]))
    setNotice(wasSaved ? `${selectedSubject} mark updated. You can return and edit it again at any time.` : `${selectedSubject} mark saved. You can return and edit it at any time.`)
  }

  if (loading) return <section className="grade-entry-v2"><p>Loading assigned subject learners…</p></section>

  const markedCount = visibleStudentIds.filter(id => markedStudentIds.has(id)).length
  const markProgress = visibleStudentIds.length ? Math.round((markedCount / visibleStudentIds.length) * 100) : 0

  return <section className="grade-entry grade-entry-v2">
    <header className="grade-entry-heading">
      <p className="eyebrow">Private teacher markbook</p>
      <h1>Enter {selectedSubject || 'subject'} marks</h1>
      <p>Only your allocated subject is available here. Saved marks remain editable.</p>
    </header>
    {error && <PortalNotice tone="error">{error}</PortalNotice>}
    {notice && <PortalNotice>{notice}</PortalNotice>}
    {!hasSubjectScope && <PortalNotice tone="error">Choose a subject and form from Subject allocations before entering marks.</PortalNotice>}

    <form className="grade-workspace" onSubmit={save}>
      <section className="grade-filterbar" aria-label="Markbook filters">
        <p className="grade-scope"><strong>{selectedSubject || 'No subject selected'}</strong><span>{selectedSubjectLevel ? `${selectedSubjectLevel} · all learners in your assigned streams` : 'Return to Subject allocations to choose an assignment.'}</span></p>
        <label>Learner<select disabled={!hasSubjectScope} value={studentId} onChange={event => setStudentId(event.target.value)}><option value="">Select a learner</option>{visible.map(row => <option key={row.id} value={row.id}>{row.full_name} — {row.admission_number} · {row.class_stream || 'No stream'}</option>)}</select></label>
        <label>Term<select value={form.term} onChange={change('term')}><option value="1">Term 1</option><option value="2">Term 2</option><option value="3">Term 3</option></select></label>
        <label>Year<input type="number" min="2020" value={form.year} onChange={change('year')} /></label>
      </section>

      {learner && <div className="learner-summary"><strong>{learner.full_name}</strong><span>{learner.admission_number}</span><span>{learner.class_level} · {learner.class_stream}</span></div>}

      <div className="grade-main-grid">
        <section className="grade-form-card">
          <header className="grade-form-card-heading"><div><h2>{recordId ? 'Edit saved mark' : 'New mark'}</h2><p>Exam mark overrides the term mark when provided.</p></div>{outcome && <b>Grade {outcome.grade}</b>}</header>
          <div className="grade-fields-v2">
            <label>Allocated subject<input readOnly value={selectedSubject || ''} placeholder="Choose a subject and form" /></label>
            <label>Term mark (%)<input required type="number" min="0" max="100" placeholder="e.g. 74" value={form.percentage} onChange={change('percentage')} disabled={loadingRecord} /></label>
            <label>Grade / unit<input readOnly placeholder="Calculated" value={outcome?.grade || ''} /></label>
            <label>Possible mark<input readOnly value="100" /></label>
            <label>Exam mark (%) <span className="grade-info" title="The exam mark is used for the final grade when entered.">i</span><input type="number" min="0" max="100" placeholder="Optional" value={form.exam_mark} onChange={change('exam_mark')} disabled={loadingRecord} /></label>
            <label>Points<input readOnly placeholder="Calculated" value={outcome?.points || ''} /></label>
            <label className="wide">Teacher’s comment<textarea placeholder="Add constructive feedback, strengths, or next steps…" value={form.comment} onChange={change('comment')} disabled={loadingRecord} /></label>
          </div>
          <footer className="grade-form-actions"><p>{loadingRecord ? 'Loading saved mark…' : outcome?.description || 'Enter a mark to preview the calculated grade.'}</p><button className="btn primary" disabled={saving || loadingRecord || !learner || !hasSubjectScope}>{saving ? 'Saving mark…' : recordId ? `Update ${selectedSubject || 'subject'} mark` : `Save ${selectedSubject || 'subject'} mark`}</button></footer>
        </section>

        <aside className="subject-progress" aria-live="polite">
          <header><span>{selectedSubject || 'Subject'} mark progress</span><strong>{markedCount}/{visibleStudentIds.length} learners marked</strong><div className="subject-progress-bar"><i style={{ width: `${markProgress}%` }} /></div></header>
          {!learner ? <p>Select a learner to enter or edit their mark.</p> : loadingRecord ? <p>Loading this learner’s saved mark…</p> : <div className="subject-progress-list"><div><span>{learner.full_name}</span><b className={recordId ? 'complete' : ''}>{recordId ? 'Saved · editable' : 'No mark saved yet'}</b></div><small>Term {form.term} · {form.year}</small></div>}
        </aside>
      </div>
    </form>
  </section>
}
