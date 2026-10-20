import { useEffect, useState } from 'react'
import { useAuth } from '../../context/useAuth'
import { useCourseworkDraftGuard } from '../../hooks/useCourseworkDraftGuard'
import { LEARNING_FILE_ACCEPT, validateLearningFile } from '../../lib/learningLibrary'
import { newsletterDates, newsletterRequest, schoolDateInput, uploadNewsletterFile } from '../../lib/schoolNewsletters'
import './schoolNewsletters.css'

const levels = campus => campus === 'junior' ? ['ECD A', 'ECD B', ...Array.from({ length: 7 }, (_, i) => `Grade ${i + 1}`)] : [...Array.from({ length: 4 }, (_, i) => `Form ${i + 1}`), 'Lower Six', 'Upper Six', 'Form 5', 'Form 6']
const targetFor = campus => ({ campus, class_level: '', class_stream: '' })

function NewsletterEditor({ row, onClose, onSaved }) {
  const { supabase, profile } = useAuth()
  const [id] = useState(() => row?.id || crypto.randomUUID())
  const [saved, setSaved] = useState(Boolean(row))
  const [state, setState] = useState(row?.state || 'draft')
  const [audience, setAudience] = useState(row?.audience || 'parents')
  const [form, setForm] = useState(() => ({ title: row?.title || '', body: row?.body || '', campus: row?.campus || (profile.campus === 'all' ? 'junior' : profile.campus), category: row?.category || 'newsletter', pinned: row?.pinned || false, published: schoolDateInput(row?.published_at), expires: schoolDateInput(row?.expires_at) }))
  const [targets, setTargets] = useState(() => row?.announcement_targets || [targetFor(profile.campus === 'all' ? 'junior' : profile.campus)])
  const [activeFile, setActiveFile] = useState(() => row?.portal_content_files?.find(file => file.active && file.ready))
  const [file, setFile] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  useCourseworkDraftGuard(dirty, busy, 'Leave this newsletter and discard unsaved changes?')
  const update = (key, value) => { setForm(previous => ({ ...previous, [key]: value })); setDirty(true) }
  const updateTarget = (index, key, value) => { setTargets(previous => previous.map((target, i) => i === index ? { ...target, [key]: value, ...(key === 'campus' ? { class_level: '', class_stream: '' } : key === 'class_level' ? { class_stream: '' } : {}) } : target)); setDirty(true) }
  const close = () => { if (!busy && (!dirty || window.confirm('Discard unsaved newsletter changes?'))) onClose() }
  async function save(nextState) {
    setBusy(true); setMessage('')
    try {
      if (!form.title.trim()) throw new Error('Enter a newsletter title.')
      if (file) validateLearningFile(file)
      if (nextState === 'published' && !form.body.trim() && !file && !activeFile) throw new Error('Add newsletter text or an attachment before publishing.')
      const details = { title: form.title.trim(), body: form.body.trim(), category: form.category, audience, pinned: form.pinned, ...newsletterDates(form.published, form.expires) }
      const existing = await newsletterRequest(supabase.from('announcements').select('id,state,campus').eq('id', id).maybeSingle())
      if (existing && existing.campus !== form.campus) throw new Error('This saved newsletter belongs to another campus. Reopen it before continuing.')
      if (!existing) {
        // Its read policy also looks up the parent row: avoid INSERT RETURNING.
        await newsletterRequest(supabase.from('announcements').insert({ id, campus: form.campus, ...details }))
        setSaved(true)
      } else {
        if (existing.state !== state) throw new Error('This newsletter changed in another session. Close and refresh before editing.')
        await newsletterRequest(supabase.from('announcements').update(details).eq('id', id).select('id').single())
      }
      if ((existing?.state || 'draft') === 'draft') await newsletterRequest(supabase.rpc('save_announcement_targets', { p_announcement_id: id, p_targets: targets.map(({ campus, class_level, class_stream }) => ({ campus, class_level, class_stream })) }))
      if (file) { const uploaded = await uploadNewsletterFile(supabase, id, file); setActiveFile(uploaded); setFile(null) }
      const result = await newsletterRequest(supabase.from('announcements').update({ state: nextState }).eq('id', id).select('state').single())
      setState(result.state); setDirty(false); setMessage(`Saved as ${result.state}.`); onSaved()
    } catch (error) { setMessage(error.message) }
    finally { setBusy(false) }
  }
  return <section className="newsletter-editor" aria-label="Newsletter editor"><h2>{saved ? 'Edit newsletter' : 'New newsletter'}</h2><p>Status: {state}. Times use school time (Africa/Harare). Saved campus cannot be changed.</p>
    {message && <p role="status" className="newsletter-message">{message}</p>}
    <fieldset disabled={busy}><div className="newsletter-fields">
      <label>Title<input maxLength={200} value={form.title} onChange={e => update('title', e.target.value)} /></label>
      <label>Campus<select aria-label="Campus" disabled={saved || profile.campus !== 'all'} value={form.campus} onChange={e => { update('campus', e.target.value); setTargets(e.target.value === 'all' ? [targetFor('junior'), targetFor('senior')] : [targetFor(e.target.value)]) }}>{(profile.campus === 'all' ? ['junior', 'senior', 'all'] : [profile.campus]).map(campus => <option key={campus}>{campus}</option>)}</select></label>
      <label>Category<select value={form.category} onChange={e => update('category', e.target.value)}>{['newsletter', 'general', 'academic', 'attendance', 'event', 'urgent'].map(category => <option key={category}>{category}</option>)}</select></label>
      <label>Readers<select aria-label="Readers" value={audience} onChange={e => { setAudience(e.target.value); setDirty(true) }}><option value="parents">Parents and learners through parent portal</option><option value="all">Parents, learners and staff</option><option value="students">Learners through parent portal</option><option value="staff">Staff only</option></select></label>
      <label>Publish from (blank = now)<input type="datetime-local" value={form.published} onChange={e => update('published', e.target.value)} /></label>
      <label>Expiry (optional)<input type="datetime-local" value={form.expires} onChange={e => update('expires', e.target.value)} /></label>
    </div><label>Newsletter text<textarea rows={7} maxLength={20000} value={form.body} onChange={e => update('body', e.target.value)} /></label>
    <label><input type="checkbox" checked={form.pinned} onChange={e => update('pinned', e.target.checked)} /> Pin above other updates</label>
    <h3>Parents and learners receiving this update</h3><p>Blank grade or form means the whole campus. Blank stream means every stream. Return to draft before changing an existing audience.</p>
    <fieldset disabled={state !== 'draft'}>{targets.map((target, index) => <div className="newsletter-target" key={index}>
      <label>Target campus<select aria-label="Target campus" value={target.campus} onChange={e => updateTarget(index, 'campus', e.target.value)}>{(form.campus === 'all' ? ['junior', 'senior'] : [form.campus]).map(campus => <option key={campus}>{campus}</option>)}</select></label>
      <label>Grade / Form<select value={target.class_level} onChange={e => updateTarget(index, 'class_level', e.target.value)}><option value="">All grades / forms</option>{levels(target.campus).map(level => <option key={level}>{level}</option>)}</select></label>
      <label>Stream (optional)<input disabled={!target.class_level} maxLength={80} value={target.class_stream} onChange={e => updateTarget(index, 'class_stream', e.target.value.trim())} /></label>
      <button type="button" className="btn secondary" disabled={targets.length === 1} onClick={() => { setTargets(previous => previous.filter((_, i) => i !== index)); setDirty(true) }}>Remove target {index + 1}</button>
    </div>)}<button type="button" className="btn secondary" disabled={targets.length >= 50} onClick={() => { setTargets(previous => [...previous, targetFor(form.campus === 'all' ? 'junior' : form.campus)]); setDirty(true) }}>Add audience target</button></fieldset>
    <label>Attachment (PDF, Word, PowerPoint or image, up to 10 MB)<input type="file" accept={LEARNING_FILE_ACCEPT} onChange={e => { const selected = e.target.files[0]; try { if (selected) validateLearningFile(selected); setFile(selected || null); setDirty(true); setMessage('') } catch (error) { e.target.value = ''; setFile(null); setMessage(error.message) } }} /></label>
    <p>{file ? `Selected: ${file.name}` : activeFile ? `Current attachment: ${activeFile.original_name}. Uploading a replacement preserves the old file until the new one is ready.` : 'No attachment. Text-only newsletters are supported.'}</p>
    <div className="newsletter-actions"><button type="button" className="btn primary" onClick={() => save(state)}>Save {state}</button>{state !== 'published' && <button type="button" className="btn primary" onClick={() => save('published')}>Publish newsletter</button>}{state !== 'draft' && <button type="button" className="btn secondary" onClick={() => save('draft')}>Return to draft</button>}{state !== 'archived' && <button type="button" className="btn secondary" onClick={() => save('archived')}>Archive newsletter</button>}<button type="button" className="btn secondary" onClick={close}>Close editor</button></div></fieldset>
    {busy && <p role="status">Saving newsletter and checking its attachment…</p>}
  </section>
}

