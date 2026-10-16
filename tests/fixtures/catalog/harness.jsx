import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createClient } from '@supabase/supabase-js'
import InventoryPOS from '../../../src/components/portal/InventoryPOS'
import ParentUniformShop from '../../../src/components/portal/ParentUniformShop'
import '../../../src/index.css'
import '../../../src/portal.css'
import '../../../src/parentPortal.css'

const api = `${location.origin}/catalog-api`
const client = createClient(api, 'fixture-public-key', { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
const supabase = {
  from: client.from.bind(client),
  rpc: client.rpc.bind(client),
  storage: { from(bucket) { return {
    async upload(path, blob) {
      const response = await fetch(`${api}/images/${bucket}/${path}`, { method: 'POST', body: blob, headers: { 'Content-Type': blob.type } })
      return { error: response.ok ? null : new Error('Upload failed') }
    },
    async copy(source, destination) { const response = await fetch(`${api}/copy/${bucket}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source, destination }) }); return { error: response.ok ? null : new Error('Copy failed') } },
    getPublicUrl(path) { return { data: { publicUrl: `${api}/images/${bucket}/${path}` } } },
    async remove(paths) { for (const path of paths) await fetch(`${api}/images/${bucket}/${path}`, { method: 'DELETE' }); return { error: null } },
  } } },
}
const role = new URLSearchParams(location.search).get('role') || 'admin'
function ParentFixture() {
  const family = new URLSearchParams(location.search).has('family');
  const students = family ? [
    { id: 'student-junior', full_name: 'Junior Learner', campus: 'junior', status: 'active' },
    { id: 'student-senior', full_name: 'Senior Learner', campus: 'senior', status: 'active' },
    { id: 'student-missing', full_name: 'Unassigned Learner', campus: null, status: 'active' },
    { id: 'student-inactive', full_name: 'Inactive Learner', campus: 'senior', status: 'inactive' },
    { id: 'student-unverified', full_name: 'Unverified Learner', campus: 'junior', status: 'active' },
  ] : [{ id: 'student', full_name: 'Test Learner', campus: new URLSearchParams(location.search).get('campus') || 'junior', status: 'active' }];
  const [studentId, setStudentId] = useState(students[0].id);
  return <>{family && <label>Buying for<select value={studentId} onChange={event => setStudentId(event.target.value)}>{students.map(student => <option key={student.id} value={student.id}>{student.full_name}</option>)}</select></label>}<ParentUniformShop supabase={supabase} parentId="parent" student={students.find(student => student.id === studentId)} /></>;
}
createRoot(document.getElementById('root')).render(role === 'parent'
  ? <ParentFixture />
  : <InventoryPOS supabase={supabase} user={{ id: 'staff' }} profile={{ role, active_role: role, campus: new URLSearchParams(location.search).get('campus') || (role === 'admin' ? 'all' : 'junior') }} />)
