import Card from '../ui/Card'
import { LineChart, Line, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { siteContent } from '../../data/siteContent'

const terms = ['Term 1', 'Term 2', 'Term 3']
const date = (value) => new Intl.DateTimeFormat('en-ZW', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`))

export const totalOwing = (fees = []) => fees.reduce((sum, fee) => sum + Number(fee.total_fees) - Number(fee.amount_paid), 0)

export function DisabledLearner({ reason }) {
  const leftSchool = reason === 'left_school'
  return <section className="section white"><div className="container portal-content"><div className="portal-empty-state"><h1>Access disabled</h1><p className="muted">{leftSchool ? 'This student is no longer enrolled at Reliance Learning Centre.' : 'Fees are outstanding. Please contact the school office.'}</p><p>Contact the school office on <a href={`tel:${siteContent.contact.phone.replaceAll(' ', '')}`}>{siteContent.contact.phone}</a>.</p></div></div></section>
}

export default function LearnerRecords({ student, records, fees }) {
  const owing = totalOwing(fees)
  const locked = owing > 0
  const graph = terms.map((term) => {
    const academic = records.academics.filter(row => row.term === term)
    const attendance = records.attendance.filter(row => row.term === term)
    return { term, academic: academic.length ? academic.reduce((sum, row) => sum + Number(row.score), 0) / academic.length : null, attendance: attendance.length ? (attendance.filter(row => row.status === 'present' || row.status === 'late').length / attendance.length) * 100 : null }
  })
  const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
  const weekly = records.attendance.filter(row => new Date(`${row.date}T00:00:00`) >= sevenDaysAgo)
  const present = weekly.filter(row => row.status === 'present' || row.status === 'late').length
  return <><div className="portal-record-grid"><Card className={locked ? 'portal-fee-warning' : ''}><h2>Academic status</h2>{locked ? <p><strong>Academic results locked — Balance: ${owing.toFixed(2)} owing.</strong><br />Please settle fees with the school office to view results. {siteContent.contact.phone}</p> : records.academics.length ? <div className="portal-list">{records.academics.map(row => <p key={row.id}><strong>{row.subject}</strong> · {row.score} ({row.grade}){row.comment && <><br /><span className="muted">{row.comment}</span></>}</p>)}</div> : <p className="muted">No academic records have been shared yet.</p>}</Card><Card><h2>Attendance</h2>{records.attendance.length ? <div className="portal-list">{records.attendance.map(row => <p key={row.id}><strong>{date(row.date)}</strong> <span className={`portal-status ${row.status}`}>{row.status}</span>{row.note && <><br /><span className="muted">{row.note}</span></>}</p>)}</div> : <p className="muted">No attendance records have been shared yet.</p>}</Card><Card><h2>Behaviour</h2>{records.behavior.length ? <div className="portal-list">{records.behavior.map(row => <p key={row.id}><span className={`portal-status ${row.severity}`}>{row.severity}</span> <strong>{row.category}</strong><br /><span className="muted">{row.description}</span></p>)}</div> : <p className="muted">No behaviour notes have been shared yet.</p>}</Card><Card><h2>Sport</h2>{records.sports.length ? <div className="portal-list">{records.sports.map(row => <p key={row.id}><strong>{row.activity}</strong> · {row.term}{row.achievement && ` · ${row.achievement}`}{row.note && <><br /><span className="muted">{row.note}</span></>}</p>)}</div> : <p className="muted">No sports records have been shared yet.</p>}</Card><Card><h2>Attendance insight</h2><p><strong>Attendance this week: {present}/{weekly.length} days present.</strong></p><p className="muted">Computed from records entered during the last seven days.</p></Card></div><Card className="portal-performance"><h2>Performance by term</h2><div style={{ width: '100%', height: 300 }}><ResponsiveContainer><LineChart data={graph}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="term" /><YAxis /><Tooltip />{!locked && <Line type="monotone" dataKey="academic" name="Academic Average" stroke="#A6302F" connectNulls />}<Line type="monotone" dataKey="attendance" name="Attendance %" stroke="#1B2A56" connectNulls /></LineChart></ResponsiveContainer></div></Card></>
}
