import { useEffect, useState } from 'react'
import { useAuth } from '../../context/useAuth'
import './financialEventHistory.css'

export default function FinancialEventHistory({ campusScope }) {
  const { supabase } = useAuth()
  const [result, setResult] = useState({ key: '', rows: [], error: '' })
  const [page, setPage] = useState(0)
  const [action, setAction] = useState('all')
  const [revision, setRevision] = useState(0)
  const key = `${campusScope || 'all'}:${page}:${action}:${revision}`
  const loading = result.key !== key
  const rows = loading ? [] : result.rows
  const error = loading ? '' : result.error
  useEffect(() => {
    let active = true
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15000)
    let request = supabase.from('financial_events').select('*').eq('module', 'pos').order('created_at', { ascending: false }).order('id', { ascending: false })
    if (campusScope) request = request.eq('campus', campusScope)
    if (action !== 'all') request = request.eq('action', action)
    request.range(page * 50, page * 50 + 50).abortSignal(controller.signal)
      .then(({ data, error: failure }) => { if (active) setResult({ key, rows: data || [], error: failure ? 'Could not load financial events. Retry or check your connection.' : '' }) })
      .catch(() => { if (active) setResult({ key, rows: [], error: 'Could not load financial events. Check your connection.' }) })
      .finally(() => clearTimeout(timer))
    return () => { active = false; clearTimeout(timer); controller.abort() }
  }, [supabase, campusScope, page, action, key])
  return <section className="record-history financial-event-history" aria-label="POS financial audit"><h1>Inventory &amp; POS audit</h1>
    <p>Database-confirmed sales, stock lines and reversals. History starts when this tracking was enabled. Reversing a sale does not refund money.</p>
    <label>Event type<select value={action} onChange={event => { setAction(event.target.value); setPage(0) }}><option value="all">All POS events</option><option value="sale_recorded">Sale recorded</option><option value="sale_line_recorded">Stock sold</option><option value="sale_reversed">Sale reversed</option></select></label>
    <button type="button" disabled={loading} onClick={() => { setPage(0); setRevision(value => value + 1) }}>Refresh financial audit</button>
    {error && <p role="alert">{error} <button type="button" onClick={() => setRevision(value => value + 1)}>Retry audit</button></p>}{loading ? <p role="status">Loading financial audit…</p> : <div>{rows.slice(0, 50).map(row => <article className="card" key={row.id}>
      <h2>{row.action.replaceAll('_', ' ')}</h2><p>{row.actor_name || 'Recorded actor'} · {row.actor_role} · {row.campus || 'Legacy'} · {row.currency}</p>
      <p>{new Date(row.created_at).toLocaleString('en-ZW', { timeZone: 'Africa/Harare' })} (Harare)</p>
      {row.reason && <p>Reason: {row.reason}</p>}<p>Record: {row.record_id}</p>
      <details><summary>View original values and stock changes</summary><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{JSON.stringify(row.details, null, 2)}</pre></details>
    </article>)}{!rows.length && <p>No matching financial events.</p>}</div>}
    <div className="library-pagination"><button type="button" disabled={loading || page === 0} onClick={() => setPage(value => value - 1)}>Previous</button><span>Page {page + 1}</span><button type="button" disabled={loading || rows.length <= 50} onClick={() => setPage(value => value + 1)}>Next</button></div>
  </section>
}
