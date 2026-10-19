import { useEffect, useState } from 'react'
import { rolloverStatuses, rolloverClassLabel, rolloverReviewCsv } from '../../lib/rolloverReview'
import './yearRolloverReadiness.css'

export default function YearRolloverReadiness({ supabase, campusScope = 'all' }) {
  const [campus, setCampus] = useState(campusScope === 'senior' ? 'senior' : 'junior')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [revision, setRevision] = useState(0)
  const [preview, setPreview] = useState(null)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const activeCampus = campusScope === 'all' ? campus : campusScope
  useEffect(() => {
    const controller = new AbortController()
    let active = true, timeout
    const debounce = setTimeout(async () => {
      setLoading(true); setError('')
      if (!page) { setRows([]); setPreview(null) }
      try {
        const result = await Promise.race([
          supabase.rpc('preview_year_rollover', {p_campus:activeCampus,p_search:search.trim(),p_offset:page * 50,p_limit:50}).abortSignal(controller.signal),
          new Promise((_, reject) => { timeout = setTimeout(() => { controller.abort(); reject(new Error('The preview timed out. Please retry.')) }, 12000) }),
        ])
        if (result.error || !result.data) throw new Error('Could not load the rollover review. Please retry or check your campus access.')
        if (!active) return
        setPreview(result.data)
        setRows(previous => page ? [...previous,...result.data.rows.filter(row => !previous.some(existing => existing.id === row.id))] : result.data.rows)
      } catch (requestError) { if (active) setError(requestError.message) }
      finally { clearTimeout(timeout); if (active) setLoading(false) }
    },250)
    return () => {active=false;clearTimeout(debounce);clearTimeout(timeout);controller.abort()}
  },[supabase,activeCampus,search,page,revision])
  const clearPreview = () => { setLoading(true);setRows([]);setPreview(null);setPage(0) }
  const refresh = () => { clearPreview(); setRevision(value => value + 1) }
  const download = () => {
    const blob = new Blob([rolloverReviewCsv(rows,preview.source_year,preview.target_year)], {type:'text/csv;charset=utf-8;'})
    const url = URL.createObjectURL(blob), anchor = document.createElement('a')
    anchor.href=url; anchor.download=`rollover-review-${activeCampus}-${preview.target_year}.csv`; anchor.click()
    setTimeout(() => URL.revokeObjectURL(url),1000)
  }
  return <section className="dash-section rollover-readiness" aria-label="Year rollover readiness">
    <h1 className="dash-page-title">Year rollover readiness</h1>
    <p>Review the current active roster for next year. These are progression suggestions for school review.</p>
    <div className="portal-notice">Planning preview only. Use the export to review next-year placements with the school. Promotion decisions are not saved on this screen.</div>
    <div className="rollover-filters">
      {campusScope === 'all' ? <label>Campus<select aria-label="Rollover campus" value={campus} onChange={event => {setCampus(event.target.value);clearPreview()}}><option value="junior">Junior School</option><option value="senior">Senior School</option></select></label> : <p><strong>{campusScope === 'junior' ? 'Junior School' : 'Senior School'}</strong> · your assigned campus</p>}
      <label>Find learner<input type="search" maxLength={120} value={search} onChange={event => {setSearch(event.target.value);clearPreview()}} placeholder="Name or admission number" /></label>
      <button type="button" className="btn secondary" onClick={refresh}>Refresh review</button>
      <button type="button" className="btn secondary" disabled={loading || Boolean(error) || !rows.length} onClick={download}>Export loaded review</button>
    </div>
    {error && <div role="alert" className="portal-notice error">{error} <button type="button" onClick={refresh}>Retry review</button></div>}
    {loading && <p role="status">Loading rollover readiness…</p>}
    {preview && <><h2>{preview.source_year} → {preview.target_year}</h2><div className="rollover-summary"><p><strong>{preview.total}</strong> active learners matching this review</p><p><strong>{preview.standard_count}</strong> standard progression suggestions</p><p><strong>{preview.review_count}</strong> placement or setup reviews</p></div><p className="muted">Loaded {rows.length} of {preview.total}. Capacity, retention, exam eligibility and final placements need school approval. Refresh after roster or class changes.</p></>}
    {!loading && !error && !rows.length && <p>No active learners match this review.</p>}
    <div className="rollover-cards">{rows.map(row => <article className="card rollover-card" key={row.id}>
      <h3>{row.full_name}</h3><p>Admission: {row.admission_number}</p>
      <dl><div><dt>Current class</dt><dd>{rolloverClassLabel({class_level:row.source_level,class_stream:row.source_stream})}</dd></div>
        <div><dt>Suggested level</dt><dd>{row.target_level || 'Completion review'}{row.target_campus && row.target_campus !== row.campus ? ` · ${row.target_campus} campus` : ''}</dd></div>
        <div><dt>Destination classes</dt><dd>{row.candidates.length ? row.candidates.map(rolloverClassLabel).join(', ') : row.review_status === 'main_admin_transition' ? 'Main Admin will review Senior placement' : 'No active destination classes available'}</dd></div>
        <div><dt>Review</dt><dd>{rolloverStatuses[row.review_status] || row.review_status}</dd></div></dl>
    </article>)}</div>
    {preview && rows.length < preview.total && !error && <button type="button" className="btn secondary" disabled={loading} onClick={() => setPage(value => value + 1)}>Load more learners</button>}
  </section>
}
