import { useEffect,useState } from 'react'
import AcademicReportCard from './AcademicReportCard'
import './historicalReports.css'

export default function ReportClassHistory({supabase,campusScope='all',canReview=false}) {
 const harareNow=new Date(new Date().toLocaleString('en-US',{timeZone:'Africa/Harare'}))
 const [year,setYear]=useState(harareNow.getFullYear())
 const [term,setTerm]=useState(Math.floor(harareNow.getMonth()/4)+1)
 const [campus,setCampus]=useState(campusScope==='senior'?'senior':'junior')
 const [query,setQuery]=useState('')
 const [rows,setRows]=useState([])
 const [classes,setClasses]=useState([])
 const [page,setPage]=useState(0)
 const [more,setMore]=useState(false)
 const [selected,setSelected]=useState([])
 const [classId,setClassId]=useState('')
 const [reason,setReason]=useState('')
 const [staffing,setStaffing]=useState(false)
 const [captureAdmission,setCaptureAdmission]=useState('')
 const [captureReason,setCaptureReason]=useState('')
 const [captureConfirmed,setCaptureConfirmed]=useState(false)
 const [view,setView]=useState(null)
 const [loading,setLoading]=useState(true)
 const [saving,setSaving]=useState(false)
 const [error,setError]=useState('')
 const [notice,setNotice]=useState('')
 const [revision,setRevision]=useState(0)
 const activeCampus=campusScope==='all'?campus:campusScope
 const currentYear=harareNow.getFullYear()
 const reset=()=>{setPage(0);setSelected([]);setClassId('');setRows([]);setLoading(true)}
 useEffect(()=>{
  let active=true,timer
  const controller=new AbortController()
  const debounce=setTimeout(async()=>{
   setLoading(true);setError('')
   try{
    let request=supabase.from('report_period_contexts').select('id,student_id,academic_year,term,campus,class_level,class_stream,learner_name,admission_number,enrolled_year,active_when_captured,provenance,confirmed_at,staffing_verified_at').eq('campus',activeCampus).eq('academic_year',Number(year)).eq('term',Number(term)).order('learner_name').order('id')
    if(query.trim())request=request.ilike('learner_name',`%${query.trim().replace(/[\\%_]/g,'\\$&')}%`)
    const result=await Promise.race([request.range(page*50,page*50+49).abortSignal(controller.signal),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('Report history timed out. Please retry.'))},12000)})])
    if(result.error)throw new Error('Could not load report class history. Please retry.')
    if(active){setRows(previous=>page?[...previous,...result.data.filter(row=>!previous.some(old=>old.id===row.id))]:result.data);setMore(result.data.length===50)}
   }catch(requestError){if(active)setError(requestError.message)}finally{clearTimeout(timer);if(active)setLoading(false)}
  },250)
  return()=>{active=false;clearTimeout(debounce);clearTimeout(timer);controller.abort()}
 },[supabase,activeCampus,year,term,query,page,revision])
 useEffect(()=>{
  if(!canReview)return undefined
  let active=true
  const controller=new AbortController()
  let request=supabase.from('school_classes').select('id,campus,class_level,class_stream,active').order('campus').order('class_level')
  if(campusScope!=='all')request=request.eq('campus',campusScope)
  Promise.resolve(request.abortSignal(controller.signal)).then(result=>{if(active&&!result.error)setClasses(result.data||[])}).catch(()=>{})
  return()=>{active=false;controller.abort()}
 },[supabase,canReview,campusScope])
 const toggle=id=>{setSelected(current=>current.includes(id)?current.filter(value=>value!==id):current.length<100?[...current,id]:current);setClassId('')}
 const save=async event=>{
  event.preventDefault();setSaving(true);setError('');setNotice('')
  let timeout
  try{
   const result=await Promise.race([supabase.rpc('review_report_contexts',{p_ids:selected,p_reason:reason.trim(),p_class_id:selected.length===1&&classId?classId:null,p_refresh_staffing:staffing}),
    new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('Review outcome is unconfirmed. Refresh the list and check the status before retrying.')),15000)})])
   if(result.error)throw new Error(result.error.message||'Could not save the review.')
   setNotice(`${result.data} reporting contexts reviewed.`);reset();setReason('');setStaffing(false);setRevision(value=>value+1)
  }catch(requestError){setError(requestError.message)}finally{clearTimeout(timeout);setSaving(false)}
 }
 const captureMissingContext=async event=>{
  event.preventDefault();setSaving(true);setError('');setNotice('')
  let timeout
  try{
   const admission=captureAdmission.trim()
   const lookup=await supabase.from('students').select('id,full_name,admission_number,campus,class_level,class_stream,enrolled_year,status').eq('admission_number',admission).eq('campus',activeCampus).maybeSingle()
   if(lookup.error)throw new Error('Could not verify this learner. Please retry.')
   if(!lookup.data)throw new Error('No learner with that admission number was found in the selected campus.')
   if(Number(lookup.data.enrolled_year)>Number(year))throw new Error('This learner was not enrolled in the selected academic year.')
   const result=await Promise.race([
    supabase.rpc('capture_reviewed_current_report_context',{p_student:lookup.data.id,p_year:Number(year),p_term:Number(term),p_reason:captureReason.trim()}),
    new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('Capture outcome is unconfirmed. Refresh history and check before retrying.')),15000)})
   ])
   if(result.error)throw new Error(result.error.message||'Could not capture the report context.')
   setNotice(`Captured Term ${term} ${year} for ${lookup.data.full_name} (${lookup.data.admission_number}) using the class and staffing currently on the learner record.`)
   setCaptureAdmission('');setCaptureReason('');setCaptureConfirmed(false);setSelected([]);setRevision(value=>value+1)
  }catch(requestError){setError(requestError.message)}finally{clearTimeout(timeout);setSaving(false)}
 }
 if(view)return <section><button type="button" className="btn secondary no-print" onClick={()=>setView(null)}>Back to report history</button>
  <AcademicReportCard key={view.id} supabase={supabase} initialPeriod={{year:view.academic_year,term:view.term}} adminAccess={true} allowReportEditing={false}
   student={{id:view.student_id,full_name:view.learner_name,admission_number:view.admission_number,class_level:view.class_level,class_stream:view.class_stream,campus:view.campus}} />
 </section>
 return <section className="dash-section report-class-history">
  <h1 className="dash-page-title">Historical reports</h1>
  <p>Read the class, curriculum, grade rules and teacher snapshot recorded for each reporting period.</p>
  {canReview&&<p>Verify inferred records against the school register before confirming them. A correction changes only the selected report context.</p>}
  <div className="report-context-filters">
   {campusScope==='all'?<label>Campus<select aria-label="History campus" value={campus} onChange={event=>{setCampus(event.target.value);reset()}}><option value="junior">Junior School</option><option value="senior">Senior School</option></select></label>:<p>Your {campusScope} campus history</p>}
   <label>Academic year<input type="number" min="2020" max="2100" value={year} onChange={event=>{setYear(event.target.value);reset()}} /></label>
   <label>Reporting term<select aria-label="History term" value={term} onChange={event=>{setTerm(Number(event.target.value));reset()}}>{[1,2,3].map(value=><option key={value} value={value}>Term {value}</option>)}</select></label>
   <label>Learner name<input type="search" value={query} onChange={event=>{setQuery(event.target.value);reset()}} /></label>
   <button type="button" className="btn secondary" onClick={()=>{reset();setRevision(value=>value+1)}}>Refresh history</button>
  </div>
  {notice&&<p role="status" className="portal-notice">{notice}</p>}
  {error&&<p role="alert" className="portal-notice error">{error}</p>}
  {canReview&&Number(year)===currentYear&&<form className="report-context-review" onSubmit={captureMissingContext}>
   <h2>Capture a missing report period</h2>
   <p>Check the learner’s current class against the school register first. This creates one audited report context for the selected term and does not add or change marks.</p>
   <label>Admission number<input required maxLength={40} value={captureAdmission} onChange={event=>setCaptureAdmission(event.target.value)} /></label>
   <label>Review reason<textarea minLength={8} maxLength={500} required value={captureReason} onChange={event=>setCaptureReason(event.target.value)} /></label>
   <label className="review-checkbox"><input type="checkbox" checked={captureConfirmed} onChange={event=>setCaptureConfirmed(event.target.checked)} />I verified this learner’s current class against the school register</label>
   <button type="submit" className="btn secondary" disabled={saving||!captureConfirmed||captureReason.trim().length<8}>{saving?'Capturing…':`Capture Term ${term} ${year}`}</button>
  </form>}
  {loading&&<p role="status">Loading class history…</p>}
  {!loading&&!error&&!rows.length&&<p>No report contexts match this period.</p>}
  {canReview&&rows.length>0&&<button type="button" className="btn secondary" onClick={()=>{setSelected(rows.slice(0,100).map(row=>row.id));setClassId('')}} disabled={saving}>Select loaded contexts (up to 100)</button>}
  {canReview&&selected.length>0&&<form className="report-context-review" onSubmit={save}>
   <h2>Review {selected.length} selected contexts</h2>
   {selected.length===1&&<label>Correct recorded class (optional)<select aria-label="Correct recorded class" value={classId} onChange={event=>setClassId(event.target.value)}><option value="">Keep recorded class</option>{classes.map(row=><option key={row.id} value={row.id}>{row.campus} · {row.class_level}{row.class_stream?` · ${row.class_stream}`:''}{!row.active?' (inactive historical class)':''}</option>)}</select></label>}
   {classId&&<p>A class correction clears the old teacher snapshot. Confirm current assignments below only if they are historically correct.</p>}
   <label>Review reason<textarea minLength={8} maxLength={500} required value={reason} onChange={event=>setReason(event.target.value)} /></label>
   <label className="review-checkbox"><input type="checkbox" checked={staffing} onChange={event=>setStaffing(event.target.checked)} />Use current teacher assignments — I have verified they are correct for this report</label>
   <button type="submit" className="btn primary" disabled={saving||reason.trim().length<8}>{saving?'Saving review…':'Save reviewed contexts'}</button>
  </form>}
  <div className="report-context-list">{rows.map(row=><article className="card report-context-entry" key={row.id}>
   <h2>{row.learner_name}</h2><p>{row.admission_number} · {row.class_level}{row.class_stream?` · ${row.class_stream}`:''} · Term {row.term} {row.academic_year}</p>
   <p>{row.confirmed_at?'School-confirmed class':row.provenance==='legacy_inferred'?'Inferred class — verification needed':'Recorded at period activity'}{!row.staffing_verified_at?' · staffing review pending':''}</p>
   <div className="report-context-actions">{canReview&&<label><input type="checkbox" checked={selected.includes(row.id)} disabled={saving||(!selected.includes(row.id)&&selected.length>=100)} onChange={()=>toggle(row.id)} />Review class for {row.learner_name}</label>}
    <button type="button" className="btn secondary" onClick={()=>setView(row)}>View historical report</button></div>
  </article>)}</div>
  {more&&!error&&<button type="button" className="btn secondary" disabled={loading} onClick={()=>setPage(value=>value+1)}>Load more contexts</button>}
 </section>
}
