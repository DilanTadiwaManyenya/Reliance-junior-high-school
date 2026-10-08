import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, RotateCcw, Search, SlidersHorizontal, UsersRound } from 'lucide-react'
import { useAuth } from '../../context/useAuth'

const tabs = { parents: ['parent'], students: ['student'], staff: ['admin', 'principal', 'teacher', 'accountant'] }
const relativeTime = date => {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 1000))
  if (seconds < 60) return 'just now'; if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`; if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`; return `${Math.floor(seconds / 86400)}d ago`
}
export default function ActivityLog() {
  const { supabase } = useAuth(); const [tab, setTab] = useState('staff'); const [rows, setRows] = useState([]); const [query, setQuery] = useState(''); const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(true)
  useEffect(() => { let active = true; (async () => { setLoading(true); let request = supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(500); if (from) request = request.gte('created_at', `${from}T00:00:00`); if (to) request = request.lte('created_at', `${to}T23:59:59.999`); const { data, error: loadError } = await request; if (!active) return; setRows(data ?? []); setError(loadError?.message ?? ''); setLoading(false) })(); return () => { active = false } }, [supabase, from, to])
  const shown = useMemo(() => rows.filter(row => tabs[tab].includes(row.actor_role) && `${row.metadata?.actor_name ?? ''} ${row.description ?? ''}`.toLowerCase().includes(query.toLowerCase())), [rows, tab, query])
  const clearFilters = () => { setQuery(''); setFrom(''); setTo('') }
  const hasFilters = Boolean(query || from || to)
  return <section className="dash-section activity-log-page">
    <div className="dash-page-header activity-log-heading">
      <div>
        <span className="activity-log-eyebrow"><CalendarDays size={15} aria-hidden="true" /> Portal oversight</span>
        <h1 className="dash-page-title">Activity log</h1>
        <p className="dash-page-sub">Review recent portal events and quickly trace who did what.</p>
      </div>
      <div className="activity-log-total" aria-label={`${shown.length} events shown`}><UsersRound size={18} aria-hidden="true" /><span><strong>{loading ? '—' : shown.length}</strong> events shown</span></div>
    </div>
    <div className="portal-workspace">
      <div className="card activity-log-card">
        <div className="activity-log-card-top">
          <div>
            <h2>Activity feed</h2>
            <p>Choose a group, then refine the results below.</p>
          </div>
          <div role="tablist" aria-label="Activity group" className="activity-log-tabs">
            {Object.keys(tabs).map(key => <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? 'is-active' : ''} onClick={() => setTab(key)}>{key[0].toUpperCase() + key.slice(1)}</button>)}
          </div>
        </div>
        <div className="activity-log-filters">
          <div className="activity-filter-label"><SlidersHorizontal size={17} aria-hidden="true" /><span>Filter results</span></div>
          <label className="activity-search"><span className="sr-only">Search activity</span><Search size={18} aria-hidden="true" /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by name or activity" /></label>
          <label className="activity-date"><span>From</span><input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
          <label className="activity-date"><span>To</span><input type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
          {hasFilters && <button type="button" className="activity-clear" onClick={clearFilters}><RotateCcw size={15} aria-hidden="true" /> Clear</button>}
        </div>
        {error && <p className="portal-notice error">{error}</p>}
        {loading ? <p className="activity-log-message muted">Loading activity…</p> : !shown.length ? <div className="activity-log-empty"><UsersRound size={24} aria-hidden="true" /><h3>No matching activity</h3><p>Try choosing another group or clearing your filters.</p>{hasFilters && <button type="button" className="activity-clear" onClick={clearFilters}>Clear filters</button>}</div> : <div className="portal-table-wrap activity-log-table-wrap"><table className="portal-table activity-log-table"><thead><tr><th>Actor</th><th>Activity</th><th>When</th></tr></thead><tbody>{shown.map(row => <tr key={row.id}><td><div className="activity-actor"><span aria-hidden="true">{(row.metadata?.actor_name || 'P').slice(0, 1).toUpperCase()}</span><div><strong>{row.metadata?.actor_name || 'Portal user'}</strong><small>{row.actor_role || 'unknown'}</small></div></div></td><td><span className="activity-description">{row.description || row.action_type}</span></td><td title={new Date(row.created_at).toLocaleString('en-ZW')}><strong>{relativeTime(row.created_at)}</strong><small>{new Date(row.created_at).toLocaleString('en-ZW')}</small></td></tr>)}</tbody></table></div>}
      </div>
    </div>
  </section>
}
