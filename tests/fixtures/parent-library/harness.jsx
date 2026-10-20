import { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, useLocation } from 'react-router-dom'
import App from '../../../src/App'
import { AuthContext } from '../../../src/context/authContext'
import '../../../src/index.css'
import '../../../src/portal.css'
import '../../../src/parentPortal.css'
import '../../../src/portalResponsive.css'
import '../../../src/parentResponsive.css'
import '../../../src/portalFoundation.css'
import '../../../src/portalNavigation.css'
const params = new URLSearchParams(location.search)
const students = [
  { id: 'senior-child', full_name: 'Senior learner with a longer name', campus: 'senior', class_level: 'Form 1', class_stream: 'Blue', status: 'active' },
  { id: 'junior-child', full_name: 'Junior learner', campus: 'junior', class_level: 'Grade 5', class_stream: '', status: 'active' },
  { id: 'inactive-child', full_name: 'Former learner', campus: 'senior', class_level: 'Form 6', class_stream: 'Arts', status: 'inactive' },
]
const resources = Array.from({ length: 23 }, (_, index) => {
  const mime = index === 1 ? 'application/msword' : index === 0 ? 'image/png' : 'application/pdf'
  const ext = index === 1 ? 'doc' : index === 0 ? 'png' : 'pdf'
  return { id: `senior-note-${index}`, title: `Senior revision ${String(index + 1).padStart(2, '0')}`, description: 'Learning notes for this allocated class.', teacher_name: 'Ms Example', published_at: '2026-10-20T08:00:00Z', subject: index < 12 ? 'Mathematics' : 'Combined Science', academic_year: index % 2 ? 2025 : 2026, term: index % 2 ? 2 : 3,
    file: { id: `file-${index}`, bucket_id: 'learning-library', object_path: `resource/${index}.${ext}`, original_name: `lesson-${index}.${ext}`, mime_type: mime, size_bytes: 150000, active: true, ready: true } }
})
resources.push({ ...resources[0], id: 'junior-note', title: 'Junior mathematics notes', subject: 'Mathematics', file: { ...resources[0].file, id: 'junior-file', object_path: 'junior/notes.png', original_name: 'junior-notes.png' } })
const state = { students, calls: [], fileCalls: [], failLinks: false, failLibrary: false, failFile: false, holdSenior: false, holdFile: false }
window.parentLibraryFixture = state
const client = {
  from(table) {
    let single = false, limit, mutation = false
    const filters = []
    const query = {
      select() { return query }, order() { return query }, abortSignal() { return query },
      eq(key, value) { filters.push([key, value]); return query }, not() { return query }, limit(value) { limit = value; return query },
      insert() { mutation = true; return query }, maybeSingle() { single = true; return query },
      then(resolve, reject) {
        let data = []
        if (table === 'parent_student') {
          if (state.failLinks) return Promise.resolve({ data: null, error: { message: 'Connection unavailable' } }).then(resolve, reject)
          data = students.map(student => ({ parent_id: 'parent', student_id: student.id, verified_at: '2026-10-20', student }))
          data = data.filter(row => filters.every(([key, value]) => row[key] === value))
          if (limit) data = data.slice(0, limit)
        }
        if (!mutation) state.calls.push({ table })
        return Promise.resolve({ data: single ? data[0] || null : data, error: null }).then(resolve, reject)
      },
    }
    return query
  },
  rpc(name, args) {
    state.calls.push({ name, args })
    if (name === 'parent_school_updates') {
      const result = { learner_id: args.p_student_id, total_count: 1, items: [{ id: `update-${args.p_student_id}`, title: args.p_student_id === 'junior-child' ? 'Junior school newsletter' : 'Senior school newsletter', body: 'Campus update', category: 'newsletter', published_at: '2026-10-20T08:00:00Z', acknowledged: true, file: null }] }
      return { abortSignal() { return this }, then(resolve, reject) { return Promise.resolve({ data: result }).then(resolve, reject) } }
    }
    const student = students.find(student => student.id === args.p_student_id)
    const scoped = resources.filter(row => student?.campus === 'junior' ? row.id === 'junior-note' : row.id.startsWith('senior-note-'))
    const filtered = scoped.filter(row => (!args.p_subject || row.subject === args.p_subject) && (!args.p_year || row.academic_year === args.p_year) && (!args.p_term || row.term === args.p_term))
    const result = state.failLibrary ? { data: null, error: { code: '500', message: 'Disconnected' } }
      : { data: { learner: student, subjects: [...new Set(scoped.map(row => row.subject))], years: [...new Set(scoped.map(row => row.academic_year))], total_count: filtered.length, resources: filtered.slice(args.p_offset, args.p_offset + args.p_limit) } }
    return { abortSignal() { return this }, then(resolve, reject) {
      return (state.holdSenior && args.p_student_id === 'senior-child' ? new Promise(done => { window.resolveHeldParentLibrary = () => done(result) }) : Promise.resolve(result)).then(resolve, reject)
    } }
  },
  storage: { from(bucket) { return { async createSignedUrl(path, seconds, options) {
    state.fileCalls.push({ bucket, path, seconds, options })
    const result = state.failFile ? { error: { message: 'Not available' } } : { data: { signedUrl: `${location.origin}/tests/fixtures/parent-library/file/notes.png?token=fixture` } }
    return state.holdFile ? new Promise(resolve => { window.resolveHeldParentFile = () => resolve(result) }) : result
  } } } },
}
function Observer() { const location = useLocation(); useEffect(() => { window.fixtureRoute = location.pathname + location.search }, [location]); return null }
const profile = { id: 'parent', full_name: 'Example parent', role: 'parent', active_role: 'parent' }
const auth = { user: { id: 'parent' }, profile, activeRole: 'parent', roles: ['parent'], loading: false, supabase: client, signOut: async () => {} }
createRoot(document.getElementById('root')).render(<MemoryRouter initialEntries={[params.get('route') || '/portal/library?learner=senior-child']}><AuthContext.Provider value={auth}><Observer /><App /></AuthContext.Provider></MemoryRouter>)
