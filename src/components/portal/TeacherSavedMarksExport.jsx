import { useEffect, useRef, useState } from 'react'
import { readAllRows } from '../../lib/operationsExport'
import AcademicDownloads from './AcademicDownloads'

export default function TeacherSavedMarksExport({supabase,students,year,term,subject,junior=false}) {
  const [sheets,setSheets]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const request=useRef(null)
  useEffect(()=>()=>request.current?.abort(),[])
  const prepare=async()=>{
    const controller=new AbortController();request.current=controller
    const timer=setTimeout(()=>controller.abort(),30000)
    setBusy(true);setError('');setSheets(null)
    try{
      if(students.length>1000)throw new Error('Choose a smaller assigned class before exporting.')
      const specs=junior?[
        ['Components','junior_component_marks',['Subject','Component','Score','Possible mark','Comment'],r=>[r.subject,r.component,r.score==null?'':Number(r.score),r.possible_mark==null?'':Number(r.possible_mark),r.comment]],
        ['Development','junior_developmental_ratings',['Area','Rating','Comment'],r=>[r.development_area,r.rating==null?'':Number(r.rating),r.comment]],
      ]:[['Subjects','academic_records',['Subject','Score','Percentage','Exam mark','Comment','Term mark','Recorded grade'],r=>[r.subject,r.score==null?'':Number(r.score),r.percentage==null?'':Number(r.percentage),r.exam_mark==null?'':Number(r.exam_mark),r.comment,r.term_mark==null?'':Number(r.term_mark),r.grade]]]
      const output=[]
      for(const[name,table,headers,values]of specs){
        const rows=[]
        for(let offset=0;offset<students.length;offset+=100){
          const ids=students.slice(offset,offset+100).map(s=>s.id)
          rows.push(...await readAllRows(()=>{
            let query=supabase.from(table).select('*').in('student_id',ids).eq('year',Number(year)).eq('term',String(term))
            if(!junior)query=query.eq('subject',subject)
            return query
          },{signal:controller.signal,limit:10000}))
        }
        output.push({name,rows:[['Admission ID','Learner','Current class','Stream',...headers],...rows.map(row=>{const learner=students.find(s=>s.id===row.student_id);return [learner.admission_number,learner.full_name,learner.class_level,learner.class_stream,...values(row)]})]})
      }
      controller.signal.throwIfAborted();setSheets(output)
    }catch(cause){if(!controller.signal.aborted)setError(cause.message);else setError('Export timed out. Retry a smaller class.')}
    finally{clearTimeout(timer);if(request.current===controller){request.current=null;setBusy(false)}}
  }
  return <section className="academic-downloads" aria-label="Saved teacher marks export"><p>Download saved marks for your currently assigned learners. Unsaved entries are excluded.</p><button type="button" disabled={busy||!students.length||(!junior&&!subject)} onClick={prepare}>{busy?'Reading saved marks…':'Prepare saved marks export'}</button>{error&&<p role="alert">{error}</p>}
    {sheets&&<AcademicDownloads sheets={sheets} details={{Year:year,Term:term,Subject:junior?'Assigned Junior class components and development':subject,Scope:'Current assigned learner scope; saved raw marks only. Current class labels are not historical placement. Missing rows are not zero.'}} filename={`saved-marks-${year}-${term}`}/>}
  </section>
}
