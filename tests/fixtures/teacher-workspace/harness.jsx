import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthContext } from '../../../src/context/authContext'
import StaffPortalLayout, { useSection } from '../../../src/components/portal/StaffPortalLayout'
import StaffDashboard from '../../../src/pages/portal/StaffDashboard'
import JuniorCourseWork from '../../../src/components/portal/JuniorCourseWork'
import CourseWork from '../../../src/components/portal/CourseWork'
import { getJuniorReportBook } from '../../../src/utils/CurriculumData'
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
const campus = params.get('campus') || 'senior'
const classLevel = params.get('class') || (campus === 'senior' ? 'Form 1' : 'Grade 4')
const junior = getJuniorReportBook(classLevel)
const subject = campus === 'senior' ? 'Combined Science' : junior?.subjects?.[0]?.subject || 'English'
const component = /^Grade [12]$/.test(classLevel) ? null : junior?.subjects?.[0]?.components?.[0] || null
const stream = campus === 'senior' && params.get('stream') !== 'all' ? params.get('stream') || 'Blue' : ''
const allocation = { id: 'allocation', teacher_id: 'teacher', class_level: classLevel, class_stream: stream, subject, campus }
const profile = { role: 'teacher', active_role: 'teacher', full_name: 'Ms Mobile Test', campus, teacher_class_assignments: [allocation], teacher_class_subject_assignments: [allocation] }
const learners = ['Alexandra Example Learner With A Longer Name', 'Brian Example', 'Chipo Example'].map((full_name, i) => ({ id: `learner-${i}`, full_name, class_level: classLevel, class_stream: stream, admission_number: `TEST-2026-00${i+1}`, campus, status: 'active' }))
if (params.has('extraSubjectScopes')) {
  profile.teacher_class_subject_assignments = [allocation,
    { ...allocation, id: 'whole-form', class_stream: '' },
    { ...allocation, id: 'sixth-form', class_level: 'Lower Six', class_stream: '', subject: 'Statistics' }]
  learners.push({ id: 'subject-only', full_name: 'Subject Only Learner', class_level: 'Lower Six', class_stream: 'Arts', campus, status: 'active' },
    { id: 'other-stream', full_name: 'Other Stream Learner', class_level: classLevel, class_stream: 'Green', campus, status: 'active' })
}
if (params.has('noClassAssignment')) profile.teacher_class_assignments = []
if (params.has('extraEcdScopes')) {
 profile.teacher_class_assignments.push({...allocation,id:'ecd-b',class_level:'ECD B'})
 learners.push({id:'ecd-b-learner',full_name:'ECD B Only Learner',class_level:'ECD B',class_stream:'',campus:'junior',status:'active',admission_number:'TEST-ECD-B'})
 learners.push({id:'outside-campus',full_name:'Outside Campus Learner',class_level:'Form 1',class_stream:'Blue',campus:'senior',status:'active',admission_number:'TEST-SENIOR'})
}
const db = {
  grade_bands: ['primary', 'olevel', 'alevel'].map(band_group => ({ band_group, minimum_score: 0, maximum_score: 100, grade: 'Test pass', points: 1, description: 'Synthetic fixture outcome' })),
  reporting_periods: params.has('noCurrentPeriod')?[]:[{campus,is_current:true,state:'open',academic_year:Number(params.get('registryYear')||2026),term:Number(params.get('registryTerm')||3)}],
  students: learners,
  teacher_class_subject_assignments: [allocation],
  coursework_assessments: [{ id: 'assessment', teacher_id: 'teacher', campus, class_level: classLevel, class_stream: stream || null, subject, report_component: component, title: 'Week 4 classroom assessment with a longer descriptive title', assessment_date: '2026-10-15', total_marks: 50, term: '3', academic_year: 2026 }],
  coursework_marks: [{ assessment_id: 'assessment', student_id: 'learner-1', score: 25 }],
  school_classes: [{ ...allocation, active: true }],
}
window.fixtureWrites = []
if(params.has('extraEcdScopes'))db.school_classes.push({...allocation,id:'ecd-b-class',class_level:'ECD B',active:true})
const supabase = {
  functions:{invoke:async(name,options)=>{
   window.fixtureCredentialCalls=[...(window.fixtureCredentialCalls||[]),{name,phone:options.body.phone,passwordProvided:Boolean(options.body.password),selfOnly:!options.body.user_id&&!options.body.target_user_id}]
   if(window.fixtureCredentialFail)return{data:{success:false,error:'Synthetic credential failure'},error:null}
   return{data:{success:true},error:null}
  }},
  from(table) {
    let operation = 'select', payload, single = false
    const filters = []
    const query = {
      select() { return this }, abortSignal() { return this }, eq(key, value) { filters.push([key, value]); return this }, order() { return this }, in() { return this }, limit() { return this }, gte() { return this }, lte() { return this }, or() { return this }, maybeSingle() { single = true; return this }, single() { single = true; return this },
      insert(value) { operation = 'insert'; payload = value; return this }, upsert(value) { operation = 'upsert'; payload = value; return this }, delete() { operation = 'delete'; return this }, match(values) { Object.entries(values).forEach(([key, value]) => filters.push([key, value])); return this },
      then(resolve, reject) {
        if (table === 'students' && operation === 'select' && window.fixtureFailStudentRefresh) {
          window.fixtureFailStudentRefresh = false
          return Promise.resolve({ data: null, error: { message: 'Synthetic roster refresh failure' } }).then(resolve, reject)
        }
        if (table === 'coursework_marks' && operation !== 'select' && window.fixtureHoldMarks) {
          window.fixtureHoldMarks = false
          return new Promise(release => { window.fixtureReleaseMarks = release }).then(() => query.then(resolve, reject))
        }
        if (table === 'coursework_marks' && operation !== 'select' && window.fixtureFailMarks) return Promise.resolve({ data: null, error: { message: 'Synthetic mark save failed. Try again.' } }).then(resolve, reject)
        let data = (db[table] || []).filter(row => filters.every(([key, value]) => row[key] === value))
        if (operation !== 'select') {
          window.fixtureWrites.push({ table, operation, payload })
          if (table === 'students' && params.has('failStudentRefresh')) window.fixtureFailStudentRefresh = true
          if (table === 'coursework_assessments' || table === 'students') { const row = { id: `created-${window.fixtureWrites.length}`, admission_number: 'TEST-ADMISSION', ...payload }; db[table].unshift(row); data = [row] }
          else data = []
        }
        return Promise.resolve({ data: single ? data[0] : data, error: null }).then(resolve, reject)
      },
    }
    return query
  },
  channel() { return { on() { return this }, subscribe() { return this } } },
  removeChannel() {},
  rpc() { return Promise.resolve({ data: learners, error: null }) },
}
const value = { profile, activeRole: 'teacher', user: { id: 'teacher' }, supabase, roles: params.has('multi') ? ['teacher', 'admin'] : ['teacher'], signOut: async () => {}, setActiveRole: async () => {} }
export default function FixturePage() {
  const { section } = useSection()
  return section === 'coursework' ? <div className="staff-content-area">{campus === 'junior' ? <JuniorCourseWork /> : <CourseWork />}</div> : <StaffDashboard />
}
createRoot(document.getElementById('root')).render(<BrowserRouter><AuthContext.Provider value={value}><Routes><Route element={<StaffPortalLayout />}><Route path="*" element={<FixturePage />} /></Route></Routes></AuthContext.Provider></BrowserRouter>)

import '../../../src/portalFoundation.css'
import '../../../src/portalNavigation.css'
import '../../../src/portalAdminMobile.css'

import '../../../src/portalMobileComposition.css'
