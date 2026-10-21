import { useEffect, useState } from 'react'
import Card from '../ui/Card'
import { formatMoney } from '../../lib/currency'

const money = (value, currency = 'USD') => formatMoney(value, currency)

export default function ParentUniformOrderHistory(props) {
  return <LearnerOrderHistory {...props} key={`${props.parentId}:${props.studentId}`} />;
}

function LearnerOrderHistory({ supabase, parentId, studentId, refreshKey }) {
  const [orders, setOrders] = useState([])
  const [error, setError] = useState('')
  const [receipts, setReceipts] = useState([])
  const [receiptError, setReceiptError] = useState('')
  const [receiptsLoaded, setReceiptsLoaded] = useState(false)
  useEffect(() => {
    let disposed = false, timer
    Promise.race([
      supabase.rpc('parent_pos_receipts', { p_student_id: studentId }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Receipt loading timed out')), 15000) }),
    ]).then(({ data, error: failure }) => {
      if (!disposed) {
        setReceipts(Array.isArray(data) ? data : []);
        setReceiptError(failure || !Array.isArray(data) ? 'Uniform receipts could not be loaded. Refresh and try again.' : '');
        setReceiptsLoaded(true);
      }
    }).catch(() => { if (!disposed) { setReceiptError('Uniform receipts are temporarily unavailable. Refresh and try again.'); setReceiptsLoaded(true) } })
      .finally(() => clearTimeout(timer))
    return () => { disposed = true; clearTimeout(timer) }
  }, [supabase, studentId, refreshKey])
  useEffect(() => {
    let disposed = false
    supabase.from('parent_uniform_orders').select('id,items,total,currency,payment_status,created_at')
      .eq('parent_id', parentId).eq('student_id', studentId)
      .order('created_at', { ascending: false }).limit(20)
      .then(({ data, error }) => {
        if (!disposed) { setOrders(data || []); setError(error?.message || '') }
      }).catch(error => { if (!disposed) setError(error.message) })
    return () => { disposed = true }
  }, [supabase, parentId, studentId, refreshKey])
  return <Card className="parent-uniform-history"><h3>Recent uniform orders</h3>
    {error && <p role="alert">Order history is temporarily unavailable: {error}</p>}
    {!orders.length && !error && <p className="muted">No uniform orders yet.</p>}
    {orders.map(order => <article key={order.id}>
      <p><strong>{new Date(order.created_at).toLocaleDateString()}</strong> · {order.payment_status} · {money(order.total, order.currency || 'USD')}</p>
      <ul>{(order.items || []).map((line, index) => <li key={index}>{line.quantity} × {line.name}{line.size_label ? ` · ${line.size_label}` : ''} — {money(line.unit_price, order.currency || 'USD')} each</li>)}</ul>
    </article>)}
    <h3>Uniform receipts and balances</h3>
    <p>These are school-issued sale receipts. An order above is separate and does not prove payment.</p>
    {receiptError && <p role="alert">{receiptError}</p>}
    {!receiptsLoaded && <p role="status">Loading uniform receipts…</p>}
    {receiptsLoaded && !receiptError && !receipts.length && <p>No school-issued receipts for this learner yet.</p>}
    {receipts.map(receipt => <article key={receipt.id} aria-label={`Uniform receipt ${receipt.receipt_number}`}>
      <h4>{receipt.receipt_number}</h4><p>{new Date(receipt.created_at).toLocaleDateString('en-ZW')} · {receipt.status === 'reversed' ? 'REVERSED — not an active balance; contact the school about settlement' : Number(receipt.balance_due)>0 ? 'Partly paid' : 'Paid'}</p>
      <ul>{(receipt.items || []).map((line,index)=><li key={index}>{line.quantity} × {line.product_name}{line.size_label ? ` · ${line.size_label}` : ''} — {money(line.unit_price,receipt.currency)} each</li>)}</ul>
      <p>Total: <strong>{money(receipt.total,receipt.currency)}</strong> · Paid: <strong>{money(receipt.paid_total ?? receipt.total,receipt.currency)}</strong> · Balance due: <strong>{money(receipt.balance_due,receipt.currency)}</strong></p>
      {receipt.issued_at && <p>Items issued {new Date(receipt.issued_at).toLocaleDateString('en-ZW')}. Any remaining balance is still payable.</p>}
      <details><summary>Payment history</summary>{(receipt.payments || []).map(payment=><p key={payment.id}>{new Date(payment.created_at).toLocaleString('en-ZW')} · {money(payment.amount,receipt.currency)} · {payment.payment_method}</p>)}</details>
    </article>)}
  </Card>
}
