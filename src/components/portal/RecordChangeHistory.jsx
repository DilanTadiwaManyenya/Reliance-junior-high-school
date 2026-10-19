import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../context/useAuth'
import './recordChangeHistory.css'

const sources = { students: 'Learner details', academic_records: 'Senior marks', attendance: 'Attendance', coursework_marks: 'Coursework marks', junior_component_marks: 'Junior marks', junior_developmental_ratings: 'Development ratings', report_period_contexts: 'Historical report context' }
const label = field => field.replaceAll('_', ' ').replace(/^./, letter => letter.toUpperCase())
const display = value => value === null || value === undefined ? 'Not set' : typeof value === 'object' ? JSON.stringify(value) : String(value)
const pageSize = 50

export default function RecordChangeHistory({ campusScope }) {
  const { supabase } = useAuth()
  const [filters, setFilters] = useState({ name: '', source: '', from: '', to: '' })
  const [page, setPage] = useState(0)
  const [revision, setRevision] = useState(0)
  const [rows, setRows] = useState([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const snapshot = useRef(null)
  const changeFilter = key => event => {
    setFilters(current => ({ ...current, [key]: event.target.value }))
    setPage(0); snapshot.current = null
  }
  const refresh = () => { setPage(0); snapshot.current = null; setRevision(value => value + 1) }
  useEffect(() => {
    const controller = new AbortController()
    let active = true, timer
    const debounce = setTimeout(async () => {
      setLoading(true); setError('')
      if (page === 0) setRows([])
      try {
        if (filters.from && filters.to && filters.from > filters.to) throw new Error('Choose an end date on or after the start date.')
        let request = supabase.from('school_record_changes').select('*').order('created_at', { ascending: false }).order('id', { ascending: false })
        if (filters.source) request = request.eq('source_table', filters.source)
        if (filters.name.trim()) request = request.ilike('learner_name', `%${filters.name.trim().replace(/[\\%_]/g, '\\$&')}%`)
        if (filters.from) request = request.gte('created_at', `${filters.from}T00:00:00+02:00`)
        if (filters.to) request = request.lte('created_at', `${filters.to}T23:59:59.999999+02:00`)
        if (page && snapshot.current) request = request.lte('created_at', snapshot.current)
        const result = await Promise.race([
          request.range(page * pageSize, page * pageSize + pageSize - 1).abortSignal(controller.signal),
          new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('Loading record changes timed out. Please retry.')) }, 12000) }),
        ])
        if (result.error) throw new Error('Could not load record changes. Please retry.')
        if (!active) return
        const data = result.data || []
        if (!page) snapshot.current = data[0]?.created_at || null
        setRows(previous => page ? [...previous, ...data.filter(row => !previous.some(existing => existing.id === row.id))] : data)
        setHasMore(data.length === pageSize)
      } catch (requestError) { if (active) setError(requestError.message || 'Could not load record changes. Please retry.') }
      finally { clearTimeout(timer); if (active) setLoading(false) }
    }, 250)
    return () => { active = false; clearTimeout(debounce); clearTimeout(timer); controller.abort() }
  }, [supabase, campusScope, filters, page, revision])

  return <section className="dash-section record-history" aria-label="Record change history">
    <h1 className="dash-page-title">Record changes</h1>
    <p>Database-recorded changes to learners, marks and attendance. {campusScope ? `Access is limited to your ${campusScope} campus.` : 'Your school access determines which changes you can see.'}</p>
    <p className="muted">History starts when tracking was enabled. Service and database operations are labelled separately from signed-in staff.</p>
    <div className="record-history-filters">
      <label>Learner name<input type="search" value={filters.name} onChange={changeFilter('name')} /></label>
      <label>Record type<select aria-label="Record type" value={filters.source} onChange={changeFilter('source')}><option value="">All record types</option>{Object.entries(sources).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>
      <label>From<input type="date" value={filters.from} onChange={changeFilter('from')} /></label>
      <label>To<input type="date" value={filters.to} onChange={changeFilter('to')} /></label>
      <button type="button" className="btn secondary" onClick={refresh}>Refresh changes</button>
    </div>
    {error && <div role="alert" className="portal-notice error">{error} <button type="button" onClick={refresh}>Retry changes</button></div>}
    {loading && <p role="status">Loading record changes…</p>}
    {!loading && !error && !rows.length && <p>No matching record changes.</p>}
    <div className="record-history-list">{rows.map(row => <article className="card record-history-event" key={row.id}>
      <div className="record-history-event-heading"><h2>{row.learner_name || 'Deleted or unavailable learner'}</h2><span>{row.operation === 'INSERT' ? 'Created' : row.operation === 'DELETE' ? 'Deleted' : 'Updated'} · {sources[row.source_table] || row.source_table}</span></div>
      <p>{row.actor_name} · {row.actor_role} · {row.campus || 'Unresolved campus'}</p>
      <time dateTime={row.created_at}>{new Date(row.created_at).toLocaleString('en-ZW', { timeZone: 'Africa/Harare' })}</time>
      {Object.keys(row.context || {}).length > 0 && <p className="record-history-context">{Object.entries(row.context).map(([key, value]) => `${label(key)}: ${display(value)}`).join(' · ')}</p>}
      <details><summary>View {row.changed_fields.length} changed {row.changed_fields.length === 1 ? 'field' : 'fields'}</summary>
        <dl>{row.changed_fields.map(field => <div className="record-history-field" key={field}><dt>{label(field)}</dt><dd><span>Before</span>{display(row.old_values[field])}</dd><dd><span>After</span>{display(row.new_values[field])}</dd></div>)}</dl>
      </details>
    </article>)}</div>
    {hasMore && !error && <button type="button" className="btn secondary" disabled={loading} onClick={() => setPage(value => value + 1)}>Load more changes</button>}
  </section>
}
