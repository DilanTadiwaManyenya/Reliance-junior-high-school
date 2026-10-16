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
  storage: { from(bucket) { return {
    async upload(path, blob) {
      const response = await fetch(`${api}/images/${bucket}/${path}`, { method: 'POST', body: blob, headers: { 'Content-Type': blob.type } })
      return { error: response.ok ? null : new Error('Upload failed') }
    },
    getPublicUrl(path) { return { data: { publicUrl: `${api}/images/${bucket}/${path}` } } },
    async remove(paths) { for (const path of paths) await fetch(`${api}/images/${bucket}/${path}`, { method: 'DELETE' }); return { error: null } },
  } } },
}
const role = new URLSearchParams(location.search).get('role') || 'admin'
createRoot(document.getElementById('root')).render(role === 'parent'
  ? <ParentUniformShop supabase={supabase} parentId="parent" student={{ id: 'student', full_name: 'Test Learner' }} />
  : <InventoryPOS supabase={supabase} user={{ id: 'staff' }} profile={{ role, active_role: role, campus: role === 'admin' ? 'all' : 'junior' }} />)
