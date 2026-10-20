/* eslint-disable react-refresh/only-export-components */
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext } from '../../../src/context/authContext'
import LibrarySupport from '../../../src/components/portal/LibrarySupport'
import AccountantWorkspaceNav from '../../../src/components/portal/AccountantWorkspaceNav'
import '../../../src/index.css'
import '../../../src/portal.css'
import '../../../src/portalResponsive.css'
const params = new URLSearchParams(location.search)
const file = id => ({ id: `file-${id}`, bucket_id: 'learning-library', object_path: `${id}/file.png`, original_name: `${id}.png`, mime_type: 'image/png', size_bytes: 10000, active: true, ready: true })
const senior = Array.from({ length: 21 }, (_, index) => ({ id: `senior-${index}`, title: `Senior notes ${String(index + 1).padStart(2, '0')}`, campus: 'senior', class_level: index % 2 ? 'Form 2' : 'Form 1', class_stream: '', subject: 'Mathematics', author_name: 'Ms Senior', academic_year: 2026, term: 3, state: index === 2 ? 'draft' : index === 3 ? 'archived' : 'published', published_at: index === 4 ? '2099-01-01T10:00:00Z' : '2026-10-01T08:00:00Z', body: 'Support notes.', file: index === 5 ? null : file(`senior-${index}`) }))
senior[1].file.mime_type = 'application/msword'
const notes = [{ ...senior[0], id: 'junior', title: 'Junior mathematics', campus: 'junior', class_level: 'Grade 5', author_name: 'Mr Junior', file: file('junior') }, ...senior]
const newsletters = ['junior','senior','all'].map(campus => ({ id: `newsletter-${campus}`, title: `${campus} newsletter`, campus, class_level: '', class_stream: '', author_name: 'School Admin', state: 'published', audience: 'parents', published_at: '2026-10-01T08:00:00Z', body: 'Campus news', targets: (campus === 'all' ? ['junior','senior'] : [campus]).map(campus => ({ campus, class_level: '', class_stream: '' })), file: { ...file(`newsletter-${campus}`), bucket_id: 'school-newsletters' } }))
const state = { calls: [], signs: [], failList: false, failTrace: false, failFile: false, holdList: false, holdFile: false }
window.supportFixture = state
const client = {
 rpc(name, args) {
   state.calls.push({ name, args })
   let data, error
   if (name === 'school_library_oversight') {
     let items = args.p_kind === 'notes' ? notes : newsletters
     if (args.p_campus !== 'all') items = items.filter(row => row.campus === args.p_campus || row.campus === 'all')
     const levels = [...new Set(items.map(row => row.class_level).filter(Boolean))]
     items = items.filter(row => (!args.p_state || row.state === args.p_state) && (!args.p_level || row.class_level === args.p_level) && (!args.p_search || `${row.title} ${row.author_name} ${row.subject}`.toLowerCase().includes(args.p_search.toLowerCase())))
     data = { campus: args.p_campus, kind: args.p_kind, levels, total_count: items.length, items: items.slice(args.p_offset, args.p_offset + args.p_limit) }
     if (state.failList) error = { message: 'Support connection dropped' }
   } else {
     const events = Array.from({ length: 23 }, (_, index) => ({ id: `event-${index}`, created_at: '2026-10-20T08:00:00Z', actor_name: index ? 'Ms Senior' : 'Mr Junior', actor_role: 'teacher', operation: index ? 'UPDATE' : 'INSERT', source_table: index ? 'portal_content_files' : 'learning_resources', before: { active: false }, after: { active: true, original_name: 'notes.png' } }))
     data = { content_id: args.p_id, audit_visible: !(params.get('role') === 'accountant' && args.p_id === 'newsletter-all'), total_count: events.length, events: events.slice(args.p_offset, args.p_offset + args.p_limit) }
     if (state.failTrace) error = { message: 'Activity connection dropped' }
   }
   return { abortSignal() { return this }, then(resolve, reject) { return (state.holdList && name === 'school_library_oversight' ? new Promise(done => { window.resolveHeldSupport = () => done({ data, error }) }) : Promise.resolve({ data, error })).then(resolve, reject) } }
 },
 storage: { from(bucket) { return { createSignedUrl(path, seconds, options) {
   state.signs.push({ bucket, path, seconds, options })
   const result = state.failFile ? { error: { message: 'File unavailable' } } : { data: { signedUrl: `${location.origin}/tests/fixtures/library-support/file.png` } }
   return state.holdFile ? new Promise(done => { window.resolveHeldSupportFile = () => done(result) }) : Promise.resolve(result)
 } } } },
}
const activeRole = params.get('role') || 'admin', campus = params.get('campus') || 'all'
const profile = { id: 'support', campus }
function Fixture() { return <main style={{ padding: 16 }}>{activeRole === 'accountant' && <AccountantWorkspaceNav section="library-support" onChange={id => { window.supportNavigation = id }} />}<LibrarySupport /></main> }
createRoot(document.getElementById('root')).render(<MemoryRouter><AuthContext.Provider value={{ supabase: client, profile, activeRole }}><Fixture /></AuthContext.Provider></MemoryRouter>)
