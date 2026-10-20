import assert from 'node:assert/strict'
import {test} from 'node:test'
import {academicSheets,attendanceSheet,courseworkSheet} from '../src/lib/academicExport.js'
test('Historical export keeps captured placement, provenance, raw zeros, components and original comments',()=>{
 const report={context:{admission_number:'00012',learner_name:'=Old learner',campus:'junior',class_level:'Grade 1',class_stream:'Blue',academic_year:2025,term:2,provenance:'legacy_inferred'},academics:[{subject:'Math',score:0,exam_mark:null}],componentMarks:[{subject:'English',component:'Reading',score:8,possible_mark:10}],reportComments:[{form_teacher_comment:'Original comment',principal_comment:'Head comment'}]}
 const sheets=academicSheets([report]);assert.equal(sheets[0].rows[1][3],'Grade 1');assert.equal(sheets[0].rows[1][7],'legacy_inferred')
 assert.equal(sheets[1].rows[1][9],0);assert.equal(sheets[1].rows[1][11],'')
 assert.equal(sheets[2].rows[1][10],8);assert.equal(sheets[4].rows[1][8],'Original comment')
 assert.equal(sheets[3].rows.length,1,'Absent results remain absent, never fabricated zero rows')
})
test('Attendance includes only requested dates and never infers unmarked absences',()=>{
 const sheet=attendanceSheet({admission_number:'00001',full_name:'Learner'},[{date:'2026-02-02',status:'late',late_minutes:0},{date:'2026-01-01',status:'absent'},{date:'2026-02-01',status:'present'}],'2026-02-01','2026-02-28')
 assert.equal(sheet.rows.length,3);assert.equal(sheet.rows[1][2],'2026-02-01');assert.equal(sheet.rows[2][4],0)
})
test('Coursework exports saved values only; missing and zero are distinct',()=>{
 const sheet=courseworkSheet([{id:'a',full_name:'A'},{id:'b',full_name:'B'},{id:'c',full_name:'C'}],{a:'0',b:'18.5'},50)
 assert.equal(sheet.rows[1][4],0);assert.equal(sheet.rows[2][4],18.5);assert.equal(sheet.rows[3][4],'');assert.equal(sheet.rows[3][6],'Not recorded')
})
