import { useEffect, useMemo, useState } from 'react'
import { calculateGrade } from '../../utils/GradeCalculator'
import { useAuth } from '../../context/useAuth'
import PortalNotice from './PortalNotice'
import { useSection } from './StaffPortalLayout'

const schoolTerm = () => String(Math.min(3, Math.floor(new Date().getMonth() / 4) + 1))
const blank = () => ({ subject: '', percentage: '', exam_mark: '', term: schoolTerm(), year: new Date().getFullYear(), comment: '' })
const unique = values => [...new Set(values)]

export default function TeacherGradeEntryV2() {
  const { supabase, user, profile } = useAuth()
  const { selectedSubject, selectedSubjectLevel, selectedSubjectAllocationId } = useSection()
  const [students, setStudents] = useState([]); const [studentId, setStudentId] = useState('')
  const [form, setForm] = useState(blank); const [saved, setSaved] = useState([]); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('')
  useEffect(() => { let active = true; supabase.from('students').select('id, full_name, admission_number, class_level, class_stream').order('full_name').then(({ data, error: requestError }) => { if (!active) return; setStudents(data || []); setError(requestError ? 'Unable to load your learners.' : ''); setLoading(false) }); return () => { active = false } }, [supabase])
  const subjectAssignments = profile?.teacher_class_subject_assignments || []
  const activeSubjectAssignments = selectedSubject && selectedSubjectLevel
    ? subjectAssignments.filter(assignment => assignment.subject === selectedSubject && assignment.class_level === selectedSubjectLevel)
    : selectedSubjectAllocationId ? subjectAssignments.filter(assignment => assignment.id === selectedSubjectAllocationId) : []
  const visible = useMemo(() => students.filter(student => activeSubjectAssignments.some(assignment => assignment.class_level === student.class_level && (!assignment.class_stream || assignment.class_stream === (student.class_stream || '')))), [students, activeSubjectAssignments])
  const learner = visible.find(row => row.id === studentId)
  const assignedSubjects = learner ? unique(activeSubjectAssignments.filter(assignment => assignment.class_level === learner.class_level && (!assignment.class_stream || assignment.class_stream === (learner.class_stream || ''))).map(assignment => assignment.subject)) : unique(activeSubjectAssignments.map(assignment => assignment.subject))
  const groups = { 'Assigned subjects': assignedSubjects }
  const subjects = useMemo(() => Object.values(groups).flat(), [groups])
  const mark = form.exam_mark === '' ? form.percentage : form.exam_mark
  const outcome = learner ? calculateGrade(mark, learner.class_level) : null
  const change = field => event => setForm(value => ({ ...value, [field]: event.target.value }))
  useEffect(() => { let active = true; if (!learner) { setSaved([]); return undefined } supabase.from('academic_records').select('id, subject, score, grade').eq('student_id', learner.id).eq('term', form.term).eq('year', Number(form.year)).then(({ data, error: requestError }) => { if (!active) return; if (requestError) setError(requestError.message); else setSaved(data || []) }); return () => { active = false } }, [form.term, form.year, learner, supabase])
  const save = async event => { event.preventDefault(); setError(''); setNotice(''); if (!learner || !form.subject || !outcome) return setError('Choose a learner and subject, then enter a valid mark.')
    setSaving(true); const payload = { student_id: learner.id, subject: form.subject, score: Number(mark), term_mark: form.percentage === '' ? null : Number(form.percentage), exam_mark: form.exam_mark === '' ? null : Number(form.exam_mark), grade: outcome.grade, term: form.term, year: Number(form.year), comment: form.comment || null, teacher_initials: String(profile?.full_name || 'T').split(/\s+/).map(name => name[0]).join('').slice(0, 4), recorded_by: user.id }
    const { data: existing } = await supabase.from('academic_records').select('id').eq('student_id', learner.id).eq('subject', form.subject).eq('term', form.term).eq('year', Number(form.year)).maybeSingle()
    const { error: requestError } = await (existing ? supabase.from('academic_records').update(payload).eq('id', existing.id) : supabase.from('academic_records').insert(payload)); setSaving(false)
    if (requestError) return setError(requestError.message); setSaved(rows => [...rows.filter(row => row.subject !== form.subject), { ...payload, id: existing?.id || form.subject }]); setNotice('Grade saved successfully.'); setForm(value => ({ ...blank(), term: value.term, year: value.year }))
  }
  const completed = new Map(saved.map(row => [row.subject, row])); const complete = subjects.filter(subject => completed.has(subject)).length; const progress = subjects.length ? Math.round(complete / subjects.length * 100) : 0
  if (loading) return <section className="grade-entry-v2"><p>Loading assigned learners…</p></section>
  return <section className="grade-entry grade-entry-v2"><header className="grade-entry-heading"><p className="eyebrow">Academic records</p><h1>Enter learner performance</h1><p>Record results quickly, with the whole term visible at a glance.</p></header>{error && <PortalNotice tone="error">{error}</PortalNotice>}{notice && <PortalNotice>{notice}</PortalNotice>}
    <form className="grade-workspace" onSubmit={save}><section className="grade-filterbar" aria-label="Grade filters"><p className="grade-scope"><strong>{selectedSubject}</strong><span>{selectedSubjectLevel} · learners from your assigned subject classes</span></p><label>Learner<select value={studentId} onChange={event => { setStudentId(event.target.value); setForm(blank()) }}><option value="">Select a learner</option>{visible.map(row => <option key={row.id} value={row.id}>{row.full_name} — {row.admission_number}</option>)}</select></label><label>Term<select value={form.term} onChange={change('term')}><option value="1">Term 1</option><option value="2">Term 2</option><option value="3">Term 3</option></select></label><label>Year<input type="number" min="2020" value={form.year} onChange={change('year')} /></label></section>
      {learner && <div className="learner-summary"><strong>{learner.full_name}</strong><span>{learner.admission_number}</span><span>{learner.class_level} · {learner.class_stream}</span></div>}
      <div className="grade-main-grid"><section className="grade-form-card"><header className="grade-form-card-heading"><div><h2>Grade details</h2><p>Exam mark overrides the term mark when provided.</p></div>{outcome && <b>Grade {outcome.grade}</b>}</header><div className="grade-fields-v2"><label>Subject<select required disabled={!learner} value={form.subject} onChange={change('subject')}><option value="">Select subject</option>{Object.entries(groups).map(([group, groupSubjects]) => <optgroup key={group} label={group}>{groupSubjects.map(subject => <option key={`${group}-${subject}`}>{subject}</option>)}</optgroup>)}</select></label><label>Term mark (%)<input required type="number" min="0" max="100" placeholder="e.g. 74" value={form.percentage} onChange={change('percentage')} /></label><label>Grade / unit<input readOnly placeholder="Calculated" value={outcome?.grade || ''} /></label><label>Possible mark<input readOnly value="100" /></label><label>Exam mark (%) <span className="grade-info" title="The exam mark is used for the final grade when entered.">i</span><input type="number" min="0" max="100" placeholder="Optional" value={form.exam_mark} onChange={change('exam_mark')} /></label><label>Points<input readOnly placeholder="Calculated" value={outcome?.points || ''} /></label><label className="wide">Teacher’s comment<textarea placeholder="Add constructive feedback, strengths, or next steps…" value={form.comment} onChange={change('comment')} /></label></div><footer className="grade-form-actions"><p>{outcome?.description || 'Enter a mark to preview the calculated grade.'}</p><button className="btn primary" disabled={saving || !learner}>{saving ? 'Saving grade…' : 'Save grade'}</button></footer></section>
        <aside className="subject-progress"><header><span>Term {form.term} checklist</span><strong>{complete}/{subjects.length} Subjects Recorded</strong><div className="subject-progress-bar"><i style={{ width: `${progress}%` }} /></div></header><div className="subject-progress-list">{subjects.map(subject => { const row = completed.get(subject); return <div key={subject}><span>{subject}</span><b className={row ? 'complete' : ''}>{row ? `Complete · ${row.grade}` : 'Pending'}</b></div> })}</div></aside></div>
    </form></section>
}
