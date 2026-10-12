import { useEffect, useMemo, useState } from 'react'
import { calculateGrade } from '../../utils/GradeCalculator'
import { getJuniorReportBook } from '../../utils/CurriculumData'
import juniorReportLogo from '../../assets/images/reliance-junior-report-logo.png'
import SchoolStamp from '../ui/SchoolStamp'
import { useAuth } from '../../context/useAuth'
import '../../juniorReportBook.css'

const termLabel = value => String(value).startsWith('Term') ? String(value) : `Term ${value}`
const money = value => `$${Number(value ?? 0).toFixed(2)}`
const date = value => value ? new Intl.DateTimeFormat('en-ZW', { dateStyle: 'long' }).format(new Date(`${value}T00:00:00`)) : 'To be confirmed'
const termValue = value => String(value ?? '').replace(/^term\s*/i, '')
const rowYear = row => String(row.year ?? new Date(row.created_at || Date.now()).getFullYear())

export default function JuniorReportBook({ student, componentMarks = [], developmentalRatings = [], reportComments = [], classTeacher, juniorReportSummary, attendance = [], fees = [], report = {}, reportFees = [], adminAccess = false, supabase, onReportCommentSaved }) {
  const { profile, user, supabase: authSupabase } = useAuth()
  const blueprint = getJuniorReportBook(student.class_level)
  const source = blueprint?.type === 'developmental-ratings' ? developmentalRatings : componentMarks
  const [term, setTerm] = useState(() => termValue(source[0]?.term ?? '3'))
  const [year, setYear] = useState(() => rowYear(source[0] ?? {}))
  const [savingOfficeNote, setSavingOfficeNote] = useState(false)
  const [officeError, setOfficeError] = useState('')
  const [summary, setSummary] = useState(juniorReportSummary || null)
  const selected = useMemo(() => source.filter(row => termValue(row.term) === term && rowYear(row) === year), [source, term, year])
  const terms = [...new Set(source.map(row => termValue(row.term)))].sort((a, b) => Number(b) - Number(a))
  const attendanceRows = attendance.filter(row => String(row.date || '').startsWith(year))
  const present = attendanceRows.filter(row => ['present', 'late'].includes(row.status)).length
  const nextTermBegins = report[`${year}-${term}`]?.junior_next_term_begins_on || report[`${year}-${term}`]?.next_term_begins_on
  const nextTermFee = reportFees.find(row => String(row.academic_year) === year && String(row.term) === term && row.class_level === student.class_level)?.amount
  const officeNote = reportComments.find(row => String(row.term) === String(term) && String(row.year) === String(year)) || {}
  const [formTeacherComment, setFormTeacherComment] = useState('')
  const [principalComment, setPrincipalComment] = useState('')
  useEffect(() => {
    setFormTeacherComment(officeNote.form_teacher_comment || '')
    setPrincipalComment(officeNote.principal_comment || '')
    setOfficeError('')
  }, [officeNote.form_teacher_comment, officeNote.principal_comment, term, year])
  useEffect(() => {
    let active = true
    authSupabase.rpc('junior_report_summary', { requested_student_id: student.id, requested_term: Number(term), requested_year: Number(year) }).then(({ data }) => {
      if (active) setSummary(data?.[0] || null)
    })
    return () => { active = false }
  }, [authSupabase, student.id, term, year])
  const saveOfficeNote = async () => {
    if (!supabase || !adminAccess) return
    setSavingOfficeNote(true)
    setOfficeError('')
    const { data, error } = await supabase.from('report_card_comments').upsert({
      student_id: student.id,
      term: Number(term),
      year: Number(year),
      form_teacher_comment: formTeacherComment.trim() || null,
      principal_comment: principalComment.trim() || null,
      head_signature_initials: profile?.signature_initials || null,
      head_signed_by: profile?.signature_initials ? user?.id : null,
    }, { onConflict: 'student_id,term,year' }).select().single()
    setSavingOfficeNote(false)
    if (error) { setOfficeError(error.message); return }
    onReportCommentSaved?.(data)
  }
  const printReport = () => {
    const originalTitle = document.title
    document.title = `${student.full_name} - ${termLabel(term)} ${year} Junior Report`
    window.addEventListener('afterprint', () => { document.title = originalTitle }, { once: true })
    window.print()
  }
  const component = (subject, name) => selected.find(row => row.subject === subject && row.component === name)
  const rating = area => selected.find(row => row.development_area === area)
  const score = row => row ? `${row.score}/${row.possible_mark}` : '—'
  const percentage = row => row ? (Number(row.score) / Number(row.possible_mark)) * 100 : null
  const reportSummary = summary || juniorReportSummary
  const hasNumericSummary = blueprint?.type !== 'developmental-ratings' && reportSummary?.total_possible > 0

  return <section className="junior-report-book report-card" id="junior-report-book">
    <header className="junior-report-heading"><img src={juniorReportLogo} alt="Reliance Junior School crest" /><div><p>Reliance Junior School</p><h2>{blueprint?.label || 'Junior academic report'}</h2><span>Education That Inspires</span></div><div className="junior-report-actions no-print">{adminAccess && <b>Administrator copy</b>}<label>Term<select value={term} onChange={event => setTerm(event.target.value)}>{(terms.length ? terms : ['1', '2', '3']).map(value => <option key={value} value={value}>{termLabel(value)}</option>)}</select></label><label>Year<input type="number" value={year} onChange={event => setYear(event.target.value)} /></label><button type="button" className="btn primary" onClick={printReport}>Print / Download PDF</button></div></header>
    <section className="junior-report-meta"><span><b>Learner:</b> {student.full_name}</span><span><b>Admission no.:</b> {student.admission_number || '—'}</span><span><b>Class / Grade:</b> {student.class_level}</span><span><b>Term:</b> {termLabel(term)}</span><span><b>Year:</b> {year}</span><span><b>Attendance:</b> {present} out of {attendanceRows.length} days</span><span><b>Pupils in class:</b> {reportSummary?.class_size ?? '—'}</span>{blueprint?.type !== 'developmental-ratings' && <span><b>Class position:</b> {reportSummary?.class_position ? `${reportSummary.class_position} of ${reportSummary.class_size}` : 'Pending marks'}</span>}</section>
    {blueprint?.type === 'developmental-ratings' ? <section className="junior-report-section"><h3>Emotional, social and intellectual development</h3><p className="junior-rating-key">Key: 1 Below Average · 2 Average · 3 Good · 4 Very Good · 5 Excellent</p><table className="junior-report-table"><thead><tr><th>Development area</th>{[1, 2, 3, 4, 5].map(value => <th key={value}>{value}</th>)}</tr></thead><tbody>{blueprint.areas.map(area => { const item = rating(area); return <tr key={area}><td>{area}</td>{[1, 2, 3, 4, 5].map(value => <td key={value} className={item?.rating === value ? 'is-selected' : ''}>{item?.rating === value ? '✓' : ''}</td>)}</tr> })}</tbody></table></section> : <section className="junior-report-section"><table className="junior-report-table"><thead><tr><th>Subject</th><th>Component</th><th>Possible mark</th><th>Actual mark</th><th>Grade</th><th>Remarks</th></tr></thead><tbody>{blueprint?.subjects.map(subject => subject.components.map((name, index) => { const item = component(subject.subject, name); const percent = percentage(item); const grade = percent == null ? '' : calculateGrade(percent, student.class_level)?.grade; return <tr key={`${subject.subject}-${name}`}><td>{index === 0 ? subject.subject : ''}</td><td>{name}</td><td>{item?.possible_mark ?? '—'}</td><td>{score(item)}</td><td>{grade || '—'}</td><td>{item?.comment || ''}</td></tr> }))}</tbody><tfoot><tr><th colSpan="2">Total marks</th><th>{hasNumericSummary ? reportSummary.total_possible : '—'}</th><th>{hasNumericSummary ? reportSummary.total_score : '—'}</th><th>{hasNumericSummary ? `${Number(reportSummary.percentage).toFixed(1)}%` : '—'}</th><th>{hasNumericSummary ? calculateGrade(Number(reportSummary.percentage), student.class_level)?.grade || '' : ''}</th></tr></tfoot></table></section>}
    <section className="junior-report-comments"><p><b>Class teacher’s comment:</b> {officeNote.form_teacher_comment || '..........................................................................................................................................'}</p><p><b>Signature:</b> {classTeacher?.signature_initials || 'Pending verified initials'}{classTeacher?.teacher_name ? ` · ${classTeacher.teacher_name}` : ''}</p><p><b>Head / Deputy Head / T.I.C’s comment:</b> {officeNote.principal_comment || '.............................................................................................................'}</p><p><b>Signature:</b> {officeNote.head_signature_initials || 'Pending office signature'}</p></section>
    {adminAccess && <section className="junior-report-office-editor no-print"><div><p className="eyebrow">Office report notes</p><h3>Comments for {termLabel(term)} {year}</h3><p className="muted">These official notes are visible on the printed Junior report and to authorised families. Teachers cannot open this report book.</p>{!profile?.signature_initials && <p className="form-error">Your verified legal name is still needed before this report can carry your office initials.</p>}</div><label>Class teacher’s comment<textarea value={formTeacherComment} onChange={event => setFormTeacherComment(event.target.value)} placeholder="Enter the class teacher's report comment" /></label><label>Head / Deputy Head / T.I.C’s comment<textarea value={principalComment} onChange={event => setPrincipalComment(event.target.value)} placeholder="Enter the school office comment" /></label>{officeError && <p className="form-error">{officeError}</p>}<button type="button" className="btn primary" disabled={savingOfficeNote} onClick={saveOfficeNote}>{savingOfficeNote ? 'Saving…' : 'Save official report notes'}</button></section>}
    <footer className="junior-report-footer"><div><p><b>Next term begins on:</b> {date(nextTermBegins)}</p><p><b>Next term fees:</b> {nextTermFee == null ? 'To be confirmed' : money(nextTermFee)}</p><p><b>Parent / guardian’s signature:</b> ............................................................................................................................</p><small>This report is issued without alterations.</small></div><aside className="junior-report-stamp"><SchoolStamp /><span>School stamp</span></aside></footer>
  </section>
}
