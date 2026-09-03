import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import PortalNotice from '../../components/portal/PortalNotice'
const CURRENT_YEAR = 2026
const money = amount => `$${Number(amount ?? 0).toFixed(2)}`
export default function StudentDashboard() {
  const { supabase, user } = useAuth()
  const [state, setState] = useState({ loading: true, error: '', account: null, student: null, fee: null })
  useEffect(() => { const load = async () => {
    if (!user) return
    const { data: account, error: accountError } = await supabase.from('student_accounts').select('admission_number, class_level, class_stream, enrolled_year').eq('user_id', user.id).maybeSingle()
    if (accountError || !account) return setState({ loading: false, error: 'We could not load your student account. Please contact the school office.', account: null, student: null, fee: null })
    const [{ data: student }, { data: fee }] = await Promise.all([supabase.from('students').select('full_name').eq('auth_user_id', user.id).maybeSingle(), supabase.from('fee_balances').select('total_fees, amount_paid, term, academic_year').gte('academic_year', account.enrolled_year).eq('academic_year', CURRENT_YEAR).order('updated_at', { ascending: false }).limit(1).maybeSingle()])
    setState({ loading: false, error: '', account, student, fee })
  }; load() }, [supabase, user])
  if (state.loading) return <section className="section white"><div className="container portal-content">Loading your dashboard�</div></section>
  if (state.error) return <section className="section white"><div className="container portal-content"><PortalNotice tone="error">{state.error}</PortalNotice></div></section>
  const balance = state.fee ? Number(state.fee.total_fees) - Number(state.fee.amount_paid) : 0
  return <section className="section white"><div className="container portal-content student-dashboard"><p className="eyebrow">Student dashboard</p><h1>Welcome, {state.student?.full_name || 'Student'}</h1><div className="student-dashboard-grid"><article className="student-info-card"><h2>Your student information</h2><dl><div><dt>Class</dt><dd>{state.account.class_level} {state.account.class_stream}</dd></div><div><dt>Admission number</dt><dd>{state.account.admission_number}</dd></div><div><dt>Enrolled</dt><dd>{state.account.enrolled_year}</dd></div></dl></article><article className="student-info-card"><h2>Fees summary</h2>{state.fee ? <><p className="fee-term">{state.fee.term} {state.fee.academic_year}</p><dl><div><dt>Current term fees</dt><dd>{money(state.fee.total_fees)}</dd></div><div><dt>Balance due</dt><dd className={balance > 0 ? 'amount-due' : 'amount-clear'}>{money(balance)}</dd></div></dl><Link className="btn primary" to="/portal/student-dashboard#fees">View my fees</Link></> : <p>Fees tracking starts from your enrollment year ({state.account.enrolled_year}). No fees recorded yet.</p>}</article></div></div></section>
}