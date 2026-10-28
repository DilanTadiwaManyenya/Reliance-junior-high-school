import { getJuniorReportBook, getSubjectsByGradeStream } from '../../../src/utils/CurriculumData'
import { calculateGrade } from '../../../src/utils/GradeCalculator'
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
import '../../../src/parentDashboard.css'
import '../../../src/teacherWorkspace.css'
import '../../../src/portalResponsive.css'
import '../../../src/parentResponsive.css'
import '../../../src/portalFoundation.css'
import '../../../src/portalNavigation.css'
import '../../../src/portalAdminMobile.css'
import '../../../src/reportPrint.css'

const params = new URLSearchParams(location.search)
const role = params.get('role') || 'admin'
const campus = params.get('campus') || (role === 'admin' || role === 'principal' ? 'all' : 'senior')
const staffId = '11111111-1111-4111-8111-111111111111'
const today = new Date().toISOString().slice(0, 10)
const learners = ['Alexandra Example Learner With A Longer Name', 'Brian Example', 'Chipo Example'].map((full_name, index) => ({ id: `learner-${index}`, full_name, campus: index === 1 ? 'junior' : 'senior', class_level: index === 1 ? 'Grade 1' : 'Form 1', class_stream: index === 1 ? '' : 'Blue', admission_number: `TEST-2026-00${index + 1}`, status: 'active', enrolled_year: 2026, date_of_birth: '2013-03-15', guardian_phone: '+263771234567', gender: 'Female' }))
if (params.has('learnerClass')) { learners[0].class_level = params.get('learnerClass'); learners[0].campus = /^(Grade|ECD)/.test(learners[0].class_level) ? 'junior' : 'senior'; learners[0].class_stream = learners[0].campus === 'junior' ? '' : 'Blue' }
if (params.has('inactive')) learners[0].status = 'inactive'
const assignments = [{ id: 'allocation', teacher_id: staffId, class_level: campus === 'junior' ? 'Grade 1' : 'Form 1', class_stream: campus === 'junior' ? '' : 'Blue', subject: 'Combined Science', campus }]
const profile = { id: staffId, full_name: 'Ms Example Account With A Longer Display Name', legal_full_name: 'Example Account', working_title: 'Ms', phone: '+263771234567', role, active_role: role, campus, portal_access_enabled: true, must_change_password: params.has('mustChange'), teacher_class_assignments: assignments, teacher_class_subject_assignments: assignments }
const assessment = { id: 'assessment', teacher_id: staffId, campus: 'senior', class_level: 'Form 1', class_stream: 'Blue', subject: 'Combined Science', title: 'Week 4 assessment with a longer descriptive title', assessment_type: 'weekly', total_marks: 50, assessment_date: today, term: '3', academic_year: 2026 }
const db = {
  portal_security_settings: [{id:1,require_admin_mfa:!params.has('mfaDisabled')}],
  students: learners,
  profiles: [profile, { ...profile, id: 'teacher', role: 'teacher', active_role: 'teacher', campus: 'senior', full_name: 'Ms Example Teacher', is_protected: false }, ...(params.has('deactivatedStaff') ? [{ ...profile, id: 'deactivated-teacher', role: 'teacher', active_role: 'teacher', campus: 'senior', full_name: 'Deactivated Example Teacher', portal_access_enabled: false, is_protected: false }] : [])],
  parent_student: params.has('empty') ? [] : learners.map(student => ({ parent_id: staffId, student_id: student.id, verified_at: today, student })),
  teacher_class_assignments: assignments, teacher_class_subject_assignments: assignments,
  school_classes: [{ id: 'class-1', class_level: 'Form 1', class_stream: 'Blue', campus: 'senior', active: true, capacity: 50 }, { id: 'class-2', class_level: 'Grade 1', class_stream: '', campus: 'junior', active: true, capacity: 50 }],
  fee_balances: learners.map(student => ({ id: `fee-${student.id}`, student_id: student.id, campus: student.campus, currency:'USD',term: 'Term 3', academic_year: 2026, total_fees: 160, amount_paid: params.has('owing') ? 25 : 160, balance: params.has('owing') ? 135 : 0, updated_at: today })),
  fee_structure_mapping: [{ band_id: 'senior', band_name: 'Senior school', class_level: 'Form 1', campus: 'senior', term: 'Term 3', academic_year: 2026, total_fee: 160, amount: 160 }],
  fee_payments: [{ id: 'payment', fee_balance_id:'fee-learner-0',student_id: 'learner-0', amount: 160, currency:'USD',paid_on:today,term:'Term 3',academic_year:2026,status:'recorded',payment_date: today, payment_method: 'cash', receipt_number: 'TEST-RECEIPT' }],
  coursework_assessments: [assessment], coursework_marks: [{ id: 'mark', student_id: 'learner-0', assessment_id: 'assessment', score: 40, assessment, created_at: today }],
  academic_records: [{ id: 'record', student_id: 'learner-0', subject: 'Combined Science', percentage: 72, score: 72, exam_mark: 75, term: '3', year: 2026, comment: 'Consistent progress throughout the term.', created_at: today }],
  attendance: [{ id: 'attendance', student_id: 'learner-0', date: today, status: 'present' }],
  behavior_notes: [{ id: 'behavior', student_id: 'learner-0', severity: 'positive', category: 'Class participation', description: 'Participates actively and supports classmates.', created_at: today }],
  sports_records: [{ id: 'sport', student_id: 'learner-0', activity: 'Athletics', term: '3', achievement: 'Team representative', created_at: today }],
  student_awards: [{ id: 'award', student_id: 'learner-0', award_type: 'best_in_subject', subject: 'Combined Science', created_at: today }],
  term_settings: [{ academic_year: 2026, term: 3, next_term_begins_on: '2027-01-12', junior_next_term_begins_on: '2027-01-12', senior_next_term_begins_on: '2027-01-12' }],
  report_term_fee_settings: [{ academic_year: 2026, term: 3, class_level: 'Form 1', amount: 160 }],
  inventory_products: [{ id: 'product', name: 'School uniform shirt with a longer product description', sku: 'TEST-SHIRT', category: 'Uniforms', campus: 'senior', selling_price: 15, cost_price: 8, quantity_on_hand: 20, reorder_level: 5, active: true, created_at: today }],
  pos_sales: [{ id: 'sale', campus: 'senior', receipt_number: 'TEST-RECEIPT-001', created_at: today, payment_method: 'cash', customer_name: learners[0].full_name, total: 15, amount_paid: 20, pos_sale_items: [{ id: 'sale-line', product_id: 'product', product_name: 'School uniform shirt with a longer description', quantity: 1, unit_price: 15, unit_cost: 8, line_total: 15 }] }], shop_settings: [{ id: true, store_name: 'Reliance Learning Centre', receipt_header: 'School shop', low_stock_alerts_enabled: true }],
  school_expenses: [{ id: 'expense', expense_date: today, category: 'Stationery', description: 'Classroom books and materials for the new school term', supplier: 'Example supplier', amount: 40, status: 'pending', campus: 'senior', created_at: today }],
  announcements: [{ id: 'announcement', title: 'Term update for parents and staff', body: 'A longer school announcement to check wrapping and reading on mobile screens.', content: 'School term update.', audience: 'all', created_at: today }],
  audit_logs: [{ id: 'audit', actor_role: 'admin', description: 'Updated an example learner record', action_type: 'update', created_at: today }],
  financial_events: Array.from({ length: 51 }, (_, index) => ({ id: `financial-${index}`, module: 'pos', action: index % 2 ? 'sale_recorded' : 'sale_reversed', record_id: `sale-${index}`, campus: 'senior', currency: 'USD', actor_name: 'Example Main Admin', actor_role: 'admin', created_at: today, reason: index % 2 ? null : 'Incorrect test entry', details: { stock_changes: [{ size: 'M', before: 4, after: 5 }] } })),
  school_record_changes: Array.from({ length: 51 }, (_, index) => ({ id: `change-${index}`, created_at: new Date(Date.now() - index * 60000).toISOString(), source_table: index % 3 === 0 ? 'academic_records' : index % 3 === 1 ? 'students' : 'attendance', operation: 'UPDATE', actor_name: 'Example Teacher With A Longer Display Name', actor_role: 'teacher', learner_name: index === 50 ? 'Brian Example' : 'Alexandra Example Learner With A Longer Name', campus: campus === 'all' ? 'senior' : campus, context: { subject: 'Combined Science', term: '3', year: 2026 }, old_values: { score: 60 }, new_values: { score: 75 }, changed_fields: ['score'] })),
}
if (params.has('multiClassAllocations')) db.school_classes.push({ id: 'class-3', class_level: 'Form 2', class_stream: 'Blue', campus: 'senior', active: true, capacity: 50 }, { id: 'class-4', class_level: 'Form 2', class_stream: 'Green', campus: 'senior', active: true, capacity: 50 })
if (params.has('printFixture')) {
  const base = { student_id: 'learner-0', term: '3', year: 2026, created_at: today }
  const blueprint = getJuniorReportBook(learners[0].class_level)
  const comment = 'Consistent progress, thoughtful participation and careful preparation. Continue regular practice to strengthen confidence and accuracy.'
  db.academic_records = getSubjectsByGradeStream(learners[0].class_level, /Six/.test(learners[0].class_level) ? 'Arts' : 'Blue').map((subject, index) => ({ ...base, id: `academic-${index}`, subject, percentage: 72, exam_mark: 75, comment }))
  db.junior_component_marks = (blueprint?.subjects || []).flatMap(subject => subject.components.map(component => ({ ...base, subject: subject.subject, component, score: 8, possible_mark: 10, comment: 'Good progress; continue regular reading and practice.' })))
  db.junior_developmental_ratings = (blueprint?.areas || []).map(development_area => ({ ...base, development_area, rating: 4 }))
  db.report_card_comments = [{ ...base, form_teacher_comment: comment.repeat(2), principal_comment: comment.repeat(2), head_signature_initials: 'E.A.', co_curricular_activities: 'Athletics, music, chess and school leadership activities.' }]
}
// Synthetic frozen context payloads; actual RLS and capture functions are tested in PostgreSQL.
function frozenRules(level,stream) {
 const scale=[]
 for(let mark=100;mark>=0;mark--){const grade=calculateGrade(mark,level);if(scale.at(-1)?.grade===grade.grade)scale.at(-1).minimum=mark;else scale.push({...grade,minimum:mark})}
 return {subjects:getSubjectsByGradeStream(level,stream),junior_book:getJuniorReportBook(level),grading_scale:scale}
}
function contextFor(student,year=2026,term=3,level=student.class_level,stream=student.class_stream,side=student.campus) {
 return {id:`context-${student.id}-${year}-${term}`,student_id:student.id,academic_year:year,term,campus:side,class_level:level,class_stream:stream,learner_name:student.full_name,admission_number:student.admission_number,enrolled_year:student.enrolled_year,active_when_captured:true,
  report_rules:frozenRules(level,stream),class_teacher:{teacher_name:'Recorded class teacher',signature_initials:'R.C.',assigned_at:'2026-01-01'},subject_teachers:getSubjectsByGradeStream(level,stream).map(subject=>({subject,teacher_name:'Recorded subject teacher',signature_initials:'R.S.'})),provenance:'captured',staffing_verified_at:today,captured_at:today}
}
db.report_period_contexts=learners.map(student=>contextFor(student))
db.year_rollover_batches=[]
db.reporting_periods=['junior','senior'].map(c=>({id:`period-${c}`,campus:c,academic_year:2026,term:3,state:'open',is_current:true,revision:1}))
db.reporting_period_events=[]
if(params.has('historyPromotion')){
 const student=learners[0],junior=params.get('historyPromotion')==='junior-senior'
 student.class_level=junior?'Form 1':'Lower Six';student.campus='senior';student.class_stream=junior?'Blue':'Sciences'
 const old=contextFor(student,2026,3,junior?'Grade 1':'Form 4','Blue',junior?'junior':'senior')
 old.provenance='legacy_inferred';old.staffing_verified_at=null
 const current=contextFor(student,2027,1)
 current.subject_teachers=current.subject_teachers.map(row=>({...row,teacher_name:'New year teacher'}))
 db.report_period_contexts=[current,old,...db.report_period_contexts.filter(row=>row.student_id!==student.id)]
 db.academic_records=[{id:'new-math',student_id:student.id,subject:'Mathematics',score:75,term:'1',year:2027,created_at:today},...(!junior?[{id:'old-math',student_id:student.id,subject:'Mathematics',score:75,term:'3',year:2026,created_at:today}]:[])]
 db.junior_component_marks=junior?getJuniorReportBook('Grade 1').subjects.flatMap(subject=>subject.components.map(component=>({id:subject.subject+component,student_id:student.id,subject:subject.subject,component,score:8,possible_mark:10,year:2026,term:'3'}))):[]
}
if(params.has('operationsData')) {
 db.inventory_products[0].name='Renamed current shirt';
 db.inventory_products[0].product_variants=[{id:'variant-s',size:'S',sku:'0007',quantity_on_hand:2,active:true},{id:'variant-m',size:'M',sku:'0008',quantity_on_hand:3,active:false}];
 db.parent_uniform_orders=[{id:'order-1',student_id:'learner-0',created_at:today,payment_status:'pending',payment_method:'cash',total:10,items:[{product_id:'product',name:'Original tie',size_label:'M',quantity:2,unit_price:5}]}];
}
if(params.has('expenseControls')) {db.school_expenses[0].status='approved';db.school_expenses[0].currency='USD'}
if(params.has('operationsLarge')) db.school_expenses=Array.from({length:1007},(_,i)=>({...db.school_expenses[0],id:'expense-'+String(i).padStart(5,'0'),supplier:i===0?' =SUM(1,2)':'Supplier',receipt_reference:'0000123',amount:1.25}));
if(params.has('academicLarge')) db.academic_records=Array.from({length:1007},(_,i)=>({id:'mark-'+i,student_id:'learner-0',year:2026,term:'3',subject:'Subject '+String(i).padStart(4,'0'),score:i===0?0:75,percentage:null,exam_mark:i===0?0:75,comment:i===0?' =SUM(1,2)':'Saved comment'}));
if(params.has('academicTeacher')) db.academic_records=[{id:'own-mark',student_id:'learner-0',year:2026,term:'3',subject:'Combined Science',score:0,term_mark:0,exam_mark:null,grade:'U'}, {id:'other-subject',student_id:'learner-0',year:2026,term:'3',subject:'Mathematics',score:90},{id:'other-campus',student_id:'learner-1',year:2026,term:'3',subject:'Combined Science',score:99}];
if(params.has('academicTeacher')) db.grade_bands=['primary','olevel','alevel'].map(band_group=>({band_group,minimum_score:0,maximum_score:100,grade:'A',points:5,description:'Fixture grade'}));
if(params.has('legacyAcademicTerm')) { const row=db.academic_records.find(item=>item.student_id==='learner-0'&&item.subject==='Combined Science'); if(row)row.term='Term 3' }
window.fixtureActiveRole = role; window.fixtureWrites = []; window.fixtureFunctionCalls = []
window.fixtureRegisterError=params.has('registerError')
window.fixtureRegisterRequests=[]
window.fixtureReportError = params.has('reportError')
window.fixtureReportCalls = []
window.fixtureReviewCalls = []
window.fixtureHistoryError = params.has('historyError')
window.fixtureRolloverError = params.has('rolloverError')
window.fixtureRolloverCalls = []
function query(table) {
  let operation = 'select', payload, single = false, start = 0, end = Infinity, projection = ''
  const filters = []
  const builder = {
    select(value = '') { projection = value; return this }, eq(key, value) { filters.push(row => String(key.split('.').reduce((item,part) => item?.[part],row)) === String(value)); return this },
    in(key, values) { filters.push(row => values.includes(row[key])); return this }, match(values) { Object.entries(values).forEach(([key, value]) => this.eq(key, value)); return this },
    not() { return this }, neq() { return this }, is() { return this }, ilike(key,value) { if(['school_record_changes','report_period_contexts'].includes(table)) {const needle=value.slice(1,-1).replace(/\\([\\%_])/g,'$1').toLowerCase();filters.push(row=>String(row[key]||'').toLowerCase().includes(needle))} return this }, or() { return this }, filter() { return this }, gte(key,value) { if(table==='school_record_changes')filters.push(row=>Date.parse(row[key])>=Date.parse(value));return this }, lte(key,value) { if(table==='school_record_changes')filters.push(row=>Date.parse(row[key])<=Date.parse(value));return this }, gt() { return this }, lt() { return this }, order() { return this }, limit() { return this },
    range(from, to) { start = from; end = to; return this }, single() { single = true; return this }, maybeSingle() { single = true; return this }, abortSignal() { return this },
    insert(value) { operation = 'insert'; payload = value; return this }, upsert(value) { operation = 'upsert'; payload = value; return this }, update(value) { operation = 'update'; payload = value; return this }, delete() { operation = 'delete'; return this },
    then(resolve, reject) {
      let data = (db[table] || []).map(row => projection.includes('students!inner') ? {...row,students:db.students.find(s => s.id===row.student_id)} : row).filter(row => filters.every(filter => filter(row)))
      if(params.has('operationsError') && window.fixtureOperationsError !== false && ['school_expenses','fee_payments'].includes(table)) return Promise.resolve({data:null,error:{message:'Synthetic export connection failure'}}).then(resolve,reject)
      if(table==='portal_security_settings'&&params.has('mfaSettingsError'))return Promise.resolve({data:null,error:{message:'Synthetic requirements unavailable'}}).then(resolve,reject)
      if(table==='report_period_contexts') { const currentRole=window.fixtureActiveRole||role; data=data.filter(row=>currentRole==='parent'?db.parent_student.some(link=>link.parent_id===staffId&&link.student_id===row.student_id&&link.verified_at):['admin','principal','accountant'].includes(currentRole)&&(campus==='all'&&currentRole!=='accountant'||row.campus===campus)) }
      if(table==='school_expenses'&&params.has('expenseControls')&&role==='accountant')data=data.filter(row=>row.campus===campus)
      data=data.slice(start,end+1)
      if(table==='school_record_changes' && window.fixtureHistoryError) return Promise.resolve({data:null,error:{message:'Synthetic connection failure'}}).then(resolve,reject)
      if(table==='financial_events' && window.fixtureFinancialError) return Promise.resolve({data:null,error:{message:'Synthetic connection failure'}}).then(resolve,reject)
      if (table === 'academic_records' && window.fixtureParentError) return Promise.resolve({ data: null, error: { message: 'Synthetic learner records unavailable' } }).then(resolve, reject)
      if (table === 'academic_records' && params.has('delayParent') && data.some(row => row.student_id === 'learner-0')) return new Promise(done => { window.fixtureResolveParent = () => done({ data, error: null }) }).then(resolve, reject)
      if (operation !== 'select') {
        window.fixtureWrites.push({ table, operation, payload })
        if (table === 'academic_records') {
          const existing = operation === 'update'
            ? (db[table] || []).find(row => filters.every(filter => filter(row)))
            : operation === 'upsert'
              ? (db[table] || []).find(row => row.student_id === payload.student_id && row.subject === payload.subject && row.term === payload.term && Number(row.year) === Number(payload.year))
              : null
          if (existing) Object.assign(existing, payload)
          else { const created = { id: `created-${window.fixtureWrites.length}`, created_at: today, ...payload }; db[table].push(created); data = [created] }
          if (existing) data = [existing]
        } else if (table === 'students') {
          const matching = (db.students || []).filter(row => filters.every(filter => filter(row)))
          if (operation === 'delete') {
            for (const row of matching) db.students.splice(db.students.indexOf(row), 1)
            data = matching
          } else if (operation === 'update') {
            matching.forEach(row => Object.assign(row, payload))
            data = matching
          } else data = [{ id: 'created', ...payload }]
        } else data = [{ id: 'created', ...payload }]
      }
      return Promise.resolve({ data: single ? data[0] || null : data, error: null, count: data.length }).then(resolve, reject)
    },
  }
  return builder
}
let fixtureAal = params.has('mfa') ? 'aal1' : 'aal2'
let fixtureChecks = 0
let fixturePendingFactor = params.has('mfaResume') ? {id:'pending-factor',status:'unverified',factor_type:'totp',friendly_name:'Reliance admin 1790000000000',created_at:'2026-10-19T10:00:00Z'} : null
const fixtureMfa = {
 getAuthenticatorAssuranceLevel: async () => { fixtureChecks++; if(params.get('mfa')==='error' && fixtureChecks===1) return {error:new Error('Fixture connection failed')}; return {data:{currentLevel:fixtureAal},error:null} },
 listFactors: async () => { const factors=params.get('mfa')==='verify' ? [{id:'verified-factor',status:'verified',factor_type:'totp',friendly_name:'Example authenticator'}] : [];if(fixturePendingFactor)factors.push(fixturePendingFactor);return {data:{all:factors,totp:factors},error:null} },
 enroll: async () => { window.fixtureMfaEnrolls=(window.fixtureMfaEnrolls||0)+1; return {data:{id:'pending-factor',totp:{uri:'otpauth://totp/Reliance:fixture?secret=SYNTHETICSETUPKEY&issuer=Reliance',qr_code:'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"/%3E',secret:'SYNTHETICSETUPKEY'}},error:null} },
 unenroll: async () => {window.fixtureMfaRemovals=(window.fixtureMfaRemovals||0)+1;fixturePendingFactor=null;return {error:null}},
 challengeAndVerify: async ({code,factorId}) => {window.fixtureVerifiedFactor=factorId;if(code!=='123456')return {error:new Error('Code not accepted. Try the current code.')};fixtureAal=params.has('noUpgrade')?'aal1':'aal2';return {data:{},error:null} },
}
const supabase = {
  from: query,
  rpc(name, payload) {
    if(name==='export_learner_register'){
      window.fixtureRegisterRequests.push(payload)
      const source=params.has('registerLarge')?Array.from({length:1007},(_,n)=>({...learners[0],id:`export-${n}`,full_name:n===0?' \t=HYPERLINK("bad")':`Register Learner ${String(n).padStart(4,'0')}`,admission_number:String(n).padStart(8,'0'),campus:'senior',class_level:'Form 1',class_stream:'Blue',sex:'Female',date_of_birth:'2013-03-15',parent_name:'Guardian, Example',parent_phone:'+263770000001',address:'House "A"\nHarare',birth_cert_no:'001-002',status:n===1?'inactive':'active'})):learners
      const rows=source.filter(s=>(!payload.p_campus||s.campus===payload.p_campus)&&(!['class','stream'].includes(payload.p_scope)||s.class_level===payload.p_level)&&(payload.p_scope!=='stream'||s.class_stream===payload.p_stream))
      const result=window.fixtureRegisterError?{data:null,error:{message:'Synthetic register request unavailable'}}:{data:{scope:payload.p_scope,campus:payload.p_campus,level:payload.p_level,stream:payload.p_stream,generated_at:'2026-10-20T10:00:00Z',count:rows.length,learners:rows},error:null}
      return {abortSignal(){return this},then(resolve,reject){return (params.has('registerDelayed')?new Promise(done=>{window.fixtureResolveRegister=()=>done(result)}):Promise.resolve(result)).then(resolve,reject)}}
    }
    if(name==='change_reporting_period'){
      window.fixtureWrites.push({table:`rpc:${name}`,payload})
      let row=db.reporting_periods.find(r=>r.campus===payload.p_campus&&r.academic_year===payload.p_year&&r.term===payload.p_term)
      if(!row){row={id:crypto.randomUUID(),campus:payload.p_campus,academic_year:payload.p_year,term:payload.p_term,state:'open',is_current:false,revision:1};db.reporting_periods.push(row)}else{row.revision++;if(payload.p_action==='close'){row.state='closed';row.is_current=false}else if(payload.p_action==='reopen')row.state='open';else if(payload.p_action==='set_current'){db.reporting_periods.filter(r=>r.campus===row.campus).forEach(r=>{r.is_current=false});row.is_current=true}}
      db.reporting_period_events.unshift({id:crypto.randomUUID(),campus:row.campus,created_at:today,actor_name:profile.full_name,action:payload.p_action,reason:payload.p_reason})
      return Promise.resolve({data:{...row},error:null})
    }
    if(name==='review_year_rollover'){
      const data={campus:payload.p_campus,total:learners.filter(s=>s.campus===payload.p_campus).length,rows:learners.filter(s=>s.campus===payload.p_campus).map(s=>({...s,source_year:2026,target_year:2027,expected_version:'fixture-version',history_reviewed:params.has('rolloverReviewed'),eligible_year:true,suggested_level:s.campus==='junior'?'Grade 2':'Form 2'})),classes:[...db.school_classes,...['junior','senior'].map(c=>({id:`next-${c}`,campus:c,class_level:c==='junior'?'Grade 2':'Form 2',class_stream:c==='junior'?'':'Blue',capacity:50,current_occupancy:0}))].filter(c=>campus==='all'||c.campus===campus)}
      return {abortSignal(){return this},then(resolve,reject){return Promise.resolve({data,error:null}).then(resolve,reject)}}
    }
    if(name==='apply_year_rollover'){
      window.fixtureWrites.push({table:`rpc:${name}`,payload})
      if(!payload.p_preview){
        if(params.has('rolloverLostResponse')&&!window.fixtureLostRollover){window.fixtureLostRollover=true;return Promise.resolve({data:null,error:{message:'Network request failed'}})}
        db.year_rollover_batches.push({id:payload.p_batch_id,created_at:today,reason:payload.p_reason,state:'applied',campus:payload.p_campus})
      }
      return Promise.resolve({data:{batch_id:payload.p_batch_id,count:payload.p_decisions.length,applied:!payload.p_preview,capacity:[{class_id:'next-junior',campus:payload.p_campus,class_level:payload.p_campus==='junior'?'Grade 2':'Form 2',projected_occupancy:1,capacity:50}]},error:null})
    }
    if(name==='reverse_year_rollover'){
      window.fixtureWrites.push({table:`rpc:${name}`,payload});const batch=db.year_rollover_batches.find(b=>b.id===payload.p_batch_id);if(batch){batch.state='reversed';batch.reversal_reason=payload.p_reason}return Promise.resolve({data:1,error:null})
    }
    if(name==='read_report_period') {
      window.fixtureReportCalls.push(payload)
      const c=db.report_period_contexts.find(row=>row.student_id===payload.p_student&&row.academic_year===payload.p_year&&row.term===payload.p_term)
      const currentRole=window.fixtureActiveRole||role
      const permitted=c&&(currentRole==='parent'?db.parent_student.some(link=>link.student_id===c.student_id&&link.verified_at):['admin','principal','accountant'].includes(currentRole)&&(campus==='all'&&currentRole!=='accountant'||campus===c.campus))
      const match=row=>row.student_id===payload.p_student&&Number(row.year||row.academic_year||new Date(row.created_at||Date.now()).getFullYear())===payload.p_year&&String(row.term).replace('Term ','')===String(payload.p_term)
      const result=window.fixtureReportError||!permitted?{data:null,error:{message:'Synthetic unavailable historical report'}}:{data:{context:c,academics:db.academic_records.filter(match),componentMarks:(db.junior_component_marks||[]).filter(match),developmentalRatings:(db.junior_developmental_ratings||[]).filter(match),reportComments:(db.report_card_comments||[]).filter(match),attendance:db.attendance.filter(row=>row.student_id===payload.p_student),sports:db.sports_records.filter(match),awards:db.student_awards.filter(match),fees:db.fee_balances.filter(row=>row.student_id===payload.p_student),termSettings:db.term_settings,reportFees:db.report_term_fee_settings},error:null}
      return {abortSignal(){return this},then(resolve,reject){return Promise.resolve(result).then(resolve,reject)}}
    }
    if(name==='review_report_contexts') {
      window.fixtureReviewCalls.push(payload)
      for(const row of db.report_period_contexts.filter(row=>payload.p_ids.includes(row.id))){row.confirmed_at=new Date().toISOString();if(payload.p_refresh_staffing)row.staffing_verified_at=new Date().toISOString()}
      return Promise.resolve({data:payload.p_ids.length,error:null})
    }
    if (name === 'preview_year_rollover') {
      window.fixtureRolloverCalls.push(payload)
      const sourceCampus=payload.p_campus
      const data=Array.from({length:sourceCampus==='junior'?52:3},(_,index)=>({
        id:`${sourceCampus}-planning-${index}`,full_name:sourceCampus==='senior'?`Senior Example Learner ${index}`:index===51?'Brian Example':'Alexandra Example Learner With A Longer Name',
        admission_number:`TEST-${sourceCampus}-${index}`,campus:sourceCampus,source_level:sourceCampus==='junior'?'Grade 1':'Form 1',source_stream:'Blue',target_level:sourceCampus==='junior'?'Grade 2':'Form 2',target_campus:sourceCampus,
        candidates:[{id:`${sourceCampus}-destination`,class_level:sourceCampus==='junior'?'Grade 2':'Form 2',class_stream:'Blue',campus:sourceCampus,capacity:50}],review_status:index%2?'stream_review':'standard_review',
      })).filter(row=>`${row.full_name} ${row.admission_number}`.toLowerCase().includes(payload.p_search.toLowerCase()))
      const standard=data.filter(row=>row.review_status==='standard_review').length
      const result=window.fixtureRolloverError?{data:null,error:{message:'Synthetic unavailable preview'}}:{data:{source_year:2026,target_year:2027,campus:sourceCampus,total:data.length,standard_count:standard,review_count:data.length-standard,missing_target_count:0,rows:data.slice(payload.p_offset,payload.p_offset+payload.p_limit)},error:null}
      return {abortSignal(){return this},then(resolve,reject){return Promise.resolve(result).then(resolve,reject)}}
    }
    if(params.has('expenseControls')&&['submit_school_expense','review_school_expense','reverse_school_expense'].includes(name)) {
      window.fixtureWrites.push({table:'rpc:'+name,operation:'rpc',payload})
      if(name==='submit_school_expense') {
        const key='fixture-expense-server:'+payload.p_request_id
        let saved=JSON.parse(localStorage.getItem(key)||'null')
        const fresh=!saved
        if(!saved){saved={...payload.p_expense,id:crypto.randomUUID(),status:'pending',entered_by:staffId,created_at:new Date().toISOString()};localStorage.setItem(key,JSON.stringify(saved))}
        if(!db.school_expenses.some(row=>row.id===saved.id))db.school_expenses.push(saved)
        if(fresh&&params.has('expenseLoss'))return Promise.reject(new Error('Synthetic response lost after expense committed'))
        return Promise.resolve({data:saved,error:null})
      }
      const expense=db.school_expenses.find(row=>row.id===payload.p_expense_id)
      if(name==='review_school_expense'){expense.status=payload.p_status;return Promise.resolve({data:null,error:null})}
      if(!window.fixtureExpenseReversalSucceeds)return Promise.resolve({data:null,error:{message:'Synthetic expense reversal failed safely'}})
      Object.assign(expense,{status:'reversed',reversal_reason:payload.p_reason,reversed_at:new Date().toISOString()})
      return Promise.resolve({data:expense,error:null})
    }
    if (params.has('feeReversal') && name === 'reverse_learner_fee_payment') {
      window.fixtureWrites.push({table:`rpc:${name}`,operation:'rpc',payload})
      if (!window.fixtureReversalCanSucceed) return Promise.resolve({data:null,error:{message:'Synthetic reversal failed safely'}})
      const payment=db.fee_payments.find(row=>row.id===payload.p_payment_id)
      if (payment.status!=='reversed') {
        payment.status='reversed';payment.reversal_reason=payload.p_reason;payment.reversed_at=new Date().toISOString()
        db.fee_balances.find(row=>row.id===payment.fee_balance_id).amount_paid-=payment.amount
      }
      return Promise.resolve({data:payment,error:null})
    }
    if (params.has('feeRetry') && name === 'record_learner_fee_payment') {
      window.fixtureWrites.push({ table: `rpc:${name}`, operation: 'rpc', payload })
      const key=`fixture-fee-server:${payload.p_request_id}`
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key,JSON.stringify(payload))
        return Promise.reject(new Error('Synthetic response lost after payment committed'))
      }
      return Promise.resolve({data:null,error:null})
    }
    if (params.has('delayPayment') && name === 'record_learner_fee_payment') {
      window.fixtureWrites.push({ table: `rpc:${name}`, operation: 'rpc', payload })
      return new Promise(resolve => { window.fixtureResolvePayment = () => resolve({ data: null, error: null }) })
    }
    if (name === 'parent_shop_student_campus') {
      const link = db.parent_student.find(row => row.student_id === payload.requested_student_id && row.verified_at)
      return Promise.resolve({ data: link?.student?.status === 'active' ? link.student.campus : null, error: null })
    }
    if (name === 'correct_assigned_learner' || name === 'manage_disabled_learner') {
      window.fixtureWrites.push({ table: `rpc:${name}`, operation: 'rpc', payload })
      const learner = db.students.find(row => row.id === payload.p_student)
      if (!learner) return Promise.resolve({ data: null, error: { message: 'Synthetic learner not found' } })
      if (name === 'manage_disabled_learner' && payload.p_action === 'delete' && (role !== 'admin' || (campus !== 'all' && learner.campus !== campus))) return Promise.resolve({ data: null, error: { message: 'Campus administrator access is required to delete this learner' } })
      if (name === 'correct_assigned_learner') {
        if (payload.p_details?.disable_reason) {
          learner.status = 'inactive'
          learner.record_disable_reason = payload.p_details.disable_reason
        }
      } else if (payload.p_action === 'activate') {
        learner.status = 'active'
        learner.record_disable_reason = null
      } else if (payload.p_action === 'delete') {
        db.students.splice(db.students.indexOf(learner), 1)
      }
      return Promise.resolve({ data: learner, error: null })
    }
    if (name === 'coursework_learners') return Promise.resolve({ data: learners, error: null })
    if (name === 'preview_admission_number') return Promise.resolve({ data: 'TEST-2026-004', error: null })
    return query(`rpc:${name}`)
  },
  channel() { return { on() { return this }, subscribe() { return this } } }, removeChannel() {},
  functions: { invoke: async (name, options = {}) => {
    const body = options.body || {}
    window.fixtureFunctionCalls.push({ name, body })
    if (name === 'manage-staff-account' && body.action === 'update') {
      const row = db.profiles.find(profile => profile.id === body.user_id)
      if (row) {
        Object.assign(row, { full_name: body.full_name, legal_full_name: body.legal_full_name, working_title: body.working_title, campus: body.campus })
        row.teacher_class_assignments = body.class_assignments || []
        row.teacher_class_subject_assignments = (body.class_subject_assignments || []).map((assignment, index) => ({ ...assignment, id: `fixture-subject-${index}`, teacher_id: row.id, campus: body.campus }))
      }
    }
    return { data: { success: true }, error: null }
  } },
  auth: { mfa: fixtureMfa, signOut: async () => ({ error: null }), signInWithPassword: async () => ({ data: { user: { id: staffId } }, error: null }), resetPasswordForEmail: async () => ({ error: null }), updateUser: async () => ({ error: null }) },
}
const paths = { admin: '/portal/staff', principal: '/portal/staff', accountant: '/portal/accountant', teacher: '/portal/teacher', parent: '/portal/dashboard' }
const search = new URLSearchParams()
if (params.has('section')) search.set('section', params.get('section'))
if (role === 'teacher') { search.set('workspace', 'subjects'); search.set('allocation', 'allocation'); search.set('subject', 'Combined Science'); search.set('level', 'Form 1') }
const initialRoute = params.get('route') || `${paths[role]}?${search}`
function RouteObserver() { const route = useLocation(); useEffect(() => { window.fixtureRoute = route.pathname + route.search }, [route]); return null }
export default function PortalFixture() {
  const [activeRole, setActiveRole] = useState(role)
  const value = { user: { id: staffId }, session: { user: { id: staffId } }, profile: { ...profile, active_role: activeRole }, activeRole, roles: params.has('multi') ? [role, role === 'admin' ? 'teacher' : 'admin'] : [role], loading: false, supabase, signOut: async () => {}, refreshProfile: async () => profile, setActiveRole: async role => { if (params.has('roleError')) throw new Error('Fixture role switch failed'); window.fixtureActiveRole=role; setActiveRole(role) } }
  return <MemoryRouter initialEntries={[initialRoute]}><AuthContext.Provider value={value}><RouteObserver /><App /></AuthContext.Provider></MemoryRouter>
}
createRoot(document.getElementById('root')).render(<PortalFixture />)
