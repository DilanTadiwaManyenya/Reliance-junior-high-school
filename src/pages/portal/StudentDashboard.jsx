import { useEffect, useState } from 'react'
import { useAuth } from '../../context/useAuth'
import LearnerRecords, { DisabledLearner } from '../../components/portal/LearnerRecords'

export default function StudentDashboard() {
  const { supabase, user } = useAuth()
  const [student, setStudent] = useState(null)
  const [records, setRecords] = useState({ academics: [], attendance: [], behavior: [], sports: [] })
  const [fees, setFees] = useState([])
  useEffect(() => { const load = async () => {
    const { data } = await supabase.from('students').select('*').eq('auth_user_id', user.id).maybeSingle()
    setStudent(data); if (!data || data.status !== 'active') return
    const [academics, attendance, behavior, sports, balances] = await Promise.all([
      supabase.from('academic_records').select('*').eq('student_id', data.id).order('created_at', { ascending: false }),
      supabase.from('attendance').select('*').eq('student_id', data.id).order('date', { ascending: false }),
      supabase.from('behavior_notes').select('*').eq('student_id', data.id).order('created_at', { ascending: false }),
      supabase.from('sports_records').select('*').eq('student_id', data.id).order('created_at', { ascending: false }),
      supabase.from('fee_balances').select('*').eq('student_id', data.id),
    ])
    setRecords({ academics: academics.data ?? [], attendance: attendance.data ?? [], behavior: behavior.data ?? [], sports: sports.data ?? [] }); setFees(balances.data ?? [])
  }; load() }, [supabase, user])
  if (!student) return <section className="section white"><div className="container portal-content">Loading your records…</div></section>
  if (student.status !== 'active') return <DisabledLearner reason={student.inactive_reason} />
  return <section className="section white"><div className="container portal-content"><p className="eyebrow">Student dashboard</p><h1>{student.full_name}</h1><LearnerRecords student={student} records={records} fees={fees} /></div></section>
}
