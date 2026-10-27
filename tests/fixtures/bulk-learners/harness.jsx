import React from 'react'
import { createRoot } from 'react-dom/client'
import { AuthContext } from '../../../src/context/authContext'
import BulkLearnerActions from '../../../src/components/portal/BulkLearnerActions'
const params = new URLSearchParams(location.search)
const status = params.get('status') || 'active'
const learners = [
  { id: '1', full_name: 'Fixture White One', admission_number: 'TEST-001', class_level: 'Form 1', class_stream: 'White', enrolled_year: 2026, status },
  { id: '2', full_name: 'Fixture White Two', admission_number: 'TEST-002', class_level: 'Form 1', class_stream: 'White', enrolled_year: 2026, status },
  { id: '3', full_name: 'Fixture Green', admission_number: 'TEST-003', class_level: 'Form 1', class_stream: 'Green', enrolled_year: 2026, status },
  { id: '4', full_name: 'Fixture Old Year', admission_number: 'TEST-004', class_level: 'Form 1', class_stream: 'White', enrolled_year: 2025, status },
]
window.fixtureWrites = []
const supabase = { rpc: async (name, args) => {
  window.fixtureWrites.push({ name, args })
  return { error: name === 'manage_disabled_learner' && args.p_student === '2' ? { message: 'This learner has fee payment history.' } : null }
} }
export default function Ready({ children }) { React.useEffect(() => { window.fixtureReady = true }, []); return children }
createRoot(document.getElementById('root')).render(<Ready><AuthContext.Provider value={{ supabase, activeRole: params.get('role') || 'admin', profile: { campus: params.get('campus') || 'all' } }}><BulkLearnerActions learners={learners} onComplete={async () => ({ ok: true })} /></AuthContext.Provider></Ready>)
