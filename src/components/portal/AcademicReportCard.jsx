import { useEffect, useMemo, useRef, useState } from 'react'
import { calculateGrade } from '../../utils/GradeCalculator'
import { totalOwing } from './LearnerRecords'
import { getSubjectReportComment } from '../../data/reportComments'

const termLabel = value => String(value).startsWith('Term') ? String(value) : `Term ${value}`
const money = value => `$${Number(value ?? 0).toFixed(2)}`
const date = value => value ? new Intl.DateTimeFormat('en-ZW', { dateStyle: 'long' }).format(new Date(`${value}T00:00:00`)) : 'To be confirmed'
const termValue = value => String(value ?? '').replace(/^term\s*/i, '')
const recordYear = row => String(row.year ?? (row.created_at ? new Date(row.created_at).getFullYear() : new Date().getFullYear()))

export default function AcademicReportCard({ student, academics = [], attendance = [], fees = [], subjects = [], report = {}, nextTermFee }) {
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
  const enrolledSubjects = subjects.length ? subjects : [...new Set(selected.map(row => row.subject))]
  const rows = useMemo(() => enrolledSubjects.map(subject => selected.find(row => row.subject === subject) || { subject }), [enrolledSubjects, selected])
  const REPORT_CARD_PASS_MARK = 50
  const pass = rows.filter(row => row.score !== undefined && Number(row.score ?? row.percentage) >= REPORT_CARD_PASS_MARK).length
  const fail = rows.filter(row => row.score !== undefined && Number(row.score ?? row.percentage) < REPORT_CARD_PASS_MARK).length
  const reportForTerm = report[`${year}-${selectedTerm}`] || {}

  if (locked) return <section className="report-card report-card-locked"><h2>Academic report card</h2><p><strong>Academic results locked — balance owing: {money(totalOwing(fees))}.</strong></p><p>Please settle fees with the school office to view this report card.</p></section>
  return <section className="report-card" id="academic-report-card">
    <div className="report-card-actions no-print"><label>Term<select value={selectedTerm} onChange={e => setSelectedTerm(e.target.value)}>{(terms.length ? terms : ['1', '2', '3']).map(term => <option key={term} value={term}>{termLabel(term)}</option>)}</select></label><label>Year<input type="number" value={year} onChange={e => setYear(e.target.value)} /></label><button className="btn primary" type="button" onClick={() => window.print()}>Print / Save as PDF</button></div>
    <header className="report-card-header"><img src="/reliance-crest.svg" alt="Reliance Learning Centre crest" /><div><p>Reliance Learning Centre</p><h2>Senior School Academic Report</h2><span>Excellence through learning</span></div></header>
    <div className="report-card-meta"><span><b>Form:</b> {student.class_level} {student.class_stream || ''}</span><span><b>Term:</b> {termLabel(selectedTerm)}</span><span><b>Year:</b> {year}</span></div>
    <div className="portal-table-wrap"><table className="portal-table report-table"><thead><tr><th>Learning Area</th><th>Term Mark</th><th>Exam Mark</th><th>Grade</th><th>Facilitator's Comment</th><th>Sign</th></tr></thead><tbody>{rows.map(row => { const termMark = row.term_mark ?? row.percentage ?? row.score; const examMark = row.exam_mark; const hasMark = termMark !== undefined && termMark !== null && termMark !== ''; const finalMark = hasMark && examMark !== undefined && examMark !== null ? (Number(termMark) * .3) + (Number(examMark) * .7) : termMark; const grade = row.grade || (hasMark ? calculateGrade(finalMark, student.class_level)?.grade : ''); const facilitatorComment = hasMark && grade ? getSubjectReportComment({ studentId: student.id, subject: row.subject, term: selectedTerm, year, grade }) : null; return <tr key={row.subject}><td>{row.subject}</td><td>{termMark ?? '—'}</td><td>{examMark ?? '—'}</td><td>{grade || '—'}</td><td className={`report-facilitator-comment${facilitatorComment?.language === 'shona' ? ' is-shona' : ''}`}>{facilitatorComment?.text}</td><td className="report-sign-cell" aria-label={`Facilitator signature for ${row.subject}`}></td></tr> })}</tbody></table></div>
    {!rows.length && <p className="muted">No enrolled subjects or academic records have been published for this term.</p>}
    <div className="report-summary"><div><b>Number of Subjects:</b> {rows.length}</div><div><b>Out Of:</b> {rows.length}</div><div><b>Pass / Fail:</b> {pass} / {fail}</div></div>
    <footer className="report-next"><span><b>Next Term Begins On:</b> {date(reportForTerm.next_term_begins_on)}</span><span><b>Next Term Fees:</b> {reportForTerm.next_term_fees != null ? money(reportForTerm.next_term_fees) : nextTermFee != null ? money(nextTermFee) : 'To be confirmed'}</span></footer>
  </section>
}
