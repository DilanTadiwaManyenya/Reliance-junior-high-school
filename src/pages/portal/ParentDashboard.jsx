import { useEffect, useState } from 'react'
import PortalNotice from '../../components/portal/PortalNotice'
import LearnerRecords, { DisabledLearner } from '../../components/portal/LearnerRecords'
import { useAuth } from '../../context/useAuth'
import { siteContent } from '../../data/siteContent'

export default function ParentDashboard() {
  const { supabase, user } = useAuth(); const [students, setStudents] = useState([]); const [selectedId, setSelectedId] = useState(''); const [records, setRecords] = useState({ academics: [], attendance: [], behavior: [], sports: [] }); const [fees, setFees] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('')
  useEffect(() => { const load = async () => { const { data, error: linkError } = await supabase.from('parent_student').select('student:students(*)').eq('parent_id', user.id).not('verified_at', 'is', null); if (linkError) setError(linkError.message); const linked = data?.map(row => row.student).filter(Boolean) ?? []; setStudents(linked); setSelectedId(linked[0]?.id ?? ''); setLoading(false) }; load() }, [supabase, user])
  useEffect(() => { if (!selectedId) return; const load = async () => { const [academics, attendance, behavior, sports, balances] = await Promise.all([
    supabase.from('academic_records').select('*').eq('student_id', selectedId).order('created_at', { ascending: false }), supabase.from('attendance').select('*').eq('student_id', selectedId).order('date', { ascending: false }), supabase.from('behavior_notes').select('*').eq('student_id', selectedId).order('created_at', { ascending: false }), supabase.from('sports_records').select('*').eq('student_id', selectedId).order('created_at', { ascending: false }), supabase.from('fee_balances').select('*').eq('student_id', selectedId),
  ]); const failed = [academics, attendance, behavior, sports, balances].find(result => result.error); if (failed?.error) setError(failed.error.message); setRecords({ academics: academics.data ?? [], attendance: attendance.data ?? [], behavior: behavior.data ?? [], sports: sports.data ?? [] }); setFees(balances.data ?? []) }; load() }, [selectedId, supabase])
  const student = students.find(row => row.id === selectedId)
  if (loading) return <section className="section white"><div className="container">Loading learner records…</div></section>
  if (!students.length) return <section className="section white"><div className="container portal-content"><div className="portal-empty-state"><p className="eyebrow">Parent dashboard</p><h1>No learner connection found</h1><p className="muted">We could not find a verified learner connection for this account.</p><p>Contact the school office on <a href={`tel:${siteContent.contact.phone.replaceAll(' ', '')}`}>{siteContent.contact.phone}</a>.</p></div></div></section>
  if (student?.status !== 'active') return <DisabledLearner reason={student?.inactive_reason} />
  return <section className="section white"><div className="container portal-content"><p className="eyebrow">Parent dashboard</p><h1>{student?.full_name}</h1>{students.length > 1 && <label className="portal-switcher">Viewing learner<select value={selectedId} onChange={e => setSelectedId(e.target.value)}>{students.map(row => <option key={row.id} value={row.id}>{row.full_name} · {row.class_level} {row.class_stream}</option>)}</select></label>}{error && <PortalNotice tone="error">{error}</PortalNotice>}<LearnerRecords student={student} records={records} fees={fees} /></div></section>
}
