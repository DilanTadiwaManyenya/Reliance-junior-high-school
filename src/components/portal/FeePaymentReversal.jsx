import { useRef, useState } from 'react'
import { useAuth } from '../../context/useAuth'
import './feePaymentReversal.css'

export default function FeePaymentReversal({ payment, onReversed }) {
 const { supabase, profile } = useAuth()
 const mainAdmin = (profile?.active_role ?? profile?.role) === 'admin' && profile?.campus === 'all'
 const [reason,setReason] = useState('')
 const [busy,setBusy] = useState(false)
 const [error,setError] = useState('')
 const running = useRef(false)
 if (payment.status === 'reversed') return <div><strong>REVERSED — excluded from collections</strong><p>Reason: {payment.reversal_reason}</p><p>{payment.reversed_at ? new Date(payment.reversed_at).toLocaleString('en-ZW', {timeZone:'Africa/Harare'}) : ''} (Harare)</p></div>
 if (!mainAdmin) return null
 if (payment.payment_method === 'recorded') return <p>Legacy opening balance — separate review required.</p>
 const reverse = async event => {
  event.preventDefault()
  if (running.current || !window.confirm('Reverse this fee payment and update the learner balance? This does not refund money.')) return
  running.current=true; setBusy(true); setError('')
  let timeout
  try {
   const result=await Promise.race([
    supabase.rpc('reverse_learner_fee_payment',{p_payment_id:payment.id,p_reason:reason.trim()}),
    new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('Confirmation timed out. Retry this same reversal; it cannot subtract twice.')),15000)}),
   ])
   if (result.error) throw result.error
   if (result.data?.status !== 'reversed') throw new Error('Reversal was not confirmed. Refresh the history before trying again.')
   onReversed()
  } catch (failure) { setError(failure.message || 'Reversal not confirmed. Retry this same reversal safely.') }
  finally { clearTimeout(timeout); running.current=false; setBusy(false) }
 }
 return <form onSubmit={reverse} className="fee-reversal-form">
  <p>Main Admin correction only. The original payment stays in history. No refund is issued.</p>
  <label>Reason for fee reversal<textarea required minLength={5} maxLength={1000} value={reason} disabled={busy} onChange={event=>setReason(event.target.value)} /></label>
  {error && <p role="alert">{error}</p>}
  <button type="submit" className="fee-button fee-button-secondary" disabled={busy || reason.trim().length<5}>{busy?'Reversing…':'Reverse fee payment'}</button>
 </form>
}
