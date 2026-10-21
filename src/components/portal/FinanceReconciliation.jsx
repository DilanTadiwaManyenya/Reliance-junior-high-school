import { useEffect, useMemo, useState } from 'react'
import MobileRecordTable from './MobileRecordTable'
import PortalNotice from './PortalNotice'
import { readAllRows, downloadCsv } from '../../lib/operationsExport'
import { FINANCE_CURRENCIES, formatMoney } from '../../lib/currency'
import { buildReconciliationEntries, filterReconciliationEntries, summarizeReconciliationEntries } from '../../lib/financeReconciliation'

const campusName = campus => campus === 'junior' ? 'Junior School' : campus === 'senior' ? 'Senior School' : 'Unassigned'
const money = (value, currency) => formatMoney(value, currency)
const localDateBoundary = (date, isEnd = false) => date ? new Date(`${date}T${isEnd ? '23:59:59.999' : '00:00:00.000'}+02:00`).toISOString() : ''

export default function FinanceReconciliation({ supabase, profile }) {
  const role = profile?.active_role ?? profile?.role
  const mainAdmin = role === 'admin' && profile?.campus === 'all'
  const assignedCampus = ['junior', 'senior'].includes(profile?.campus) ? profile.campus : ''
  const [campus, setCampus] = useState(mainAdmin ? 'all' : assignedCampus)
  const [currency, setCurrency] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        if (!mainAdmin && !assignedCampus) {
          setEntries([])
          setError('Your account has no campus assignment. Ask the Main Admin to correct it before viewing reconciliation records.')
          setLoading(false)
          return
        }
        const campusFilter = mainAdmin ? campus : assignedCampus
        const [feePayments, sales, expenses, posPayments] = await Promise.all([
          readAllRows(() => {
            let query = supabase.from('fee_payments').select('id, student_id, term, academic_year, amount, currency, paid_on, reference_number, status, students!inner(full_name, admission_number, campus)')
            if (campusFilter && campusFilter !== 'all') query = query.eq('students.campus', campusFilter)
            if (from) query = query.gte('paid_on', from)
            if (to) query = query.lte('paid_on', to)
            return query
          }, { signal: controller.signal }),
          readAllRows(() => {
            let query = supabase.from('pos_sales').select('id, receipt_number, created_at, campus, customer_name, total, currency, status, payment_tracking')
            if (campusFilter && campusFilter !== 'all') query = query.eq('campus', campusFilter)
            if (from) query = query.gte('created_at', localDateBoundary(from))
            if (to) query = query.lte('created_at', localDateBoundary(to, true))
            return query
          }, { signal: controller.signal }),
          readAllRows(() => {
            let query = supabase.from('school_expenses').select('id, expense_date, campus, category, supplier, description, amount, currency, receipt_reference, status')
            if (campusFilter && campusFilter !== 'all') query = query.eq('campus', campusFilter)
            if (from) query = query.gte('expense_date', from)
            if (to) query = query.lte('expense_date', to)
            return query
          }, { signal: controller.signal }),
          readAllRows(() => {
            let query = supabase.from('pos_payments').select('id,sale_id,paid_on,created_at,amount,currency,campus,reference_number,pos_sales!inner(receipt_number,customer_name,status)')
            if (campusFilter && campusFilter !== 'all') query = query.eq('campus',campusFilter)
            if (from) query = query.gte('paid_on',from)
            if (to) query = query.lte('paid_on',to)
            return query
          }, { signal: controller.signal }),
        ])
        if (active) setEntries(buildReconciliationEntries({ feePayments, sales, expenses, posPayments }))
      } catch (cause) {
        if (active) setError(controller.signal.aborted ? 'Loading timed out or was cancelled. Refresh the report and try again.' : cause.message || 'Reconciliation records could not be loaded. Try again.')
      } finally {
        clearTimeout(timeout)
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false; clearTimeout(timeout); controller.abort() }
  }, [supabase, mainAdmin, assignedCampus, campus, from, to])

  const visibleEntries = useMemo(() => filterReconciliationEntries(entries, { campus: mainAdmin ? campus : assignedCampus, currency, from, to }), [entries, mainAdmin, campus, assignedCampus, currency, from, to])
  const summary = useMemo(() => summarizeReconciliationEntries(visibleEntries), [visibleEntries])
  const currencies = Object.keys(summary).sort()

  const exportCsv = () => {
    const totals = Object.entries(summary).flatMap(([code, values]) => [
      [`Collected ${code}`, values.collected],
      [`Approved expenses ${code}`, values.approvedExpenses],
      [`Net recorded movement ${code}`, values.netMovement],
      [`Pending expenses excluded ${code}`, values.pendingExpenses],
    ])
    downloadCsv([
      ['Reliance Learning Centre · Finance reconciliation'],
      ['Campus', campus === 'all' ? 'All authorised campuses' : campusName(campus)],
      ['Currency', currency === 'all' ? 'USD and ZWG separately; no conversion' : currency],
      ['Period', `${from || 'All dates'} to ${to || 'Present'}`],
      ['Generated at', new Date().toISOString()],
      ['Basis', 'Saved fee payments, POS payment ledger and legacy fully-paid POS receipts, less approved expenses. Not a bank statement or proof of external settlement.'],
      ...totals,
      [],
      ['Date', 'Campus', 'Currency', 'Direction', 'Source', 'Reference', 'Description', 'Amount', 'Status', 'Source ID'],
      ...visibleEntries.map(row => [row.date, campusName(row.campus), row.currency, row.direction === 'in' ? 'Collected' : row.direction === 'out' ? 'Expense' : 'Excluded record', row.kind, row.reference, row.description, row.amount, row.status, row.sourceId]),
    ], `reliance-reconciliation-${campus}-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  return <section className="shop-app finance-reconciliation" aria-labelledby="finance-reconciliation-title">
    <header className="shop-header"><div><span className="shop-kicker">SCHOOL FINANCE</span><h1 id="finance-reconciliation-title">Income &amp; expense reconciliation</h1><p>Compare recorded fee collections and POS sales against approved expenses.</p></div><button type="button" onClick={exportCsv} disabled={loading || !visibleEntries.length}>Download CSV</button></header>
    <PortalNotice>USD and ZWG stay separate. This view totals portal records; it does not confirm bank or cash settlement. Parent uniform orders, reversed sales, pending and rejected expenses are excluded from net movement. A reversed sale does not prove money was refunded; review its settlement separately.</PortalNotice>
    <div className="shop-toolbar finance-reconciliation-filters">
      <label>Campus<select value={mainAdmin ? campus : assignedCampus} onChange={event => setCampus(event.target.value)} disabled={!mainAdmin}><option value="all">All campuses</option><option value="junior">Junior School</option><option value="senior">Senior School</option></select></label>
      <label>Currency<select value={currency} onChange={event => setCurrency(event.target.value)}><option value="all">Both, separate totals</option>{FINANCE_CURRENCIES.map(code => <option key={code}>{code}</option>)}</select></label>
      <label>From<input type="date" value={from} onChange={event => setFrom(event.target.value)} /></label>
      <label>To<input type="date" value={to} onChange={event => setTo(event.target.value)} /></label>
    </div>
    {error && <PortalNotice tone="error">{error}</PortalNotice>}
    <div className="shop-stats">
      {currencies.map(code => <div className="finance-reconciliation-currency" key={code}>
        <h2>{code}</h2>
        <article className="shop-stat"><span>Recorded collections</span><strong>{money(summary[code].collected, code)}</strong></article>
        <article className="shop-stat"><span>Approved expenses</span><strong>{money(summary[code].approvedExpenses, code)}</strong></article>
        <article className="shop-stat"><span>Net recorded movement</span><strong>{money(summary[code].netMovement, code)}</strong></article>
        <article className="shop-stat"><span>Pending expenses, excluded</span><strong>{money(summary[code].pendingExpenses, code)}</strong></article>
      </div>)}
    </div>
    <div className="shop-panel shop-table">
      <h2>Reconciliation entries</h2>
      {loading ? <p role="status">Loading authorised finance records…</p> : <>
        <p>{visibleEntries.length.toLocaleString()} records · {campus === 'all' ? 'All authorised campuses' : campusName(campus)}</p>
        <MobileRecordTable className="mobile-record-table finance-reconciliation-table" aria-label="Finance reconciliation entries">
          <thead><tr><th>Date</th><th>Campus</th><th>Currency</th><th>Type</th><th>Reference</th><th>Description</th><th>Amount</th><th>Status</th></tr></thead>
          <tbody>{visibleEntries.map(row => <tr key={row.id}>
            <td>{row.date || '—'}</td><td>{campusName(row.campus)}</td><td>{row.currency}</td>
            <td>{row.direction === 'in' ? 'Collection' : row.direction === 'out' ? 'Expense' : 'Excluded record'}</td>
            <td>{row.reference || '—'}</td><td>{row.description || row.kind}</td>
            <td>{money(row.amount, row.currency)}</td><td>{row.status}</td>
          </tr>)}</tbody>
        </MobileRecordTable>
        {!visibleEntries.length && <p className="shop-empty">No reconciliation records match these filters.</p>}
      </>}
    </div>
  </section>
}
