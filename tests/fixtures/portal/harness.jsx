import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { AuthContext } from '../../../src/context/authContext'
import App from '../../../src/App'
import '../../../src/index.css'
import '../../../src/portal.css'
import '../../../src/portalPolish.css'
import '../../../src/staffPortal.css'
import '../../../src/feesDashboard.css'
import '../../../src/designRefinement.css'
import '../../../src/mobileUX.css'
import '../../../src/parentPortal.css'
import '../../../src/teacherWorkspace.css'
import '../../../src/portalResponsive.css'

const params = new URLSearchParams(location.search)
const role = params.get('role') || 'admin'
const campus = params.get('campus') || (role === 'admin' || role === 'principal' ? 'all' : 'senior')
const staffId = '11111111-1111-4111-8111-111111111111'
const today = new Date().toISOString().slice(0, 10)
const learners = ['Alexandra Example Learner With A Longer Name', 'Brian Example', 'Chipo Example'].map((full_name, index) => ({ id: `learner-${index}`, full_name, campus: index === 1 ? 'junior' : 'senior', class_level: index === 1 ? 'Grade 1' : 'Form 1', class_stream: index === 1 ? '' : 'Blue', admission_number: `TEST-2026-00${index + 1}`, status: 'active', enrolled_year: 2026, date_of_birth: '2013-03-15', guardian_phone: '+263771234567', gender: 'Female' }))
const assignments = [{ id: 'allocation', teacher_id: staffId, class_level: campus === 'junior' ? 'Grade 1' : 'Form 1', class_stream: campus === 'junior' ? '' : 'Blue', subject: 'Combined Science', campus }]
const profile = { id: staffId, full_name: 'Ms Example Account With A Longer Display Name', legal_full_name: 'Example Account', working_title: 'Ms', phone: '+263771234567', role, active_role: role, campus, portal_access_enabled: true, teacher_class_assignments: assignments, teacher_class_subject_assignments: assignments }
const assessment = { id: 'assessment', teacher_id: staffId, campus: 'senior', class_level: 'Form 1', class_stream: 'Blue', subject: 'Combined Science', title: 'Week 4 assessment with a longer descriptive title', assessment_type: 'weekly', total_marks: 50, assessment_date: today, term: '3', academic_year: 2026 }
const db = {
  students: learners,
  profiles: [profile, { ...profile, id: 'teacher', role: 'teacher', active_role: 'teacher', campus: 'senior', full_name: 'Ms Example Teacher', is_protected: false }],
  parent_student: params.has('empty') ? [] : learners.map(student => ({ parent_id: staffId, student_id: student.id, verified_at: today, student })),
  teacher_class_assignments: assignments, teacher_class_subject_assignments: assignments,
  school_classes: [{ id: 'class-1', class_level: 'Form 1', class_stream: 'Blue', campus: 'senior', active: true, capacity: 50 }, { id: 'class-2', class_level: 'Grade 1', class_stream: '', campus: 'junior', active: true, capacity: 50 }],
  fee_balances: learners.map(student => ({ id: `fee-${student.id}`, student_id: student.id, campus: student.campus, term: 'Term 3', academic_year: 2026, total_fees: 160, amount_paid: params.has('owing') ? 25 : 160, balance: params.has('owing') ? 135 : 0, updated_at: today })),
  fee_structure_mapping: [{ class_level: 'Form 1', campus: 'senior', term: 'Term 3', academic_year: 2026, total_fee: 160, amount: 160 }],
  fee_payments: [{ id: 'payment', student_id: 'learner-0', amount: 160, payment_date: today, payment_method: 'cash', receipt_number: 'TEST-RECEIPT' }],
  coursework_assessments: [assessment], coursework_marks: [{ id: 'mark', student_id: 'learner-0', assessment_id: 'assessment', score: 40, assessment, created_at: today }],
  academic_records: [{ id: 'record', student_id: 'learner-0', subject: 'Combined Science', percentage: 72, score: 72, exam_mark: 75, term: '3', year: 2026, comment: 'Consistent progress throughout the term.', created_at: today }],
  attendance: [{ id: 'attendance', student_id: 'learner-0', date: today, status: 'present' }],
  behavior_notes: [{ id: 'behavior', student_id: 'learner-0', severity: 'positive', category: 'Class participation', description: 'Participates actively and supports classmates.', created_at: today }],
  sports_records: [{ id: 'sport', student_id: 'learner-0', activity: 'Athletics', term: '3', achievement: 'Team representative', created_at: today }],
  student_awards: [{ id: 'award', student_id: 'learner-0', award_type: 'best_in_subject', subject: 'Combined Science', created_at: today }],
  term_settings: [{ academic_year: 2026, term: 3, next_term_begins_on: '2027-01-12', junior_next_term_begins_on: '2027-01-12', senior_next_term_begins_on: '2027-01-12' }],
  report_term_fee_settings: [{ academic_year: 2026, term: 3, class_level: 'Form 1', amount: 160 }],
  inventory_products: [{ id: 'product', name: 'School uniform shirt with a longer product description', sku: 'TEST-SHIRT', category: 'Uniforms', selling_price: 15, cost_price: 8, quantity_on_hand: 20, reorder_level: 5, active: true, created_at: today }],
  pos_sales: [], shop_settings: [{ id: true, store_name: 'Reliance Learning Centre', receipt_header: 'School shop', low_stock_alerts_enabled: true }],
  school_expenses: [{ id: 'expense', expense_date: today, category: 'Stationery', description: 'Classroom books and materials for the new school term', supplier: 'Example supplier', amount: 40, status: 'pending', campus: 'senior', created_at: today }],
  announcements: [{ id: 'announcement', title: 'Term update for parents and staff', body: 'A longer school announcement to check wrapping and reading on mobile screens.', content: 'School term update.', audience: 'all', created_at: today }],
  audit_logs: [{ id: 'audit', actor_role: 'admin', description: 'Updated an example learner record', action_type: 'update', created_at: today }],
}
window.fixtureWrites = []
function query(table) {
  let operation = 'select', payload, single = false, start = 0, end = Infinity
  const filters = []
  const builder = {
    select() { return this }, eq(key, value) { filters.push(row => String(row[key]) === String(value)); return this },
    in(key, values) { filters.push(row => values.includes(row[key])); return this }, match(values) { Object.entries(values).forEach(([key, value]) => this.eq(key, value)); return this },
    not() { return this }, neq() { return this }, is() { return this }, ilike() { return this }, or() { return this }, filter() { return this }, gte() { return this }, lte() { return this }, gt() { return this }, lt() { return this }, order() { return this }, limit() { return this },
    range(from, to) { start = from; end = to; return this }, single() { single = true; return this }, maybeSingle() { single = true; return this }, abortSignal() { return this },
    insert(value) { operation = 'insert'; payload = value; return this }, upsert(value) { operation = 'upsert'; payload = value; return this }, update(value) { operation = 'update'; payload = value; return this }, delete() { operation = 'delete'; return this },
    then(resolve, reject) {
      let data = (db[table] || []).filter(row => filters.every(filter => filter(row))).slice(start, end + 1)
      if (operation !== 'select') { window.fixtureWrites.push({ table, operation, payload }); data = [{ id: 'created', ...payload }] }
      return Promise.resolve({ data: single ? data[0] || null : data, error: null, count: data.length }).then(resolve, reject)
    },
  }
  return builder
}
const supabase = {
  from: query,
  rpc(name) {
    if (name === 'coursework_learners') return Promise.resolve({ data: learners, error: null })
    if (name === 'preview_admission_number') return Promise.resolve({ data: 'TEST-2026-004', error: null })
    return query(`rpc:${name}`)
  },
  channel() { return { on() { return this }, subscribe() { return this } } }, removeChannel() {},
  functions: { invoke: async () => ({ data: { success: true }, error: null }) },
  auth: { signOut: async () => ({ error: null }), signInWithPassword: async () => ({ data: { user: { id: staffId } }, error: null }), resetPasswordForEmail: async () => ({ error: null }), updateUser: async () => ({ error: null }) },
}
const paths = { admin: '/portal/staff', principal: '/portal/staff', accountant: '/portal/accountant', teacher: '/portal/teacher', parent: '/portal/dashboard' }
const search = new URLSearchParams()
if (params.has('section')) search.set('section', params.get('section'))
if (role === 'teacher') { search.set('workspace', 'subjects'); search.set('allocation', 'allocation'); search.set('subject', 'Combined Science'); search.set('level', 'Form 1') }
const initialRoute = params.get('route') || `${paths[role]}?${search}`
function RouteObserver() { const route = useLocation(); useEffect(() => { window.fixtureRoute = route.pathname + route.search }, [route]); return null }
export default function PortalFixture() {
  const [activeRole, setActiveRole] = useState(role)
  const value = { user: { id: staffId }, session: { user: { id: staffId } }, profile: { ...profile, active_role: activeRole }, activeRole, roles: params.has('multi') ? [role, role === 'admin' ? 'teacher' : 'admin'] : [role], loading: false, supabase, signOut: async () => {}, refreshProfile: async () => profile, setActiveRole: async role => setActiveRole(role) }
  return <MemoryRouter initialEntries={[initialRoute]}><AuthContext.Provider value={value}><RouteObserver /><App /></AuthContext.Provider></MemoryRouter>
}
createRoot(document.getElementById('root')).render(<PortalFixture />)
