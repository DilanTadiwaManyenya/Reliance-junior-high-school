import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../context/useAuth'
import { readContentTrace, readLibrarySupport, supportAvailability, supportFileLink } from '../../lib/librarySupport'
import { canPreviewLearningFile, learningPublicationDate } from '../../lib/parentLearningLibrary'
import { learningFileSize } from '../../lib/learningLibrary'
import ParentLibraryFilePanel from './ParentLibraryFilePanel'
import './parentLearningLibrary.css'
import './librarySupport.css'

const activityAreas = { learning_resources: 'Teacher notes', announcements: 'Newsletter', portal_content_files: 'Attachment', announcement_targets: 'Audience' }
const activityActions = { INSERT: 'Added', UPDATE: 'Updated', DELETE: 'Removed' }
const fieldLabels = { original_name: 'File name', size_bytes: 'File size (bytes)', ready: 'File checked', active: 'Current attachment', class_level: 'Grade / Form', class_stream: 'Stream' }
const changeLabel = key => fieldLabels[key] || key.replaceAll('_', ' ')
const changeValue = value => typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value ?? '—')

function ContentTrace({ supabase, kind, row, onClose }) {
  const [page, setPage] = useState(0)
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState({ key: '', data: null, error: '' })
  const heading = useRef(null)
  const key = `${row.id}:${page}:${revision}`
  useEffect(() => { heading.current?.focus(); heading.current?.scrollIntoView({ block: 'nearest' }) }, [])
  useEffect(() => {
    let active = true
    const controller = new AbortController()
    readContentTrace(supabase, kind, row.id, page, controller.signal)
      .then(data => { if (active) setResult({ key, data, error: '' }) })
      .catch(error => { if (active) setResult({ key, data: null, error: error.message }) })
    return () => { active = false; controller.abort() }
  }, [supabase, kind, row.id, page, key])
  return <section className="library-support-trace" aria-label="Content activity"><h2 ref={heading} tabIndex={-1}>Activity: {row.title}</h2><div className="library-support-actions"><button className="btn secondary" onClick={onClose}>Close activity</button><button className="btn secondary" onClick={() => setRevision(value => value + 1)}>Refresh activity</button></div>
    {result.key !== key ? <p role="status">Loading recorded activity…</p> : result.error ? <p role="alert">{result.error}</p> : !result.data.audit_visible ? <p>This both-campus newsletter’s audit is available to Main Admin. You can open its published attachment from the support list.</p> : <>
      {!result.data.events.length && <p>No recorded activity.</p>}
      <ol className="library-support-events">{result.data.events.map(event => <li key={event.id}><strong>{event.actor_name}</strong> · {event.actor_role || 'School account'}<p><time dateTime={event.created_at}>{new Intl.DateTimeFormat('en-ZW', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Harare' }).format(new Date(event.created_at))}</time> · {activityAreas[event.source_table] || 'Content'} · {activityActions[event.operation] || 'Changed'}</p><div className="library-support-changes"><div><h3>Before</h3><dl>{Object.entries(event.before || {}).map(([key, value]) => <div key={key}><dt>{changeLabel(key)}</dt><dd>{changeValue(value)}</dd></div>)}</dl></div><div><h3>After</h3><dl>{Object.entries(event.after || {}).map(([key, value]) => <div key={key}><dt>{changeLabel(key)}</dt><dd>{changeValue(value)}</dd></div>)}</dl></div></div></li>)}</ol>
      <div className="library-support-actions"><button className="btn secondary" disabled={page === 0} onClick={() => setPage(value => value - 1)}>Previous activity</button><span>Activity page {page + 1}</span><button className="btn secondary" disabled={(page + 1) * 20 >= result.data.total_count} onClick={() => setPage(value => value + 1)}>Next activity</button></div>
    </>}
  </section>
}

export default function LibrarySupport() {
  const { supabase, profile, activeRole } = useAuth()
  const mainAdmin = activeRole === 'admin' && profile?.campus === 'all'
  const allowed = (activeRole === 'admin' && ['all', 'junior', 'senior'].includes(profile?.campus)) || (activeRole === 'accountant' && ['junior', 'senior'].includes(profile?.campus))
  const [filters, setFilters] = useState(() => ({ campus: mainAdmin ? 'all' : profile?.campus, kind: 'notes', state: '', level: '', search: '', page: 0 }))
  const [search, setSearch] = useState('')
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState({ key: '', data: null, error: '' })
  const [trace, setTrace] = useState(null)
  const [view, setView] = useState(null)
  const [fileBusy, setFileBusy] = useState(false)
  const [error, setError] = useState('')
  const generation = useRef(0)
  const key = JSON.stringify([activeRole, profile?.campus, filters, revision])
  useEffect(() => {
    if (!allowed) return
    let active = true
    const controller = new AbortController()
    readLibrarySupport(supabase, filters, controller.signal).then(data => { if (active) setResult({ key, data, error: '' }) })
      .catch(error => { if (active) setResult({ key, data: null, error: error.message }) })
    return () => { active = false; controller.abort(); generation.current += 1 }
  }, [supabase, allowed, filters, key])
  useEffect(() => {
    if (!view?.url) return
    const timer = setTimeout(() => setView(previous => previous ? { ...previous, expired: true } : null), 55000)
    return () => clearTimeout(timer)
  }, [view?.url])
  const clearDetails = () => { generation.current += 1; setView(null); setTrace(null); setFileBusy(false); setError('') }
  const filter = values => { clearDetails(); setFilters(previous => ({ ...previous, ...values, page: values.page ?? 0 })) }
  async function openFile(row, preview) {
    const current = ++generation.current
    setFileBusy(true); setView(null); setError('')
    try { const url = await supportFileLink(supabase, filters.kind, row.file, preview); if (generation.current === current) setView({ row, preview, url, expired: false }) }
    catch (error) { if (generation.current === current) setError(error.message) }
    finally { if (generation.current === current) setFileBusy(false) }
  }
  if (!allowed) return <p>Library support requires an Admin or accountant with an assigned campus.</p>
  const data = result.key === key ? result.data : null
  return <section className="library-support"><header><p className="eyebrow">School support</p><h1>Library oversight</h1><p>Read-only access to teacher notes and school newsletters. Check the class, stream, release status and file before helping a parent. A parent also needs a verified connection to an active learner in the matching scope.</p></header>
    <div className="library-support-filters">
      <label>Support campus<select aria-label="Support campus" disabled={!mainAdmin} value={filters.campus} onChange={e => filter({ campus: e.target.value, level: '' })}>{(mainAdmin ? ['all', 'junior', 'senior'] : [profile.campus]).map(campus => <option key={campus} value={campus}>{campus === 'all' ? 'Both campuses' : `${campus === 'junior' ? 'Junior' : 'Senior'} School`}</option>)}</select></label>
      <label>Content type<select aria-label="Content type" value={filters.kind} onChange={e => filter({ kind: e.target.value, level: '' })}><option value="notes">Teacher notes</option><option value="newsletters">Newsletters</option></select></label>
      <label>Publication status<select aria-label="Publication status" value={filters.state} onChange={e => filter({ state: e.target.value })}><option value="">All available statuses</option>{['draft', 'published', 'archived'].map(state => <option key={state}>{state}</option>)}</select></label>
      {filters.kind === 'notes' && <label>Grade / Form<select aria-label="Grade / Form" value={filters.level} onChange={e => filter({ level: e.target.value })}><option value="">All grades / forms</option>{(data?.levels || (filters.level ? [filters.level] : [])).map(level => <option key={level}>{level}</option>)}</select></label>}
      <form onSubmit={e => { e.preventDefault(); filter({ search }) }}><label>Search title, teacher or subject<input maxLength={160} value={search} onChange={e => setSearch(e.target.value)} /></label><button className="btn secondary" type="submit">Search library</button></form>
    </div><button className="btn secondary" onClick={() => { clearDetails(); setRevision(value => value + 1) }}>Refresh support list</button>
    {error && <p role="alert">{error}</p>}{fileBusy && <p role="status">Preparing a private file link…</p>}
    {result.key !== key ? <p role="status">Loading campus library…</p> : result.error ? <p role="alert">{result.error}</p> : <>
      <p>{data.total_count} matching {filters.kind === 'notes' ? 'teacher notes' : 'newsletters'}. Showing page {filters.page + 1}.</p>
      {!data.items.length && <p>No content matches these filters. Accountants see newsletters only while published, released and unexpired.</p>}
      <div className="library-support-grid">{data.items.map(row => <article className="library-support-card" key={row.id}><h2>{row.title}</h2><p>{row.author_name} · {row.campus} · {row.state}</p>
        {filters.kind === 'notes' ? <p>{row.class_level} · {row.class_stream || 'All streams'} · {row.subject} · {row.academic_year} Term {row.term}</p> : <p>Targets: {row.targets.map(target => `${target.campus} ${target.class_level || 'all grades/forms'} ${target.class_stream || 'all streams'}`).join('; ') || 'No audience selected'}</p>}
        <p>{supportAvailability(row, filters.kind)}</p><p>{row.published_at ? `Release: ${learningPublicationDate(row.published_at)}` : 'Not yet released'}{row.expires_at ? ` · Expires: ${learningPublicationDate(row.expires_at)}` : ''}</p>
        <p className="library-support-body">{row.body}</p>
        {row.file ? <><p>{row.file.original_name} · {learningFileSize(row.file.size_bytes)}</p><div className="library-support-actions">{canPreviewLearningFile(row.file) && <button className="btn secondary" disabled={fileBusy} onClick={() => openFile(row, true)}>Preview {row.title}</button>}<button className="btn secondary" disabled={fileBusy} onClick={() => openFile(row, false)}>Download {row.title}</button></div></> : <p>No finalized attachment. Ask the uploader to finish the upload if this is a note.</p>}
        <button className="btn secondary" onClick={() => setTrace(row)}>Activity for {row.title}</button>
      </article>)}</div>
      <div className="library-support-actions"><button className="btn secondary" disabled={filters.page === 0} onClick={() => filter({ page: filters.page - 1 })}>Previous content</button><button className="btn secondary" disabled={(filters.page + 1) * 20 >= data.total_count || filters.page >= 500} onClick={() => filter({ page: filters.page + 1 })}>Next content</button></div>
    </>}
    {trace && <ContentTrace key={`${filters.kind}:${trace.id}`} supabase={supabase} kind={filters.kind} row={trace} onClose={() => setTrace(null)} />}
    {view && <ParentLibraryFilePanel view={view} onClose={() => { generation.current += 1; setView(null) }} onRenew={() => openFile(view.row, view.preview)} />}
  </section>
}
