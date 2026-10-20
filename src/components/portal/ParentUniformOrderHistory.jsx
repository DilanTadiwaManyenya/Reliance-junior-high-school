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
  </Card>
}