export default function AdminNewsletters() {
  const { supabase, activeRole, profile } = useAuth()
  const [revision, setRevision] = useState(0)
  const [page, setPage] = useState(0)
  const [result, setResult] = useState({ key: '', rows: [], error: '' })
  const [editor, setEditor] = useState(null)
  const key = `${profile?.id}:${profile?.campus}:${page}:${revision}`
  useEffect(() => {
    if (activeRole !== 'admin') return
    let active = true
    let query = supabase.from('announcements').select('*,announcement_targets(*),portal_content_files(*)').order('updated_at', { ascending: false }).range(page * 20, page * 20 + 19)
    if (profile.campus !== 'all') query = query.eq('campus', profile.campus)
    newsletterRequest(query).then(rows => { if (active) setResult({ key, rows, error: '' }) }).catch(error => { if (active) setResult({ key, rows: [], error: error.message }) })
    return () => { active = false }
  }, [supabase, activeRole, profile.campus, page, key])
  if (activeRole !== 'admin') return <p>Only campus Admins can manage newsletters.</p>
  return <section className="school-newsletters"><h1>School newsletters</h1><p>Create updates for your campus or selected grades, forms and streams. Publishing makes them available without a redeployment.</p>
    {editor ? <NewsletterEditor key={editor.id || 'new'} row={editor.id ? editor : null} onClose={() => setEditor(null)} onSaved={() => setRevision(value => value + 1)} /> : <><div className="newsletter-actions"><button className="btn primary" onClick={() => setEditor({})}>New newsletter</button><button className="btn secondary" onClick={() => setRevision(value => value + 1)}>Refresh newsletters</button></div>
    {result.key !== key ? <p role="status">Loading newsletters…</p> : result.error ? <p role="alert">{result.error}</p> : <><p>Page {page + 1} · {result.rows.length} newsletters.</p>{!result.rows.length && <p>No newsletters yet.</p>}{result.rows.map(row => <article className="newsletter-card" key={row.id}><h2>{row.title}</h2><p>{row.campus} · {row.state} · {row.category}{row.pinned ? ' · pinned' : ''}</p><button className="btn secondary" onClick={() => setEditor(row)}>Edit {row.title}</button></article>)}<div className="newsletter-actions"><button className="btn secondary" disabled={page === 0} onClick={() => setPage(value => value - 1)}>Previous newsletters</button><button className="btn secondary" disabled={result.rows.length < 20} onClick={() => setPage(value => value + 1)}>Next newsletters</button></div></>}
    </>}
  </section>
}
