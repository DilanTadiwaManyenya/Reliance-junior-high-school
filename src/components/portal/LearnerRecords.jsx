import Card from '../ui/Card'
import { Link } from 'react-router-dom'
import { siteContent } from '../../data/siteContent'

const CURRENT_ACADEMIC_YEAR = 2026
const CURRENT_TERM = 'Term 3'
const normalizedTerm = term => String(term ?? '').trim().toLowerCase().replace(/^term\s*/, '')

// Term 3 is the active billing period. Prefer the canonical label used by the
// fee manager, then accept legacy numeric records until they are cleaned up.
export const activeFeeBalance = (fees = []) => {
  const current = fees.filter(row => Number(row.academic_year) === CURRENT_ACADEMIC_YEAR && normalizedTerm(row.term) === normalizedTerm(CURRENT_TERM))
  return current.find(row => String(row.term).trim().toLowerCase() === CURRENT_TERM.toLowerCase())
    ?? current.sort((a, b) => new Date(b.updated_at ?? 0) - new Date(a.updated_at ?? 0))[0]
    ?? [...fees].sort((a, b) => new Date(b.updated_at ?? 0) - new Date(a.updated_at ?? 0))[0]
}
export const totalOwing = (fees = []) => {
  const current = activeFeeBalance(fees)
  return current ? Math.max(0, Number(current.total_fees ?? 0) - Number(current.amount_paid ?? 0)) : 0
}

export function DisabledLearner({ reason }) {
  const leftSchool = reason === 'left_school'
  return <section className="section white"><div className="container portal-content"><div className="portal-empty-state"><h1>Access disabled</h1><p className="muted">{leftSchool ? 'This student is no longer enrolled at Reliance Learning Centre.' : 'Fees are outstanding. Please contact the school office.'}</p><p>Contact the school office on <a href={`tel:${siteContent.contact.phone.replaceAll(' ', '')}`}>{siteContent.contact.phone}</a>.</p></div></div></section>
}

export default function LearnerRecords({ student, records, fees }) {
  const owing = totalOwing(fees)
  const locked = owing > 0
  const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
  const weekly = records.attendance.filter(row => new Date(`${row.date}T00:00:00`) >= sevenDaysAgo)
  const present = weekly.filter(row => row.status === 'present' || row.status === 'late').length
  const pages = [
    { key: 'academics', title: 'Academics', summary: locked ? `Results locked — balance: $${owing.toFixed(2)} owing.` : records.academics.length ? `${records.academics.length} result${records.academics.length === 1 ? '' : 's'} available.` : 'No academic records have been shared yet.' },
    { key: 'attendance', title: 'Attendance', summary: records.attendance.length ? `${records.attendance.length} attendance record${records.attendance.length === 1 ? '' : 's'} available.` : 'No attendance records have been shared yet.' },
    { key: 'behavior', title: 'Behaviour', summary: records.behavior.length ? `${records.behavior.length} behaviour note${records.behavior.length === 1 ? '' : 's'} available.` : 'No behaviour notes have been shared yet.' },
    { key: 'sports', title: 'Sport', summary: records.sports.length ? `${records.sports.length} sport record${records.sports.length === 1 ? '' : 's'} available.` : 'No sports records have been shared yet.' },
    { key: 'awards', title: 'Awards', summary: records.awards?.length ? `${records.awards.length} award${records.awards.length === 1 ? '' : 's'} available.` : 'No awards have been shared yet.' },
    { key: 'insights', title: 'Attendance insights', summary: `This week: ${present}/${weekly.length} days present.` },
  ]
  return <div className="parent-record-launcher">{pages.map(page => <Link key={page.key} className={`parent-record-link${page.key === 'academics' && locked ? ' is-locked' : ''}`} to={`/portal/learner/${student.id}/${page.key}`}><Card className="parent-record-card"><span className="parent-record-kicker">View full record</span><h2>{page.title}</h2><p>{page.summary}</p><span className="parent-record-action">Open {page.title} <span aria-hidden="true">→</span></span></Card></Link>)}</div>
}
