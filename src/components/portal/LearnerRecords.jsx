import Card from '../ui/Card'
import { Link } from 'react-router-dom'
import { siteContent } from '../../data/siteContent'
import { feeOwingSummary, totalOwing } from '../../lib/learnerFees'

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
    { key: 'academics', title: 'Academics', summary: locked ? `Results locked — balance: ${feeOwingSummary(fees)} owing.` : records.academics.length ? `${records.academics.length} result${records.academics.length === 1 ? '' : 's'} available.` : 'No academic records have been shared yet.' },
    { key: 'coursework', title: 'Course Work', summary: records.coursework?.length ? `${records.coursework.length} coursework mark${records.coursework.length === 1 ? '' : 's'} available.` : 'No coursework marks have been shared yet.' },
    { key: 'attendance', title: 'Attendance', summary: records.attendance.length ? `${records.attendance.length} attendance record${records.attendance.length === 1 ? '' : 's'} available.` : 'No attendance records have been shared yet.' },
    { key: 'behavior', title: 'Behaviour', summary: records.behavior.length ? `${records.behavior.length} behaviour note${records.behavior.length === 1 ? '' : 's'} available.` : 'No behaviour notes have been shared yet.' },
    { key: 'sports', title: 'Sport', summary: records.sports.length ? `${records.sports.length} sport record${records.sports.length === 1 ? '' : 's'} available.` : 'No sports records have been shared yet.' },
    { key: 'awards', title: 'Awards', summary: records.awards?.length ? `${records.awards.length} award${records.awards.length === 1 ? '' : 's'} available.` : 'No awards have been shared yet.' },
    { key: 'insights', title: 'Attendance insights', summary: `This week: ${present}/${weekly.length} days present.` },
  ]
  return <div className="parent-record-launcher">{pages.map(page => <Link key={page.key} className={`parent-record-link${page.key === 'academics' && locked ? ' is-locked' : ''}`} to={`/portal/learner/${student.id}/${page.key}`}><Card className="parent-record-card"><span className="parent-record-kicker">View full record</span><h2>{page.title}</h2><p>{page.summary}</p><span className="parent-record-action">Open {page.title} <span aria-hidden="true">→</span></span><span className="parent-record-mobile-arrow" aria-hidden="true">→</span></Card></Link>)}</div>
}
