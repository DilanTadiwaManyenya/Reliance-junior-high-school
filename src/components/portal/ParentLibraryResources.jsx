import { useEffect, useRef, useState } from 'react'
import Card from '../ui/Card'
import Button from '../ui/Button'
import PortalNotice from './PortalNotice'
import ParentLibraryFilePanel from './ParentLibraryFilePanel'
import { learningFileSize } from '../../lib/learningLibrary'
import { canPreviewLearningFile, parentLearningFileLink, learningPublicationDate, parentLibraryFilters, PARENT_LIBRARY_PAGE_SIZE, readParentLibrary } from '../../lib/parentLearningLibrary'

export default function ParentLibraryResources({ supabase, student, params, setParams, onRefreshLinks }) {
  const filters = parentLibraryFilters(params)
  const [revision, setRevision] = useState(0)
  const [feed, setFeed] = useState({ key: '', data: null, error: '' })
  const [fileState, setFileState] = useState(null)
  const [fileRevision, setFileRevision] = useState(0)
  const [busyState, setBusyState] = useState(null)
  const linkRequest = useRef(null)
  const queryKey = JSON.stringify([student.id, filters.subject, filters.year, filters.term, filters.page, revision])
  const busy = busyState?.key === queryKey ? busyState.id : ''
  const setBusy = id => setBusyState({ key: queryKey, id })
  useEffect(() => {
    let active = true
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15000)
    readParentLibrary(supabase, student.id, { subject: filters.subject, year: filters.year, term: filters.term, page: filters.page }, controller.signal)
      .then(data => { if (active) setFeed({ key: queryKey, data, error: '' }) })
      .catch(failure => { if (active) setFeed({ key: queryKey, data: null, error: failure.message || 'Could not load learning files. Please retry.' }) })
      .finally(() => clearTimeout(timer))
    return () => { active = false; clearTimeout(timer); controller.abort() }
  }, [supabase, student.id, filters.subject, filters.year, filters.term, filters.page, queryKey])
  useEffect(() => () => linkRequest.current?.abort(), [queryKey])
  useEffect(() => {
    if (!fileState?.url) return
    const timer = setTimeout(() => setFileState(current => current ? { ...current, expired: true } : null), 55000)
    return () => clearTimeout(timer)
  }, [fileState?.url, fileRevision])
  const data = feed.key === queryKey ? feed.data : null
  const learner = data?.learner || student
  const updateFilters = (name, value) => {
    linkRequest.current?.abort()
    setFileState(null); setBusy('')
    setParams(previous => { const next = new URLSearchParams(previous); if (value) next.set(name, value); else next.delete(name); if (name !== 'page') next.delete('page'); return next })
  }
  const requestFile = async (row, preview) => {
    linkRequest.current?.abort()
    const controller = new AbortController()
    linkRequest.current = controller
    setBusy(row.id); setFileState(null)
    try {
      const url = await parentLearningFileLink(supabase, row.file, preview, controller.signal)
      if (!controller.signal.aborted) { setFileState({ key: queryKey, row, preview, url }); setFileRevision(value => value + 1) }
    } catch (failure) { if (!controller.signal.aborted) setFileState({ key: queryKey, row, error: failure.message }) }
    finally { if (!controller.signal.aborted) setBusy('') }
  }
  const visibleFile = fileState?.key === queryKey ? fileState : null
  return <>
    <div className="parent-library-scope"><strong>{learner.full_name}</strong><span>{learner.campus === 'junior' ? 'Junior School' : 'Senior School'} · {learner.class_level}{learner.class_stream ? ` · ${learner.class_stream}` : ''}</span></div>
    <div className="parent-library-filters"><label>Subject<select aria-label="Subject" value={filters.subject} onChange={event => updateFilters('subject', event.target.value)}><option value="">All subjects</option>{filters.subject && !data?.subjects.includes(filters.subject) && <option value={filters.subject}>{filters.subject}</option>}{data?.subjects.map(subject => <option key={subject}>{subject}</option>)}</select></label><label>Academic year<select aria-label="Academic year" value={filters.year || ''} onChange={event => updateFilters('year', event.target.value)}><option value="">All years</option>{filters.year && !data?.years.includes(filters.year) && <option value={filters.year}>{filters.year}</option>}{data?.years.map(year => <option key={year} value={year}>{year}</option>)}</select></label><label>Term<select aria-label="Term" value={filters.term || ''} onChange={event => updateFilters('term', event.target.value)}><option value="">All terms</option>{[1, 2, 3].map(term => <option key={term} value={term}>Term {term}</option>)}</select></label><Button type="button" variant="secondary" onClick={() => { linkRequest.current?.abort(); setFileState(null); setBusy(''); setRevision(value => value + 1) }}>Refresh library</Button></div>
    {feed.key !== queryKey ? <p role="status">Loading learning files…</p> : feed.error ? <PortalNotice tone="error">{feed.error} <div className="parent-library-actions"><Button type="button" variant="secondary" onClick={() => setRevision(value => value + 1)}>Retry library</Button><Button type="button" variant="secondary" onClick={onRefreshLinks}>Refresh learner connections</Button></div></PortalNotice> : <>
      <p className="parent-library-count" role="status">{data.total_count} learning {data.total_count === 1 ? 'resource' : 'resources'} for this learner’s current class</p>
      {!data.resources.length ? <Card><h2>{data.total_count ? 'No resources on this page' : 'No learning files found'}</h2><p>{filters.subject || filters.year || filters.term ? 'Try another subject, year or term.' : 'Your child’s teachers have not published learning files for this class yet.'}</p>{filters.page > 1 && <Button type="button" variant="secondary" onClick={() => updateFilters('page', '')}>First page</Button>}</Card> : <div className="parent-library-grid">{data.resources.map(row => <Card key={row.id} className="parent-library-note"><span className="parent-library-subject">{row.subject}</span><h2>{row.title}</h2><p className="parent-library-meta">{row.teacher_name} · {row.academic_year} · Term {row.term}{row.published_at && <> · Shared {learningPublicationDate(row.published_at)}</>}</p>{row.description && <p className="parent-library-description">{row.description}</p>}<p className="parent-library-meta">{row.file.original_name} · {learningFileSize(row.file.size_bytes)}</p><div className="parent-library-actions">{canPreviewLearningFile(row.file) && <Button type="button" variant="secondary" disabled={Boolean(busy)} onClick={() => requestFile(row, true)}>Preview file</Button>}<Button type="button" disabled={Boolean(busy)} onClick={() => requestFile(row, false)}>Prepare download</Button></div>{busy === row.id && <p role="status">Preparing your private file link…</p>}</Card>)}</div>}
      {data.total_count > 0 && <nav className="parent-library-pagination" aria-label="Learning resource pages"><Button type="button" variant="secondary" disabled={filters.page <= 1} onClick={() => updateFilters('page', String(filters.page - 1))}>Previous</Button><span>Page {filters.page} of {Math.max(1, Math.ceil(data.total_count / PARENT_LIBRARY_PAGE_SIZE))}</span><Button type="button" variant="secondary" disabled={filters.page >= 501 || filters.page * PARENT_LIBRARY_PAGE_SIZE >= data.total_count} onClick={() => updateFilters('page', String(filters.page + 1))}>Next</Button></nav>}
    </>}
    {visibleFile && <ParentLibraryFilePanel view={visibleFile} onClose={() => setFileState(null)} onRenew={() => requestFile(visibleFile.row, visibleFile.preview)} />}
  </>
}
