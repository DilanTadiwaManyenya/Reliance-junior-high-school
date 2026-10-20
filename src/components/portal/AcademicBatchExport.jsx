import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../context/useAuth'
import { readAllRows } from '../../lib/operationsExport'
import { academicSheets } from '../../lib/academicExport'
import AcademicDownloads from './AcademicDownloads'

export default function AcademicBatchExport() {
  const {supabase,profile}=useAuth()
  const [filters,setFilters]=useState({year:new Date().getFullYear(),term:'3',campus:['junior','senior'].includes(profile?.campus)?profile.campus:'all',level:'',stream:''})
  const [bundle,setBundle]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const request=useRef(null)
  useEffect(()=>()=>request.current?.abort(),[])
  if(!['admin','principal'].includes(profile?.active_role??profile?.role))return null
  const change=key=>event=>{request.current?.abort();request.current=null;setBusy(false);setBundle(null);setError('');setFilters({...filters,[key]:event.target.value})}
  const prepare=async()=>{
    const controller=new AbortController();request.current?.abort();request.current=controller
    setBusy(true);setError('');setBundle(null)
    const timer=setTimeout(()=>controller.abort(),30000)
    try{
      const contexts=await readAllRows(()=>{
        let query=supabase.from('report_period_contexts').select('id,student_id,academic_year,term,class_level,class_stream,campus').eq('academic_year',Number(filters.year)).eq('term',Number(filters.term))
        if(filters.campus!=='all')query=query.eq('campus',filters.campus)
        if(filters.level.trim())query=query.eq('class_level',filters.level.trim())
        if(filters.stream.trim())query=query.eq('class_stream',filters.stream.trim())
        return query
      },{signal:controller.signal,limit:200})
      if(!contexts.length)throw new Error('No authorised report contexts match these filters.')
      const reports=[]
      for(let offset=0;offset<contexts.length;offset+=4){
        const results=await Promise.all(contexts.slice(offset,offset+4).map(context=>supabase.rpc('read_report_period',{p_student:context.student_id,p_year:context.academic_year,p_term:context.term}).abortSignal(controller.signal)))
        controller.signal.throwIfAborted()
        for(const result of results){if(result.error||!result.data?.context)throw new Error('A report could not be read. No partial batch is available; retry.');reports.push(result.data)}
      }
      if(request.current===controller)setBundle({sheets:academicSheets(reports),details:{Scope:'Authorised historical report contexts',Campus:filters.campus,Class:filters.level||'all',Stream:filters.stream||'all',Year:filters.year,Term:filters.term,'Report contexts':reports.length,'Prepared at':new Date().toISOString(),Note:'Saved raw marks, not recalculated grades. Blank means not recorded or not available. Inferred contexts require school verification.'}})
    }catch(cause){if(request.current===controller)setError(controller.signal.aborted?'Preparation timed out. Choose a smaller class scope and retry.':cause.message)}
    finally{clearTimeout(timer);if(request.current===controller){request.current=null;setBusy(false)}}
  }
  return <section className="card academic-downloads" aria-label="Historical academic batch export"><h2>Historical academic export</h2><p>Choose the class recorded in that year and term. Only records allowed by your account are included. Maximum 200 report contexts per batch; narrow the class or stream for larger groups.</p>
    <div className="academic-batch-controls"><label>Export year<input aria-label="Export year" type="number" min="2000" max="2100" value={filters.year} onChange={change('year')}/></label><label>Export term<select aria-label="Export term" value={filters.term} onChange={change('term')}>{[1,2,3].map(term=><option key={term} value={term}>Term {term}</option>)}</select></label>
      {profile?.campus==='all'&&<label>Export campus<select value={filters.campus} onChange={change('campus')}><option value="all">All authorised campuses</option><option value="junior">Junior</option><option value="senior">Senior</option></select></label>}
      <label>Historical class<input value={filters.level} placeholder="All classes, or e.g. Grade 1" onChange={change('level')}/></label><label>Historical stream<input value={filters.stream} placeholder="All streams" onChange={change('stream')}/></label>
      <button type="button" disabled={busy||!/^\d{4}$/.test(String(filters.year))} onClick={prepare}>{busy?'Preparing reports…':'Prepare academic export'}</button></div>
    {error&&<p role="alert">{error}</p>}{bundle&&<AcademicDownloads key={bundle.details['Prepared at']} {...bundle} filename={`academic-batch-${filters.campus}-${filters.year}-term-${filters.term}`}/>}
  </section>
}
