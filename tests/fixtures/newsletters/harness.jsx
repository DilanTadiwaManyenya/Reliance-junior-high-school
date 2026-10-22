/* eslint-disable react-refresh/only-export-components */
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext } from '../../../src/context/authContext'
import AdminNewsletters from '../../../src/components/portal/AdminNewsletters'
import ParentSchoolUpdates from '../../../src/components/portal/ParentSchoolUpdates'
import '../../../src/index.css'
import '../../../src/components/portal/parentLearningLibrary.css'
const params = new URLSearchParams(location.search)
const state = { rows: [], files: [], reads: [], operations: [], failUpload: false, storedDespiteUploadError: false, loseFinalizeResponse: false, finalizedAfterLostResponse: false, failRead: false }
window.newsletterFixture = state
const client = {
  from(table) {
    let action = 'select', payload, single = false, returning = false
    const filters = []
    const query = {
      select() { returning = true; return query }, order() { return query }, limit() { return query }, range() { return query },
      eq(key, value) { filters.push([key, value]); return query },
      maybeSingle() { single = true; return query }, single() { single = true; return query },
      insert(value) { action = 'insert'; payload = value; return query }, update(value) { action = 'update'; payload = value; return query },
      then(resolve, reject) { return Promise.resolve().then(() => {
        state.operations.push({ table, action, payload })
        if (table === 'announcement_reads') { if (state.failRead) return { error: { code: '42501' } }; state.reads.push(payload.announcement_id); return { data: null } }
        if (table === 'portal_content_files') {
          const file = { ...payload, id: crypto.randomUUID(), bucket_id: 'school-newsletters', active: false, ready: false, stored: false }
          file.object_path = `${payload.announcement_id}/${file.id}.${file.extension}`
          state.files.push(file); return { data: file }
        }
        if (action === 'insert') { if (returning) return { error: { message: 'RLS rejects INSERT RETURNING' } }; const row = { ...payload, state: 'draft', announcement_targets: [] }; state.rows.unshift(row); return { data: { ...row } } }
        const rows = state.rows.filter(row => filters.every(([key, value]) => row[key] === value))
        if (action === 'update') { Object.assign(rows[0], payload); return { data: { ...rows[0] } } }
        const data = rows.map(row => ({ ...row, portal_content_files: state.files.filter(file => file.announcement_id === row.id).map(file => ({ ...file })) }))
        return { data: single ? data[0] || null : data }
      }).then(resolve, reject) },
    }
    return query
  },
  rpc(name, args) {
    state.operations.push({ rpc: name, args })
    let data = null
    if (name === 'save_announcement_targets') state.rows.find(row => row.id === args.p_announcement_id).announcement_targets = args.p_targets
    let error = null
    if (name === 'finalize_portal_content_file') {
      const file = state.files.find(row => row.id === args.p_file_id)
      if (!file.stored) error = { message: 'Stored file is missing' }
      else {
        state.files.filter(row => row.announcement_id === file.announcement_id).forEach(row => { row.active = false })
        file.active = true; file.ready = true
        if (state.loseFinalizeResponse && !state.finalizedAfterLostResponse) {
          state.finalizedAfterLostResponse = true
          error = { message: 'Finalization response was lost' }
        }
      }
    }
    if (name === 'parent_school_updates') {
      const items = state.rows.filter(row => row.state === 'published').map(row => ({ ...row, file: state.files.find(file => file.active && file.announcement_id === row.id), acknowledged: state.reads.includes(row.id) }))
      data = { learner_id: args.p_student_id, total_count: items.length, items }
    }
    return { abortSignal() { return this }, then(resolve, reject) { return Promise.resolve({ data, error }).then(resolve, reject) } }
  },
  storage: { from(bucket) { return {
    async upload(path, file, options) {
      state.operations.push({ bucket, path, options })
      const row = state.files.find(item => item.object_path === path)
      if (!state.failUpload || state.storedDespiteUploadError) row.stored = true
      return state.failUpload ? { error: { message: 'Upload connection dropped' } } : { data: { path } }
    },
    async createSignedUrl(path, seconds) { state.operations.push({ sign: path, seconds, bucket }); return { data: { signedUrl: `${location.origin}/tests/fixtures/newsletters/file.png` } } },
  } } },
}
const profile = { id: 'admin', campus: params.get('campus') || 'all' }
const auth = { supabase: client, user: { id: 'admin' }, profile, activeRole: params.get('role') || 'admin' }
function Harness() { return <main style={{ padding: 16 }}><AdminNewsletters /><hr /><ParentSchoolUpdates supabase={client} student={{ id: 'child', full_name: 'Example learner', class_level: 'Form 1' }} /></main> }
createRoot(document.getElementById('root')).render(<MemoryRouter><AuthContext.Provider value={auth}><Harness /></AuthContext.Provider></MemoryRouter>)
