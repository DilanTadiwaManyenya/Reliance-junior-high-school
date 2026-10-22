import MobileRecordTable from './MobileRecordTable'
import OperationsExports from './OperationsExports'
import { readAllRows } from '../../lib/operationsExport'
import { useEffect, useRef, useState } from 'react'
import { FINANCE_CURRENCIES, formatMoney } from '../../lib/currency'
import { needsExpenseCampusChoice, resolveExpenseCampus } from '../../lib/expenseCampus'
import { activeExpenseRows, expenseSubmissionKey, loadExpenseSubmission } from '../../lib/expenseSubmission'
import './expenseControls.css'

const empty = () => ({ expense_date: new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Harare',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()), category:'Fuel', supplier:'', description:'', amount:'', currency:'USD', payment_method:'cash', receipt_reference:'' })
const money = (value,currency='USD') => formatMoney(value,currency)
async function confirmedRequest(request) {
 let timer
 try {
  const result=await Promise.race([request,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Confirmation timed out. Retry the same operation safely.')),15000)})])
  if (result.error) throw result.error
  return result.data
 } finally { clearTimeout(timer) }
}

export default function ExpensesCashbook({ supabase,user,profile }) {
 const role=profile?.active_role??profile?.role
 const mainAdmin=role==='admin'&&profile?.campus==='all'
 const canSubmit=mainAdmin||(role==='accountant'&&['junior','senior'].includes(profile?.campus))
 const requiresCampusChoice=needsExpenseCampusChoice(role,profile?.campus)
 const [selectedCampus,setSelectedCampus]=useState('')
 const campus=resolveExpenseCampus(role,profile?.campus,selectedCampus)
 const [rows,setRows]=useState([])
 const [form,setForm]=useState(empty)
 const [message,setMessage]=useState('')
 const [error,setError]=useState('')
 const [currency,setCurrency]=useState('USD')
 const [busy,setBusy]=useState(false)
 const running=useRef(false)
 const storageKey=expenseSubmissionKey(user?.id)
 const [pendingSubmission,setPendingSubmission]=useState(()=>{
  try { return loadExpenseSubmission(sessionStorage,storageKey) } catch { return {invalid:true} }
 })
 const [correction,setCorrection]=useState(null)
 const [reason,setReason]=useState('')
 const load=async()=>{
  try { const data=await readAllRows(()=>supabase.from('school_expenses').select('*')); setRows(data.sort((a,b)=>b.created_at.localeCompare(a.created_at))) }
  catch(failure) { setError('Refresh failed: '+failure.message+'. Confirmed operations remain saved.') }
 }
 useEffect(()=>{
  let active=true
  readAllRows(()=>supabase.from('school_expenses').select('*')).then(data=>{
   if(active)setRows(data.sort((a,b)=>b.created_at.localeCompare(a.created_at)))
  }).catch(failure=>{if(active)setError(failure.message)})
  return()=>{active=false}
 },[supabase])

 const sendSubmission=async submission=>{
  if(running.current||submission?.invalid)return
  running.current=true;setBusy(true);setError('');setMessage('')
  try {
   const saved=await confirmedRequest(supabase.rpc('submit_school_expense',submission))
   if(!saved?.id)throw new Error('Expense confirmation missing')
   sessionStorage.removeItem(storageKey);setPendingSubmission(null)
   setForm({...empty(),currency:submission.p_expense.currency})
   setMessage(saved.status==='reversed'?'The original expense was reversed. No new entry was created.':'Expense saved. Its current approval status is shown in the cashbook.')
   await load()
  } catch(failure) {
   if(failure.code==='P0001') {
    sessionStorage.removeItem(storageKey);setPendingSubmission(null);setError(failure.message)
   } else setError('Expense confirmation is unresolved. Retry the saved submission before entering another expense; it cannot create a duplicate.')
  } finally {running.current=false;setBusy(false)}
 }
 const submit=async event=>{
  event.preventDefault()
  if(running.current||pendingSubmission||!canSubmit)return
  if(!campus)return setError('Choose a campus before submitting this expense.')
  const submission={p_request_id:crypto.randomUUID(),p_expense:{...form,amount:Number(form.amount),campus}}
  try {sessionStorage.setItem(storageKey,JSON.stringify(submission))}
  catch {setError('Enable browser session storage before submitting an expense.');return}
  setPendingSubmission(submission)
  await sendSubmission(submission)
 }
 const review=async(id,status)=>{
  if(running.current||!mainAdmin)return
  running.current=true;setBusy(true);setError('');setMessage('')
  try {
   await confirmedRequest(supabase.rpc('review_school_expense',{p_expense_id:id,p_status:status}))
   setMessage('Expense '+status+'.');await load()
  } catch(failure) {setError(failure.message||'Approval not confirmed. Refresh or retry the same decision.')}
  finally {running.current=false;setBusy(false)}
 }
 const reverse=async event=>{
  event.preventDefault()
  if(running.current||!mainAdmin||!correction)return
  if(!window.confirm('Reverse this '+money(correction.amount,correction.currency)+' expense? Its history will remain. No money will be refunded or transferred.'))return
  running.current=true;setBusy(true);setError('');setMessage('')
  try {
   const saved=await confirmedRequest(supabase.rpc('reverse_school_expense',{p_expense_id:correction.id,p_reason:reason.trim()}))
   if(saved?.status!=='reversed')throw new Error('Reversal was not confirmed. Refresh before trying again.')
   setRows(current=>current.map(row=>row.id===saved.id?saved:row))
   setCorrection(null);setReason('');setMessage('Expense reversed. Original details remain in history. No money was refunded or transferred.')
   await load()
  } catch(failure){setError(failure.message||'Reversal not confirmed. Retry the same expense safely.')}
  finally{running.current=false;setBusy(false)}
 }
 const currencyRows=rows.filter(row=>(row.currency||'USD')===currency)
 const activeRows=activeExpenseRows(rows,currency)
 const total=status=>activeRows.filter(row=>row.status===status).reduce((sum,row)=>sum+Number(row.amount),0)
 const breakdown=Object.entries(activeRows.reduce((totals,row)=>({...totals,[row.category]:(totals[row.category]||0)+Number(row.amount)}),{})).sort((a,b)=>b[1]-a[1])
 return <section className="shop-app expense-controls">
  <header className="shop-header"><div><span className="shop-kicker">SCHOOL FINANCE</span><h1>{canSubmit?'Expenses & cashbook':'Cashbook breakdown'}</h1><p>Campus spending with approval and correction history.</p></div>
   <label>View currency<select value={currency} onChange={event=>setCurrency(event.target.value)}>{FINANCE_CURRENCIES.map(code=><option key={code}>{code}</option>)}</select></label>
  </header>
  <OperationsExports supabase={supabase} profile={profile} kinds={['expenses']} />
  {message&&<p role="status" className="shop-message success">{message}</p>}
  {error&&<p role="alert" className="shop-message error">{error}</p>}
  {role==='accountant'&&!canSubmit&&<p role="alert">Ask Main Admin to assign your campus before entering expenses.</p>}
  {pendingSubmission&&<section className="shop-panel" aria-label="Expense recovery"><h2>Saved expense awaiting confirmation</h2>
   {pendingSubmission.invalid?<p>Saved recovery details could not be read. Ask Main Admin to reconcile the expense before submitting again.</p>:<>
    <p>{pendingSubmission.p_expense.campus} · {money(pendingSubmission.p_expense.amount,pendingSubmission.p_expense.currency)} · {pendingSubmission.p_expense.expense_date}</p>
    <button disabled={busy} type="button" onClick={()=>sendSubmission(pendingSubmission)}>Retry saved expense</button>
   </>}
  </section>}
  <div className="shop-stats">
   <article className="shop-stat"><span>Pending approval ({currency})</span><strong>{money(total('pending'),currency)}</strong></article>
   <article className="shop-stat"><span>Approved spending ({currency})</span><strong>{money(total('approved'),currency)}</strong></article>
   <article className="shop-stat"><span>Entries including reversed ({currency})</span><strong>{currencyRows.length}</strong></article>
  </div>
  {!canSubmit&&<div className="shop-panel shop-table"><h2>Spending by category ({currency})</h2><p>Reversed entries are excluded.</p><table><thead><tr><th>Category</th><th>Recorded spending</th></tr></thead><tbody>{breakdown.map(([category,amount])=><tr key={category}><td>{category}</td><td>{money(amount,currency)}</td></tr>)}</tbody></table></div>}
  <div className="shop-receipts-layout">
   {canSubmit&&<form className="shop-panel" onSubmit={submit}><h2>Record an expense</h2><p>Use the receipt reference or invoice number where available. New entries await Main Admin approval.</p>
    <fieldset className="shop-form-grid expense-fields" disabled={busy||Boolean(pendingSubmission)}>
     <label>Date<input required type="date" value={form.expense_date} onChange={event=>setForm({...form,expense_date:event.target.value})}/></label>
     {requiresCampusChoice&&<label>Campus<select aria-label="Campus" required value={selectedCampus} onChange={event=>setSelectedCampus(event.target.value)}><option value="">Choose campus</option><option value="junior">Junior School</option><option value="senior">Senior School</option></select></label>}
     <label>Category<select value={form.category} onChange={event=>setForm({...form,category:event.target.value})}>{['Fuel','Stationery','Repairs','Food','Transport','Utilities','Other'].map(value=><option key={value}>{value}</option>)}</select></label>
     <label>Currency<select value={form.currency} onChange={event=>{setCurrency(event.target.value);setForm({...form,currency:event.target.value})}}>{FINANCE_CURRENCIES.map(code=><option key={code}>{code}</option>)}</select></label>
     <label>Amount ({form.currency})<input required inputMode="decimal" min="0.01" max="9999999999.99" step="0.01" type="number" value={form.amount} onChange={event=>setForm({...form,amount:event.target.value})}/></label>
     <label>Payment method<select value={form.payment_method} onChange={event=>setForm({...form,payment_method:event.target.value})}>{['cash','ecocash','swipe','transfer'].map(value=><option key={value}>{value}</option>)}</select></label>
     <label>Supplier / payee<input maxLength={200} value={form.supplier} onChange={event=>setForm({...form,supplier:event.target.value})}/></label>
     <label>Receipt / invoice reference<input maxLength={200} value={form.receipt_reference} onChange={event=>setForm({...form,receipt_reference:event.target.value})}/></label>
     <label className="shop-full">Reason / description<textarea required maxLength={2000} value={form.description} onChange={event=>setForm({...form,description:event.target.value})}/></label>
    </fieldset>
    <button className="primary" disabled={busy||Boolean(pendingSubmission)}>Submit for approval</button>
   </form>}
   <div className="shop-panel shop-table"><h2>Cashbook entries</h2>
    <MobileRecordTable className="mobile-record-table cashbook-record-table" aria-label="Cashbook entries"><thead><tr><th>Date</th>{mainAdmin&&<th>Campus</th>}<th>Expense</th><th>Amount</th><th>Status</th>{mainAdmin&&<th>Review / correction</th>}</tr></thead>
     <tbody>{currencyRows.map(row=><tr key={row.id}>
      <td>{row.expense_date}</td>{mainAdmin&&<td>{row.campus==='senior'?'Senior School':row.campus==='junior'?'Junior School':'Legacy / unassigned'}</td>}
      <td><strong>{row.category}</strong><small>{row.description}{row.supplier?' · '+row.supplier:''}</small></td><td>{money(row.amount,row.currency||'USD')}</td>
      <td><span className={'shop-badge '+(row.status==='approved'?'success':['rejected','reversed'].includes(row.status)?'danger':'warning')}>{row.status}</span>
       {row.status==='reversed'&&<><p>Reason: {row.reversal_reason}</p><small>{row.reversed_at?new Date(row.reversed_at).toLocaleString('en-ZW',{timeZone:'Africa/Harare'}):''} (Harare)</small></>}
      </td>
      {mainAdmin&&<td>
       {row.status==='pending'&&<><button disabled={busy} onClick={()=>review(row.id,'approved')}>Approve</button> <button disabled={busy} onClick={()=>review(row.id,'rejected')}>Reject</button></>}
       {row.status!=='reversed'&&<button disabled={busy} onClick={()=>{setCorrection(row);setReason('');setError('')}}>Reverse expense</button>}
       {correction?.id===row.id&&<form className="expense-correction" aria-label="Expense correction" onSubmit={reverse}>
        <p>Main Admin only. History is retained; no cash refund or transfer occurs.</p>
        <label>Reason for expense reversal<textarea required minLength={5} maxLength={1000} value={reason} disabled={busy} onChange={event=>setReason(event.target.value)}/></label>
        {error&&<p>{error}</p>}
        <button disabled={busy||reason.trim().length<5}>Confirm expense reversal</button>
        <button type="button" disabled={busy} onClick={()=>setCorrection(null)}>Cancel correction</button>
       </form>}
      </td>}
     </tr>)}</tbody>
    </MobileRecordTable>
    {!currencyRows.length&&<p className="shop-empty">No expenses in this currency.</p>}
   </div>
  </div>
 </section>
}
