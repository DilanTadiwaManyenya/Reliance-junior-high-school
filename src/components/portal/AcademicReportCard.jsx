import { useEffect, useMemo, useRef, useState } from 'react'
import { calculateGrade } from '../../utils/GradeCalculator'
import { totalOwing } from './LearnerRecords'
import { getSubjectReportComment } from '../../data/reportComments'
import seniorLogo from '../../assets/images/reliance-senior-logo.png'
import juniorLogo from '../../assets/images/reliance-junior-logo.png'
import reportWatermark from '../../assets/images/reliance-report-watermark.png'
import SchoolStamp from '../ui/SchoolStamp'
import '../../reportDashboard.css'
import '../../reportHeaderPolish.css'
import '../../reportMobile.css'

const termLabel = value => String(value).startsWith('Term') ? String(value) : `Term ${value}`
const money = value => `$${Number(value ?? 0).toFixed(2)}`
const date = value => value ? new Intl.DateTimeFormat('en-ZW', { dateStyle: 'long' }).format(new Date(`${value}T00:00:00`)) : 'To be confirmed'
const termValue = value => String(value ?? '').replace(/^term\s*/i, '')
const recordYear = row => String(row.year ?? (row.created_at ? new Date(row.created_at).getFullYear() : new Date().getFullYear()))
const awardLabels = { most_behaved: 'Most Behaved', smartest: 'Smartest', best_in_subject: 'Best in Subject', overall_best_student: 'Overall Best Student', sports_person: 'Sports Person' }
const initials = name => String(name ?? '').split(/\s+/).filter(Boolean).map(part => part[0]).join('').slice(0, 2).toUpperCase() || '—'

function StudentIdentity({ student }) {
  const [photoFailed, setPhotoFailed] = useState(false)
  const photo = student.photo_url || student.photo || student.image_url || student.profile_photo_url
  return <aside className="report-student-id" aria-label="Learner identification"><div className="report-student-photo">{photo && !photoFailed ? <img src={photo} alt={`${student.full_name} profile`} onError={() => setPhotoFailed(true)} /> : <span aria-hidden="true">{initials(student.full_name)}</span>}</div><div><b>{student.full_name}</b><small>Admission no. {student.admission_number || '—'}</small><small>{student.class_level}{student.class_stream ? ` · ${student.class_stream}` : ''}</small></div></aside>
}

