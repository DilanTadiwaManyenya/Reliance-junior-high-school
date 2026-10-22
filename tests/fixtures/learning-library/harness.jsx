import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import TeacherLearningLibrary from '../../../src/components/portal/TeacherLearningLibrary'
import { AuthContext } from '../../../src/context/authContext'
import { SectionContext } from '../../../src/components/portal/StaffPortalLayout'
import '../../../src/index.css'
import '../../../src/teacherWorkspace.css'

const junior = new URLSearchParams(location.search).get('campus') === 'junior'
const classLevel = new URLSearchParams(location.search).get('level') || 'Grade 5'
const teacher = 'teacher', allocation = { id: 'allocation', campus: junior ? 'junior' : 'senior', class_level: junior ? classLevel : 'Form 1', class_stream: '', subject: junior ? classLevel.startsWith('ECD') ? 'English Languages' : 'Mathematics' : 'Combined Science' }
const state = { rows: [], files: [], operations: [], failUpload: false, storedDespiteUploadError: false, loseFinalizeResponse: false, finalizedAfterLostResponse: false, failLoad: false, failPublish: false }
window.libraryFixture = state
const client = {
  from(table) {
    let action = 'select', payload, maybe = false, single = false, returning = false, range = [0, 20]
    const filters = []
    const query = {
      select() { returning = true; return query }, order() { return query }, abortSignal() { return query },
      eq(key, value) { filters.push([key, value]); return query },
      range(start, end) { range = [start, end]; return query },
      maybeSingle() { maybe = true; return query }, single() { single = true; return query },
      insert(value) { action = 'insert'; payload = value; return query },
      update(value) { action = 'update'; payload = value; return query },
      then(resolve, reject) {
        return Promise.resolve().then(() => {
          state.operations.push({ table, action, payload })
          if (table === 'library_curriculum_subjects') return { data: [allocation.subject, 'Indigenous Languages'].map(subject => ({ class_level: allocation.class_level, subject })) }
          if (table === 'reporting_periods') return { data: { academic_year: 2026, term: 3 } }
          if (table === 'portal_content_files') {
            const row = { ...payload, id: crypto.randomUUID(), bucket_id: 'learning-library', active: false, ready: false }
            row.object_path = `${payload.resource_id}/${row.id}.${row.extension}`
            state.files.push(row); return { data: row }
          }
          const id = filters.find(([key]) => key === 'id')?.[1]
          if (action === 'insert') {
            if (returning) return { error: { message: 'RLS rejects INSERT RETURNING' } }
            const row = { ...payload, state: 'draft', created_at: new Date().toISOString() }
            state.rows.unshift(row); return { data: { ...row } }
          }
          if (action === 'update') {
            if (payload.state === 'published' && state.failPublish) return { error: { message: 'Publication connection dropped' } }
            const row = state.rows.find(row => row.id === id)
            Object.assign(row, payload); return { data: { ...row } }
          }
          if (state.failLoad && !maybe) return { error: { message: 'Library connection unavailable' } }
          const rows = state.rows.filter(row => filters.every(([key, value]) => key.includes('.') || row[key] === value))
            .map(row => ({ ...row, portal_content_files: state.files.filter(file => file.resource_id === row.id && file.active).map(file => ({ ...file })) }))
          return { data: maybe || single ? rows[0] || null : rows.slice(range[0], range[1] + 1) }
        }).then(resolve, reject)
      },
    }
    return query
  },
  storage: { from(bucket) { return {
    async upload(path, file, options) {
      state.operations.push({ upload: path, bucket, options, size: file.size })
      const row = state.files.find(item => item.object_path === path)
      if (!state.failUpload || state.storedDespiteUploadError) row.stored = true
      return state.failUpload ? { error: { message: 'Upload connection dropped' } } : { data: { path } }
    },
    async createSignedUrl(path, seconds) { state.operations.push({ download: path, seconds }); return { data: { signedUrl: 'https://example.test/private-download' } } },
  } } },
  async rpc(name, args) {
    state.operations.push({ rpc: name })
    const file = state.files.find(row => row.id === args.p_file_id)
    if (!file.stored) return { error: { message: 'Stored file is missing' } }
    state.files.filter(row => row.resource_id === file.resource_id).forEach(row => { row.active = false })
    file.active = true; file.ready = true
    if (state.loseFinalizeResponse && !state.finalizedAfterLostResponse) {
      state.finalizedAfterLostResponse = true
      return { error: { message: 'Finalization response was lost' } }
    }
    return { data: null }
  },
}
const profile = { campus: allocation.campus, role: 'teacher', active_role: 'teacher', teacher_class_assignments: [allocation], teacher_class_subject_assignments: [allocation] }
const section = { activeClassFilter: { level: allocation.class_level, stream: '' }, selectedSubjectAllocationId: allocation.id, selectedSubject: allocation.subject, selectedSubjectLevel: allocation.class_level,
  clearSubjectGroup() { state.operations.push({ navigate: 'allocations' }) }, setSection() { state.operations.push({ navigate: 'dashboard' }) } }
createRoot(document.getElementById('root')).render(<MemoryRouter><AuthContext.Provider value={{ supabase: client, profile, user: { id: teacher }, activeRole: 'teacher' }}><SectionContext.Provider value={section}><main style={{ padding: 16 }}><TeacherLearningLibrary /></main></SectionContext.Provider></AuthContext.Provider></MemoryRouter>)
