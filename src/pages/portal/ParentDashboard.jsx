import { useEffect, useState } from 'react'
import Card from '../../components/ui/Card'
import PortalNotice from '../../components/portal/PortalNotice'
import { useAuth } from '../../context/useAuth'
import { siteContent } from '../../data/siteContent'

const formatDate = (value) => new Intl.DateTimeFormat('en-ZW', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`))

export default function ParentDashboard() {
  const { supabase, user } = useAuth()
  const [students, setStudents] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [records, setRecords] = useState({ academics: [], attendance: [], behavior: [], sports: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    const loadStudents = async () => {
      const { data, error: linkError } = await supabase.from('parent_student').select('student:students(*)').eq('parent_id', user.id).not('verified_at', 'is', null)
      if (linkError) setError(linkError.message)
      const linkedStudents = data?.map(link => link.student).filter(Boolean) ?? []
      setStudents(linkedStudents); setSelectedId(linkedStudents[0]?.id ?? ''); setLoading(false)
    }
    loadStudents()
  }, [supabase, user])
  useEffect(() => {
    if (!selectedId) return
    const loadRecords = async () => {
      const [academics, attendance, behavior, sports] = await Promise.all([
        supabase.from('academic_records').select('*').eq('student_id', selectedId).order('created_at', { ascending: false }),
        supabase.from('attendance').select('*').eq('student_id', selectedId).order('date', { ascending: false }),
        supabase.from('behavior_notes').select('*').eq('student_id', selectedId).order('created_at', { ascending: false }),
        supabase.from('sports_records').select('*').eq('student_id', selectedId).order('created_at', { ascending: false }),
      ])
      const failed = [academics, attendance, behavior, sports].find(result => result.error)
      if (failed?.error) setError(failed.error.message)
      setRecords({ academics: academics.data ?? [], attendance: attendance.data ?? [], behavior: behavior.data ?? [], sports: sports.data ?? [] })
    }
    loadRecords()
  }, [selectedId, supabase])
  const selectedStudent = students.find(student => student.id === selectedId)
  const groupedAcademics = records.academics.reduce((groups, record) => ({ ...groups, [record.term]: [...(groups[record.term] ?? []), record] }), {})
  if (loading) return <section className="section white"><div className="container">Loading learner records…</div></section>
  if (!students.length) return <section className="section white"><div className="container portal-content"><div className="portal-empty-state"><span className="portal-empty-icon" aria-hidden="true">⌂</span><p className="eyebrow">Parent dashboard</p><h1>No learner connection found</h1><p className="muted">We could not find a verified learner connection for this account. Please contact the school office to confirm the admission number and date of birth.</p><div className="portal-empty-next"><strong>Need help?</strong><span>Contact the school office on <a href={`tel:${siteContent.contact.phone.replaceAll(' ', '')}`}>{siteContent.contact.phone}</a> with your learner’s admission details.</span></div></div></div></section>
  return <section className="section white"><div className="container portal-content"><p className="eyebrow">Parent dashboard</p><h1>{selectedStudent?.full_name}</h1>{students.length > 1 && <label className="portal-switcher">Viewing learner<select value={selectedId} onChange={e => setSelectedId(e.target.value)}>{students.map(student => <option key={student.id} value={student.id}>{student.full_name} · {student.class_level} {student.class_stream}</option>)}</select></label>}{error && <PortalNotice tone="error">{error}</PortalNotice>}<div className="portal-record-grid"><Card><h2>Academic status</h2>{Object.keys(groupedAcademics).length ? Object.entries(groupedAcademics).map(([term, termRecords]) => <div key={term} className="portal-list"><h3>{term}</h3>{termRecords.map(record => <p key={record.id}><strong>{record.subject}</strong> · {record.score} ({record.grade}){record.comment && <><br /><span className="muted">{record.comment}</span></>}</p>)}</div>) : <p className="muted">No academic records have been shared yet.</p>}</Card><Card><h2>Attendance</h2>{records.attendance.length ? <div className="portal-list">{records.attendance.map(record => <p key={record.id}><strong>{formatDate(record.date)}</strong> <span className={`portal-status ${record.status}`}>{record.status}</span>{record.status === 'late' && <> · {record.late_minutes} minutes late</>}{record.note && <><br /><span className="muted">{record.note}</span></>}</p>)}</div> : <p className="muted">No attendance records have been shared yet.</p>}</Card><Card><h2>Behaviour</h2>{records.behavior.length ? <div className="portal-list">{records.behavior.map(record => <p key={record.id}><span className={`portal-status ${record.severity}`}>{record.severity}</span> <strong>{record.category}</strong><br /><span className="muted">{record.description}</span></p>)}</div> : <p className="muted">No behaviour notes have been shared yet.</p>}</Card><Card><h2>Sport</h2>{records.sports.length ? <div className="portal-list">{records.sports.map(record => <p key={record.id}><strong>{record.activity}</strong> · {record.term}{record.achievement && <> · {record.achievement}</>}{record.note && <><br /><span className="muted">{record.note}</span></>}</p>)}</div> : <p className="muted">No sports records have been shared yet.</p>}</Card></div></div></section>
}