export default function AcademicReportCard({ student, academics = [], attendance = [], behavior = [], sports = [], awards = [], fees = [], subjects = [], subjectTeachers = [], report = {}, reportFees = [], nextTermFee, adminAccess = false }) {
  const isSenior = /^Form\s/i.test(student.class_level || '')
  const schoolLogo = isSenior ? seniorLogo : juniorLogo
  const [selectedTerm, setSelectedTerm] = useState(() => termValue(academics[0]?.term ?? 3))
  const [year, setYear] = useState(() => recordYear(academics[0] ?? {}))
  const selectedInitialReport = useRef(false)
  useEffect(() => {
    if (selectedInitialReport.current || !academics.length) return
    const newest = academics[0]
    setSelectedTerm(termValue(newest.term))
    setYear(recordYear(newest))
    selectedInitialReport.current = true
  }, [academics])
  const locked = totalOwing(fees) > 0
  const terms = [...new Set(academics.map(row => termValue(row.term)))].sort((a, b) => Number(b) - Number(a))
  const selected = academics.filter(row => termValue(row.term) === selectedTerm && recordYear(row) === year)
  const enrolledSubjects = useMemo(() => subjects.length ? subjects : [...new Set(selected.map(row => row.subject))], [subjects, selected])
  const rows = useMemo(() => enrolledSubjects.map(subject => selected.find(row => row.subject === subject) || { subject }), [enrolledSubjects, selected])
  const assignedTeacherBySubject = useMemo(() => new Map(subjectTeachers.map(row => [String(row.subject || '').trim().toLocaleLowerCase(), row.teacher_name]).filter(([, teacherName]) => teacherName)), [subjectTeachers])
  const REPORT_CARD_PASS_MARK = 50
  const pass = rows.filter(row => row.score !== undefined && Number(row.score ?? row.percentage) >= REPORT_CARD_PASS_MARK).length
  const enteredTermMarks = rows.map(row => Number(row.term_mark ?? row.percentage ?? row.score)).filter(mark => Number.isFinite(mark) && mark >= 0 && mark <= 100)
  const termAverage = enteredTermMarks.length ? enteredTermMarks.reduce((total, mark) => total + mark, 0) / enteredTermMarks.length : null
  const overallOutcome = termAverage == null ? null : calculateGrade(termAverage, student.class_level)
  const reportForTerm = report[`${year}-${selectedTerm}`] || {}
  const nextTermBeginsOn = isSenior ? reportForTerm.senior_next_term_begins_on || reportForTerm.next_term_begins_on : reportForTerm.junior_next_term_begins_on || reportForTerm.next_term_begins_on
  const configuredNextTermFee = reportFees.find(row => String(row.academic_year) === year && String(row.term) === selectedTerm && row.class_level === student.class_level)?.amount ?? nextTermFee
  const attendanceForYear = attendance.filter(row => String(row.date || '').startsWith(year))
  const attendanceSummary = attendanceForYear.reduce((summary, row) => ({ ...summary, total: summary.total + 1, present: summary.present + (row.status === 'present' || row.status === 'late' ? 1 : 0) }), { total: 0, present: 0 })
  const attendanceRate = attendanceSummary.total ? Math.round((attendanceSummary.present / attendanceSummary.total) * 100) : null
  const highlights = [...awards.filter(row => recordYear(row) === year && termValue(row.term) === selectedTerm).map(row => ({ label: row.subject ? `${awardLabels[row.award_type] || row.award_type} — ${row.subject}` : awardLabels[row.award_type] || row.award_type })), ...sports.filter(row => recordYear(row) === year && termValue(row.term) === selectedTerm).map(row => ({ label: `${row.activity} — ${row.participated === false ? 'Did not participate' : row.achievement || 'Participated'}` }))]
  const printReport = () => {
    // The browser's print dialog also provides "Save as PDF" / "Microsoft Print to PDF".
    // A useful document title makes the downloaded file easy for parents to identify.
    const originalTitle = document.title
    document.title = `${student.full_name} - ${termLabel(selectedTerm)} ${year} Academic Report`
    window.addEventListener('afterprint', () => { document.title = originalTitle }, { once: true })
    window.print()
  }

  if (locked && !adminAccess) return <section className="report-card report-card-locked"><h2>Academic report card</h2><p><strong>Academic results locked — balance owing: {money(totalOwing(fees))}.</strong></p><p>If you want to view the report results, please kindly pay up your fees with the school office.</p></section>
  return <section className="report-card report-dashboard" id="academic-report-card">
    <img className="report-watermark" src={reportWatermark} alt="" aria-hidden="true" />
    <div className="report-card-top"><header className="report-card-header"><img src={schoolLogo} alt={`Reliance Learning Centre ${isSenior ? 'Senior School' : 'Junior School'} crest`} /><div><p>Reliance Learning Centre</p><h2>{isSenior ? 'Senior School' : 'Junior School'} Academic Report</h2><span>Emancipation through Education</span></div></header><div className="report-header-aside"><div className="report-student-identification"><StudentIdentity student={student} /></div><aside className="report-office-stamp" aria-label="Official school verification"><small>Office use only</small><SchoolStamp className="report-header-stamp" /></aside></div><div className="report-card-actions no-print">{adminAccess && <span className="report-admin-access">Administrator copy</span>}<label>Term<select value={selectedTerm} onChange={e => setSelectedTerm(e.target.value)}>{(terms.length ? terms : ['1', '2', '3']).map(term => <option key={term} value={term}>{termLabel(term)}</option>)}</select></label><label>Year<input type="number" value={year} onChange={e => setYear(e.target.value)} /></label><button className="btn primary" type="button" onClick={printReport}>Print / Download PDF</button><p className="report-pdf-hint">Choose your printer, or select <b>Save as PDF</b> in the dialog.</p></div></div>
    <div className="report-card-meta"><span><b>Form:</b> {student.class_level} {student.class_stream || ''}</span><span><b>Term:</b> {termLabel(selectedTerm)}</span><span><b>Year:</b> {year}</span></div>
    <section className="report-dashboard-stats" aria-label="Term performance summary"><article className="report-stat report-stat-average"><strong>{termAverage == null ? '—' : `${termAverage.toFixed(1)}%`}</strong><span>Term Average</span></article><article className="report-stat report-stat-standing"><strong>{overallOutcome?.grade || '—'}</strong><span>{overallOutcome?.description || 'Overall standing'}</span></article><article className="report-stat report-stat-status"><strong>{pass}/{rows.length}</strong><span>Subjects passed · Attendance {attendanceRate == null ? '—' : `${attendanceRate}%`}</span></article></section>
    <div className="portal-table-wrap"><table className="portal-table report-table"><thead><tr><th>Learning Area</th><th>Term Mark</th><th>Exam Mark</th><th>Grade</th><th>Facilitator's Comment</th><th>Sign</th></tr></thead><tbody>{rows.map(row => { const termMark = row.term_mark ?? row.percentage ?? row.score; const examMark = row.exam_mark; const hasTermMark = termMark !== undefined && termMark !== null && termMark !== ''; const hasExamMark = examMark !== undefined && examMark !== null && examMark !== ''; const finalMark = hasExamMark ? Number(examMark) : termMark; const grade = row.grade || (hasTermMark || hasExamMark ? calculateGrade(finalMark, student.class_level)?.grade : ''); const facilitatorComment = (hasTermMark || hasExamMark) && grade ? getSubjectReportComment({ studentId: student.id, subject: row.subject, term: selectedTerm, year, grade }) : null; const assignedTeacher = assignedTeacherBySubject.get(String(row.subject || '').trim().toLocaleLowerCase()); const signature = assignedTeacher ? initials(assignedTeacher) : row.teacher_initials || '—'; return <tr key={row.subject}><td>{row.subject}</td><td>{termMark ?? '—'}</td><td>{examMark ?? '—'}</td><td>{grade || '—'}</td><td className={`report-facilitator-comment${facilitatorComment?.language === 'shona' ? ' is-shona' : ''}`}>{facilitatorComment?.text}</td><td className="report-sign-cell" aria-label={`Assigned teacher signature for ${row.subject}`} title={assignedTeacher ? `Assigned teacher: ${assignedTeacher}` : 'No teacher assigned'}>{signature}</td></tr> })}</tbody></table></div>
    {!rows.length && <p className="muted">No enrolled subjects or academic records have been published for this term.</p>}
    <section className="report-learner-summary report-dashboard-secondary"><article><span>Conduct &amp; behavior</span><strong>✓ {behavior.length ? `${behavior.filter(row => row.severity === 'positive').length} positive note${behavior.filter(row => row.severity === 'positive').length === 1 ? '' : 's'} recorded` : 'No notes recorded'}</strong><small>{attendanceRate == null ? 'Attendance records are not yet available.' : `Attendance: ${attendanceRate}% (${attendanceSummary.present}/${attendanceSummary.total})`}</small></article><article><span>Awards &amp; sports</span>{highlights.length ? <ul className="report-highlights-list">{highlights.map((highlight, index) => <li key={`${highlight.label}-${index}`}>{highlight.label}</li>)}</ul> : <small>No awards or sport highlights recorded for this term.</small>}</article></section>
    <footer className="report-next"><span><b>Next Term Begins On:</b> {date(nextTermBeginsOn)}</span><span><b>Next Term Fees:</b> {configuredNextTermFee != null ? money(configuredNextTermFee) : 'To be confirmed'}</span></footer>
  </section>
}
