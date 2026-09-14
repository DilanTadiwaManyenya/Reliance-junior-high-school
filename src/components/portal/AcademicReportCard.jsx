import { useMemo, useState } from 'react'
import { calculateGrade } from '../../utils/GradeCalculator'
import { totalOwing } from './LearnerRecords'

const termLabel = value => String(value).startsWith('Term') ? String(value) : `Term ${value}`
const money = value => `$${Number(value ?? 0).toFixed(2)}`
const date = value => value ? new Intl.DateTimeFormat('en-ZW', { dateStyle: 'long' }).format(new Date(`${value}T00:00:00`)) : 'To be confirmed'

export default function AcademicReportCard({ student, academics = [], attendance = [], fees = [], subjects = [], report = {}, nextTermFee }) {
  const [selectedTerm, setSelectedTerm] = useState(() => String(academics[0]?.term ?? 3))
  const [year, setYear] = useState(() => String(academics[0]?.year ?? new Date().getFullYear()))
  const locked = totalOwing(fees) > 0
  const terms = [...new Set(academics.map(row => String(row.term)))].sort((a, b) => Number(b) - Number(a))
  const selected = academics.filter(row => String(row.term) === selectedTerm && String(row.year ?? new Date().getFullYear()) === year)
  const enrolledSubjects = subjects.length ? subjects : [...new Set(selected.map(row => row.subject))]
  const rows = useMemo(() => enrolledSubjects.map(subject => selected.find(row => row.subject === subject) || { subject }), [enrolledSubjects, selected])
  const attendanceRows = attendance.filter(row => String(row.term) === selectedTerm && String(row.year ?? new Date(row.date).getFullYear()) === year)
  const present = attendanceRows.filter(row => row.status === 'present' || row.status === 'late').length
  const REPORT_CARD_PASS_MARK = 50
  const pass = rows.filter(row => row.score !== undefined && Number(row.score ?? row.percentage) >= REPORT_CARD_PASS_MARK).length
  const fail = rows.filter(row => row.score !== undefined && Number(row.score ?? row.percentage) < REPORT_CARD_PASS_MARK).length
  const reportForTerm = report[`${year}-${selectedTerm}`] || {}

  if (locked) return <section className="report-card report-card-locked"><h2>Academic report card</h2><p><strong>Academic results locked — balance owing: {money(totalOwing(fees))}.</strong></p><p>Please settle fees with the school office to view this report card.</p></section>
  return <section className="report-card" id="academic-report-card">
    <div className="report-card-actions no-print"><label>Term<select value={selectedTerm} onChange={e => setSelectedTerm(e.target.value)}>{(terms.length ? terms : ['1', '2', '3']).map(term => <option key={term} value={term}>{termLabel(term)}</option>)}</select></label><label>Year<input type="number" value={year} onChange={e => setYear(e.target.value)} /></label><button className="btn primary" type="button" onClick={() => window.print()}>Print / Save as PDF</button></div>
    <header className="report-card-header"><img src="/reliance-crest.svg" alt="Reliance Learning Centre crest" /><div><p>Reliance Learning Centre</p><h2>Senior School Academic Report</h2><span>Excellence through learning</span></div></header>
    <div className="report-card-meta"><span><b>Form:</b> {student.class_level} {student.class_stream || ''}</span><span><b>Term:</b> {termLabel(selectedTerm)}</span><span><b>Year:</b> {year}</span><span><b>Attendance:</b> {present} days out of {attendanceRows.length} days</span></div>
    <div className="portal-table-wrap"><table className="portal-table report-table"><thead><tr><th>Learning Area</th><th>Term Mark</th><th>Exam Mark</th><th>Grade</th><th>Facilitator's Comment</th></tr></thead><tbody>{rows.map(row => { const mark = row.percentage ?? row.score; const grade = row.grade || (mark !== undefined ? calculateGrade(mark, student.class_level)?.grade : ''); return <tr key={row.subject}><td>{row.subject}</td><td>{mark ?? '—'}</td><td>{row.exam_mark ?? '—'}</td><td>{grade || '—'}</td><td>{row.teachers_comment || row.comment || '—'}</td></tr> })}</tbody></table></div>
    {!rows.length && <p className="muted">No enrolled subjects or academic records have been published for this term.</p>}
    <div className="report-summary"><div><b>Number of Subjects:</b> {rows.length}</div><div><b>Out Of:</b> {rows.length}</div><div><b>Pass / Fail:</b> {pass} / {fail}</div></div>
    <div className="report-comments"><p><b>Form Teacher's Comment</b><br />{reportForTerm.form_teacher_comment || 'No form teacher comment has been entered.'}</p><p><b>Headmaster / Deputy Comment</b><br />{reportForTerm.principal_comment || 'No headmaster or deputy comment has been entered.'}</p></div>
    <footer className="report-next"><span><b>Next Term Begins On:</b> {date(reportForTerm.next_term_begins_on)}</span><span><b>Next Term Fees:</b> {reportForTerm.next_term_fees != null ? money(reportForTerm.next_term_fees) : nextTermFee != null ? money(nextTermFee) : 'To be confirmed'}</span></footer>
  </section>
}
