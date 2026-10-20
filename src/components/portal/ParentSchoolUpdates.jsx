import { useEffect, useRef, useState } from 'react'
import { acknowledgeNewsletter, newsletterFileLink, newsletterRequest } from '../../lib/schoolNewsletters'
import { canPreviewLearningFile, learningPublicationDate } from '../../lib/parentLearningLibrary'
import ParentLibraryFilePanel from './ParentLibraryFilePanel'
import './schoolNewsletters.css'

export default function ParentSchoolUpdates({ supabase, student }) {
  const [page, setPage] = useState(0)
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState({ key: '', items: [], total: 0, error: '' })
  const [view, setView] = useState(null)
  const [fileBusy, setFileBusy] = useState(false)
  const [readBusy, setReadBusy] = useState('')
  const [error, setError] = useState('')
  const generation = useRef(0)
  const key = `${student.id}:${page}:${revision}`
  useEffect(() => {
    const controller = new AbortController()
    let active = true
    newsletterRequest(supabase.rpc('parent_school_updates', { p_student_id: student.id, p_offset: page * 20, p_limit: 20 }).abortSignal(controller.signal))
      .then(data => {
        if (data?.learner_id !== student.id || !Array.isArray(data.items) || !Number.isInteger(data.total_count)) throw new Error('The newsletter response was incomplete. Please retry.')
        if (active) setResult({ key, items: data.items, total: data.total_count, error: '' })
      }).catch(error => { if (active) setResult({ key, items: [], total: 0, error: error.message }) })
    return () => { active = false; controller.abort(); generation.current += 1 }
  }, [supabase, student.id, page, key])
  useEffect(() => {
    if (!view?.url) return
    const timer = setTimeout(() => setView(previous => previous ? { ...previous, expired: true } : null), 60000)
    return () => clearTimeout(timer)
  }, [view?.url])
  async function openFile(row, preview) {
    const current = ++generation.current
    setFileBusy(true); setView(null); setError('')
    try { const url = await newsletterFileLink(supabase, row.file, preview); if (generation.current === current) setView({ row, preview, url, expired: false }) }
    catch (error) { if (generation.current === current) setError(error.message) }
    finally { if (generation.current === current) setFileBusy(false) }
  }
  async function markRead(id) {
    const current = generation.current
    setReadBusy(id); setError('')
    try { await acknowledgeNewsletter(supabase, id); if (generation.current === current) setRevision(value => value + 1) }
    catch (error) { if (generation.current === current) setError(error.message) }
    finally { setReadBusy('') }
  }
  return <div className="school-newsletters"><p>School updates for {student.full_name} · {student.class_level}. Marking as read records your acknowledgement; it does not claim that the learner read the document.</p>
    <button type="button" className="btn secondary" disabled={fileBusy || Boolean(readBusy)} onClick={() => { setView(null); setRevision(value => value + 1) }}>Refresh school updates</button>
    {error && <p role="alert">{error}</p>}{fileBusy && <p role="status">Preparing a private file link…</p>}
    {result.key !== key ? <p role="status">Loading school updates…</p> : result.error ? <p role="alert">{result.error}</p> : <>
      {!result.items.length && <p>No published updates for this learner yet.</p>}
      {result.items.map(row => <article className="newsletter-card" key={row.id}><h2>{row.title}</h2><p>{row.pinned ? 'Pinned · ' : ''}{row.category} · {learningPublicationDate(row.published_at)} · {row.acknowledged ? 'Acknowledged' : 'Unread'}</p><p className="newsletter-body">{row.body}</p>
        {row.file && <><p>Attachment: {row.file.original_name}</p>{canPreviewLearningFile(row.file) && <button type="button" className="btn secondary" disabled={fileBusy} onClick={() => openFile(row, true)}>Preview attachment</button>}<button type="button" className="btn secondary" disabled={fileBusy} onClick={() => openFile(row, false)}>Prepare download</button></>}
        {!row.acknowledged && <button type="button" className="btn secondary" disabled={Boolean(readBusy)} onClick={() => markRead(row.id)}>Mark as read</button>}
      </article>)}
      <div className="newsletter-actions"><button type="button" className="btn secondary" disabled={page === 0 || fileBusy || Boolean(readBusy)} onClick={() => { setView(null); setPage(value => value - 1) }}>Previous updates</button><span>Page {page + 1}</span><button type="button" className="btn secondary" disabled={(page + 1) * 20 >= result.total || fileBusy || Boolean(readBusy)} onClick={() => { setView(null); setPage(value => value + 1) }}>Next updates</button></div>
    </>}
    {view && <ParentLibraryFilePanel view={view} onClose={() => { generation.current += 1; setView(null) }} onRenew={() => openFile(view.row, view.preview)} />}
  </div>
}
