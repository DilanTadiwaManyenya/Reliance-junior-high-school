import { useEffect, useRef, useState } from 'react'
import Button from '../ui/Button'
import Card from '../ui/Card'
import PortalNotice from './PortalNotice'
import { useCourseworkDraftGuard } from '../../hooks/useCourseworkDraftGuard'
import { changeLearningState, LEARNING_FILE_ACCEPT, learningDownloadLink, learningFileSize, saveLearningDetails, uploadLearningFile, validateLearningFile } from '../../lib/learningLibrary'
import { clearLearningLibraryDraft, learningLibraryDraftKey, loadLearningLibraryDraft, readLearningLibraryDraftMetadata, saveLearningLibraryDraft } from '../../lib/learningLibraryDraft'
import './learningLibrary.css'

const blank = () => ({ id: crypto.randomUUID(), title: '', description: '', academic_year: '', term: '' })
const emptyForm = form => !form.title && !form.description && !form.academic_year && !form.term
const PAGE_SIZE = 20
export default function LearningLibraryWorkspace({ supabase, teacherId, scope, subjects = [], onSubjectChange, onBack }) {
  const draftKey = learningLibraryDraftKey(teacherId, scope)
  const [form, setForm] = useState(() => readLearningLibraryDraftMetadata(draftKey)?.form || blank())
  const [saved, setSaved] = useState(() => readLearningLibraryDraftMetadata(draftKey)?.saved || null)
  const [file, setFile] = useState(null)
  const [baseline, setBaseline] = useState(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(0)
  const [revision, setRevision] = useState(0)
  const [feed, setFeed] = useState({ key: '', rows: [], error: '' })
  const [period, setPeriod] = useState({ data: null, error: '' })
  const [download, setDownload] = useState(null)
  const fileInput = useRef(null)
  const formRef = useRef(null)
  const errorRef = useRef(null)
  const busyRef = useRef(false)
  const draftTouchedRef = useRef(false)
  const effectiveForm = { ...form, academic_year: form.academic_year || period.data?.academic_year || '', term: form.term || period.data?.term || '' }
  const dirty = Boolean(file) || (baseline ? JSON.stringify(form) !== baseline : !emptyForm(form))
  useCourseworkDraftGuard(dirty, Boolean(busy), 'You have unsaved library notes. Leave this view and discard those changes?')
  useEffect(() => {
    let active = true
    loadLearningLibraryDraft(draftKey).then(draft => {
      if (!active) return
      if (!draftTouchedRef.current && draft?.form) {
        setForm(draft.form)
        setSaved(draft.saved || null)
        setFile(draft.file || null)
      }
    }).catch(() => {})
    return () => { active = false }
  }, [draftKey])
  useEffect(() => {
    if (!download) return
    const timer = setTimeout(() => setDownload(null), 55000)
    return () => clearTimeout(timer)
  }, [download])
  useEffect(() => {
    if (!error || !errorRef.current) return
    errorRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    errorRef.current.focus({ preventScroll: true })
  }, [error])
  const feedKey = `${filter}:${page}:${revision}`
  useEffect(() => {
    let active = true
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15000)
    let query = supabase.from('learning_resources')
      .select('*,portal_content_files(id,bucket_id,object_path,original_name,mime_type,size_bytes,ready,active)')
      .eq('teacher_id', teacherId).eq('campus', scope.campus).eq('class_level', scope.class_level)
      .eq('class_stream', scope.class_stream || '').eq('subject', scope.subject).eq('portal_content_files.active', true)
      .order('created_at', { ascending: false }).order('id', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE).abortSignal(controller.signal)
    if (filter !== 'all') query = query.eq('state', filter)
    query.then(({ data, error: failure }) => { if (active) setFeed({ key: feedKey, rows: data || [], error: failure?.message || '' }) })
      .catch(() => { if (active) setFeed({ key: feedKey, rows: [], error: 'Could not load your notes. Check your connection and retry.' }) })
      .finally(() => clearTimeout(timer))
    return () => { active = false; clearTimeout(timer); controller.abort() }
  }, [supabase, teacherId, scope.campus, scope.class_level, scope.class_stream, scope.subject, page, filter, feedKey])
  useEffect(() => {
    let active = true
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15000)
    supabase.from('reporting_periods').select('academic_year,term').eq('campus', scope.campus).eq('is_current', true)
      .eq('state', 'open').maybeSingle().abortSignal(controller.signal)
      .then(({ data, error: failure }) => { if (active) setPeriod({ data, error: failure ? 'Could not load the school period. Enter the year and term below.' : !data ? 'No current open school period. Enter the intended year and term below.' : '' }) })
      .catch(() => { if (active) setPeriod({ data: null, error: 'Could not load the school period. Enter the year and term below.' }) })
      .finally(() => clearTimeout(timer))
    return () => { active = false; clearTimeout(timer); controller.abort() }
  }, [scope.campus, supabase])
  const refresh = () => { setRevision(value => value + 1); setDownload(null) }
  const updateForm = update => {
    draftTouchedRef.current = true
    const next = update(form)
    setForm(next)
    saveLearningLibraryDraft(draftKey, next, file, saved)
  }
  const updateFile = next => {
    draftTouchedRef.current = true
    setFile(next)
    saveLearningLibraryDraft(draftKey, form, next, saved)
  }
  const reset = () => {
    draftTouchedRef.current = true
    clearLearningLibraryDraft(draftKey)
    setForm(blank()); setSaved(null); setBaseline(null); setFile(null); if (fileInput.current) fileInput.current.value = ''
  }
  const chooseFile = event => {
    setError('')
    const next = event.target.files?.[0]
    if (!next) return
    try { validateLearningFile(next); updateFile(next) } catch (failure) { updateFile(null); setError(failure.message); event.target.value = '' }
  }
  const submit = async (event, publish = false) => {
    event.preventDefault()
    if (busyRef.current) return
    if (!formRef.current.reportValidity()) return
    if (publish && !file && !saved?.portal_content_files?.some(item => item.active && item.ready)) return setError('Choose a file before publishing these notes.')
    busyRef.current = true; setBusy('Saving note details…'); setError(''); setNotice('')
    let detailsSaved = false
    try {
      if (file) validateLearningFile(file)
      const row = await saveLearningDetails(supabase, { id: form.id, teacherId, scope, form: effectiveForm })
      detailsSaved = true
      setSaved(current => ({ ...row, portal_content_files: current?.portal_content_files || [] }))
      const next = { id: row.id, title: row.title, description: row.description, academic_year: String(row.academic_year), term: String(row.term) }
      setForm(next); setBaseline(JSON.stringify(next))
      saveLearningLibraryDraft(draftKey, next, file, { ...row, portal_content_files: saved?.portal_content_files || [] })
      if (file) {
        const attachment = await uploadLearningFile(supabase, row.id, file, setBusy)
        setSaved(current => ({ ...current, portal_content_files: [{ ...attachment, ...validateLearningFile(file), active: true, ready: true }] }))
        setFile(null); if (fileInput.current) fileInput.current.value = ''
      }
      if (publish) { setBusy('Publishing your notes…'); await changeLearningState(supabase, row.id, 'published') }
      setNotice(publish ? 'Notes published for the learners in this allocation.' : row.state === 'published' ? 'Your published notes have been updated.' : row.state === 'archived' ? 'Archived notes updated. Restore to draft before publishing again.' : 'Draft saved. Parents cannot see draft notes.')
      reset(); refresh()
    } catch (failure) {
      setError(`${detailsSaved ? 'The note details were saved. ' : ''}${failure.message || 'Unable to save your notes.'} Check the saved notes before retrying if your connection dropped.`)
      refresh()
    } finally { busyRef.current = false; setBusy('') }
  }
  const edit = row => {
    if (busy || (dirty && !window.confirm('Discard your unsaved note changes?'))) return
    const next = { id: row.id, title: row.title, description: row.description, academic_year: String(row.academic_year), term: String(row.term) }
    setForm(next); setBaseline(JSON.stringify(next)); setSaved(row); setFile(null); setError(''); setNotice('')
    draftTouchedRef.current = true
    saveLearningLibraryDraft(draftKey, next, null, row)
    if (fileInput.current) fileInput.current.value = ''
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    formRef.current?.querySelector('input')?.focus({ preventScroll: true })
  }
  const setState = async (row, state) => {
    if (busyRef.current) return
    if (saved?.id === row.id && dirty && !window.confirm('Discard your unsaved note changes before changing its status?')) return
    if (state === 'archived' && !window.confirm(`Archive “${row.title}”? Parents will no longer see it in the library.`)) return
    busyRef.current = true; setBusy('Updating note status…'); setError(''); setNotice('')
    try { await changeLearningState(supabase, row.id, state); if (saved?.id === row.id) reset(); setNotice(state === 'archived' ? 'Notes archived.' : 'Notes restored to draft. Review and publish when ready.'); refresh() }
    catch (failure) { setError(failure.message) }
    finally { busyRef.current = false; setBusy('') }
  }
  const prepareDownload = async attachment => {
    if (busyRef.current) return
    busyRef.current = true; setBusy('Preparing a private download link…'); setError(''); setDownload(null)
    try { const url = await learningDownloadLink(supabase, attachment); setDownload({ id: attachment.id, url }) }
    catch (failure) { setError(failure.message) }
    finally { busyRef.current = false; setBusy('') }
  }
  const rows = feed.key === feedKey ? feed.rows.slice(0, PAGE_SIZE) : []
  const currentFile = saved?.portal_content_files?.find(item => item.active && item.ready)
  return <section className="learning-library" aria-labelledby="learning-library-title">
    <header className="dash-page-header"><div><p className="eyebrow">Teaching resources</p><h1 id="learning-library-title" className="dash-page-title">Learning library</h1><p className="dash-page-sub">Share notes with parents of learners in your allocation.</p></div><Button type="button" variant="secondary" className="library-back" onClick={onBack}>Back to allocations</Button></header>
    <div className="library-scope"><strong>{scope.class_level}{scope.class_stream ? ` · ${scope.class_stream}` : scope.campus === 'senior' ? ' · all allocated streams' : ''}</strong><span>{scope.campus === 'junior' ? 'Junior School' : 'Senior School'}</span>{subjects.length ? <label>Subject<select aria-label="Subject" data-draft-navigation value={scope.subject} onChange={event => onSubjectChange(event.target.value)}>{subjects.map(subject => <option key={subject}>{subject}</option>)}</select></label> : <strong>{scope.subject}</strong>}</div>
    {error && <div ref={errorRef} tabIndex={-1} className="library-error-focus"><PortalNotice tone="error">{error}</PortalNotice></div>}{notice && <PortalNotice>{notice}</PortalNotice>}
    {busy && <p className="library-progress" role="status" aria-live="polite">{busy}</p>}
    <Card><form ref={formRef} className="library-form" aria-label={saved ? 'Edit learning notes' : 'Add learning notes'} onSubmit={submit}>
      <h2>{saved ? 'Edit notes' : 'Upload learning notes'}</h2><p className="muted">Your class and subject stay fixed. Save a draft or publish when the file is ready.</p>
      {period.error && !saved && <PortalNotice>{period.error}</PortalNotice>}
      <fieldset disabled={Boolean(busy)}><div className="library-fields">
        <label className="library-wide">Title<input required maxLength={200} value={form.title} onChange={event => updateForm(value => ({ ...value, title: event.target.value }))} /></label>
        <label className="library-wide">Description or topic<textarea rows={3} maxLength={10000} value={form.description} onChange={event => updateForm(value => ({ ...value, description: event.target.value }))} /></label>
        <label>Academic year<input type="number" min={2000} max={2200} required disabled={Boolean(saved)} value={effectiveForm.academic_year} onChange={event => updateForm(value => ({ ...value, academic_year: event.target.value }))} /></label>
        <label>Term<select aria-label="Term" required disabled={Boolean(saved)} value={effectiveForm.term} onChange={event => updateForm(value => ({ ...value, term: event.target.value }))}><option value="">Choose term</option>{[1, 2, 3].map(term => <option key={term} value={term}>Term {term}</option>)}</select></label>
        <label className="library-wide">{currentFile ? 'Replace attachment' : 'Learning file'}<input ref={fileInput} type="file" aria-label="Learning file" accept={LEARNING_FILE_ACCEPT} onChange={chooseFile} /><small>PDF, Word, PowerPoint, JPG, PNG or WebP · maximum 10 MB. Files download only when requested.</small></label>
      </div>
      {currentFile && <p className="library-file-summary">Current file: {currentFile.original_name} · {learningFileSize(currentFile.size_bytes)}</p>}
      {file && <div className="library-selected-file"><span>Selected: <strong>{file.name}</strong> · {learningFileSize(file.size)}<small>Saved on this device until the note is saved or cleared.</small></span><Button type="button" variant="secondary" onClick={() => { updateFile(null); if (fileInput.current) fileInput.current.value = '' }}>Remove selection</Button></div>}
      <div className="library-actions"><Button type="submit">{saved && saved.state !== 'draft' ? 'Save changes' : 'Save draft'}</Button>{saved?.state !== 'published' && saved?.state !== 'archived' && <Button type="button" onClick={event => submit(event, true)}>Publish notes</Button>}<Button type="button" variant="secondary" onClick={() => { if (!dirty || window.confirm('Discard your unsaved note changes?')) { reset(); setError('') } }}>New note / clear form</Button></div>
      </fieldset>
    </form></Card>
    <div className="library-list-heading"><h2>Your saved notes</h2><label>Status<select aria-label="Status" value={filter} onChange={event => { setFilter(event.target.value); setPage(0) }}><option value="all">All notes</option><option value="published">Published</option><option value="draft">Drafts</option><option value="archived">Archived</option></select></label><Button type="button" variant="secondary" disabled={Boolean(busy)} onClick={refresh}>Refresh notes</Button></div>
    {feed.key !== feedKey ? <p role="status">Loading notes…</p> : feed.error ? <PortalNotice tone="error">{feed.error} <Button type="button" variant="secondary" onClick={refresh}>Retry notes</Button></PortalNotice> : !rows.length ? <Card><p>No {filter === 'all' ? '' : `${filter} `}notes in this allocation yet.</p></Card> : <div className="library-notes-grid">{rows.map(row => {
      const attachment = row.portal_content_files?.find(item => item.active && item.ready)
      return <Card key={row.id} className="library-note"><span className={`library-state library-state-${row.state}`}>{row.state}</span><h3>{row.title}</h3><p className="library-note-period">{row.academic_year} · Term {row.term} · {row.subject}</p>{row.description && <p className="library-description">{row.description}</p>}<p className="library-file-summary">{attachment ? `${attachment.original_name} · ${learningFileSize(attachment.size_bytes)}` : 'No finalized attachment yet'}</p><div className="library-actions"><Button type="button" variant="secondary" disabled={Boolean(busy)} onClick={() => edit(row)}>Edit notes</Button>{attachment && <Button type="button" variant="secondary" disabled={Boolean(busy)} onClick={() => prepareDownload(attachment)}>Prepare download</Button>}<Button type="button" variant="secondary" disabled={Boolean(busy)} onClick={() => setState(row, row.state === 'archived' ? 'draft' : 'archived')}>{row.state === 'archived' ? 'Restore to draft' : 'Archive notes'}</Button></div>{download?.id === attachment?.id && <a className="btn secondary library-download" href={download.url} target="_blank" rel="noopener noreferrer">Download {attachment.original_name} · link lasts 60 seconds</a>}</Card>
    })}</div>}
    <nav className="library-pagination" aria-label="Saved notes pages"><Button type="button" variant="secondary" disabled={Boolean(busy) || page === 0} onClick={() => setPage(value => value - 1)}>Previous</Button><span>Page {page + 1}</span><Button type="button" variant="secondary" disabled={Boolean(busy) || feed.key !== feedKey || Boolean(feed.error) || feed.rows.length <= PAGE_SIZE} onClick={() => setPage(value => value + 1)}>Next</Button></nav>
  </section>
}
