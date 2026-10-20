const number = value => value == null || value === '' ? '' : Number(value)
export function academicSheets(reports) {
  const identity = ['Admission ID','Learner','Historical campus','Historical class','Stream','Year','Term','Context provenance']
  const tables = [
    {name:'Subjects', key:'academics', headers:['Subject','Recorded score','Percentage','Exam mark','Comment','Term mark','Recorded grade'], values:r=>[r.subject,number(r.score),number(r.percentage),number(r.exam_mark),r.comment,number(r.term_mark),r.grade]},
    {name:'Components', key:'componentMarks', headers:['Subject','Component','Score','Possible mark','Comment'], values:r=>[r.subject,r.component,number(r.score),number(r.possible_mark),r.comment]},
    {name:'Development', key:'developmentalRatings', headers:['Development area','Rating','Comment'], values:r=>[r.development_area,r.rating,r.comment]},
    {name:'Report comments', key:'reportComments', headers:['Teacher comment','Head comment','Co-curricular activities'], values:r=>[r.form_teacher_comment,r.principal_comment,r.co_curricular_activities]},
  ]
  const prefix = c => [c.admission_number,c.learner_name,c.campus,c.class_level,c.class_stream,c.academic_year,c.term,c.provenance]
  return [{name:'Report contexts', rows:[identity,...reports.map(report=>prefix(report.context))]},...tables.map(table=>({name:table.name,printColumns:[0,1,...table.headers.map((_,index)=>index+identity.length)],rows:[ [...identity,...table.headers], ...reports.flatMap(report=>(report[table.key]||[]).map(row=>[...prefix(report.context),...table.values(row)])) ]}))]
}
export function attendanceSheet(student, rows, start, end) {
  const selected=rows.filter(row=>row.date>=start&&row.date<=end).sort((a,b)=>a.date.localeCompare(b.date))
  return {name:'Attendance',rows:[['Admission ID','Learner','Date','Status','Late minutes','Note'],...selected.map(row=>[student.admission_number,student.full_name,row.date,row.status,number(row.late_minutes),row.note])]}
}
export function courseworkSheet(students, savedMarks, total) {
  return {name:'Saved coursework',rows:[['Admission ID','Learner','Current class','Stream','Saved score','Possible mark','Status'],...students.map(student=>{
    const mark=savedMarks[student.id], missing=mark==null||mark===''
    return [student.admission_number,student.full_name,student.class_level,student.class_stream,missing?'':number(mark),number(total),missing?'Not recorded':'Saved']
  })]}
}
