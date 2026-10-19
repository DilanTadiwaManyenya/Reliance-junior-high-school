import { useEffect,useState } from 'react'
import './yearRolloverReadiness.css'

const label=c=>`${c.campus} · ${c.class_level}${c.class_stream?` · ${c.class_stream}`:''}`
const bounded=async promise=>{let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Connection timed out. The outcome may be unconfirmed.')),15000)})])}finally{clearTimeout(timer)}}
export default function YearRolloverWorkflow({supabase,campusScope='all'}) {
 const [campus,setCampus]=useState(campusScope==='senior'?'senior':'junior')
 const [search,setSearch]=useState(''),[page,setPage]=useState(0),[revision,setRevision]=useState(0)
 const [data,setData]=useState(null),[rows,setRows]=useState([]),[batches,setBatches]=useState([])
 const [draft,setDraft]=useState({}),[reason,setReason]=useState(''),[preview,setPreview]=useState(null),[approved,setApproved]=useState(false)
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
 const [reversal,setReversal]=useState(null),[reversalReason,setReversalReason]=useState('')
 const activeCampus=campusScope==='all'?campus:campusScope
 useEffect(()=>{
  let active=true;const controller=new AbortController()
  const timer=setTimeout(async()=>{
   setLoading(true);setError('')
   try{
    const [result,history]=await Promise.all([
     bounded(supabase.rpc('review_year_rollover',{p_campus:activeCampus,p_search:search.trim(),p_offset:page*50}).abortSignal(controller.signal)),
     bounded(supabase.from('year_rollover_batches').select('id,created_at,reason,state,reversal_reason').eq('campus',activeCampus).order('created_at',{ascending:false}).limit(20).abortSignal(controller.signal)),
    ])
    if(result.error||!result.data||history.error)throw new Error('Could not load reviewed rollover. Refresh or check campus access.')
    if(active){setData(result.data);setRows(old=>page?[...old,...result.data.rows.filter(r=>!old.some(p=>p.id===r.id))]:result.data.rows);setBatches(history.data||[])}
   }catch(failure){if(active)setError(failure.message)}finally{if(active)setLoading(false)}
  },250)
  return()=>{active=false;clearTimeout(timer);controller.abort()}
 },[supabase,activeCampus,search,page,revision])
 const clear=()=>{setPreview(null);setApproved(false)}
 const refresh=()=>{setDraft({});setRows([]);setPage(0);clear();setRevision(v=>v+1)}
 const change=(id,key,value)=>{setDraft(old=>({...old,[id]:{...old[id],[key]:value}}));clear()}
 const selected=rows.filter(row=>draft[row.id]?.action)
 const requestPreview=async()=>{
  setBusy(true);setError('');setNotice('');clear()
  const request={p_batch_id:crypto.randomUUID(),p_campus:activeCampus,p_reason:reason.trim(),p_decisions:selected.map(row=>({student_id:row.id,source_year:row.source_year,expected_version:row.expected_version,action:draft[row.id].action,destination_class_id:draft[row.id].action==='complete'?null:draft[row.id].destination||null}))}
  try{const result=await bounded(supabase.rpc('apply_year_rollover',{...request,p_preview:true}));if(result.error)throw new Error(result.error.message);setPreview({request,result:result.data})}catch(failure){setError(failure.message)}finally{setBusy(false)}
 }
 const apply=async()=>{
  setBusy(true);setError('')
  let rejected=false
  try{
   const result=await bounded(supabase.rpc('apply_year_rollover',{...preview.request,p_preview:false}))
   if(result.error){if(result.error.code){rejected=true;setUncertain(false);clear()}else setUncertain(true);throw new Error(result.error.message)}
   setUncertain(false);setNotice(`Rollover applied. Reference ${result.data.batch_id}. Admission identifiers and fee histories retained.`);setReason('');refresh()
  }catch(failure){if(!rejected)setUncertain(true);setError(failure.message||'Outcome unconfirmed. Retry the same batch.')}finally{setBusy(false)}
 }
 const reverse=async()=>{
  setBusy(true);setError('')
  try{const result=await bounded(supabase.rpc('reverse_year_rollover',{p_batch_id:reversal,p_reason:reversalReason.trim()}));if(result.error)throw new Error(result.error.message);setNotice(`${result.data} placements reversed with a recorded reason.`);setReversal(null);setReversalReason('');refresh()}catch(failure){setError(`${failure.message} Refresh history before repeating a reversal.`)}finally{setBusy(false)}
 }
 const locked=busy||uncertain
 return <section className="dash-section rollover-readiness" aria-label="Controlled year rollover">
  <h1 className="dash-page-title">Reviewed year rollover</h1>
  <p>Choose each placement explicitly. Confirm source-year historical report contexts against the school register first. Sixth Form entry and completion require a school decision.</p>
  <p className="portal-notice">Applying updates the current roster immediately. Use this only at the school-approved rollover date. Admission numbers, original enrolment years, marks and fees are retained.</p>
  {notice&&<p role="status" className="portal-notice">{notice}</p>}{error&&<p role="alert" className="portal-notice error">{error}</p>}
  {uncertain&&<p role="alert">Outcome unconfirmed. Retry the same batch below; its reference prevents duplicate application. Keep this page open.</p>}
  <fieldset disabled={locked} className="rollover-workflow-fields"><div className="rollover-filters">
   {campusScope==='all'?<label>Campus<select aria-label="Decision campus" value={campus} onChange={e=>{setCampus(e.target.value);refresh()}}><option value="junior">Junior School</option><option value="senior">Senior School</option></select></label>:<p>Your {activeCampus} campus</p>}
   <label>Find learner<input type="search" maxLength={120} value={search} onChange={e=>{setSearch(e.target.value);refresh()}} /></label><button type="button" className="btn secondary" onClick={refresh}>Refresh decisions</button>
  </div>
  {loading&&<p role="status">Loading reviewed placements…</p>}
  {data&&<p>{rows.length} of {data.total} learners loaded · {selected.length} decisions selected (maximum 100).</p>}
  <div className="rollover-cards">{rows.map(row=><article key={row.id} className="card rollover-card"><h2>{row.full_name}</h2><p>{row.admission_number} · {row.class_level} {row.class_stream} · {row.source_year} → {row.target_year}</p>
   {!row.history_reviewed&&<p>Confirm source-year report history first.</p>}{!row.eligible_year&&<p>Already allocated to a future year. Wait until that year's rollover.</p>}
   <label>Decision for {row.full_name}<select value={draft[row.id]?.action||''} disabled={!row.history_reviewed||!row.eligible_year||(!draft[row.id]?.action&&selected.length>=100)} onChange={e=>{change(row.id,'action',e.target.value);change(row.id,'destination','')}}><option value="">Leave unchanged</option><option value="promote">Promote — school approved</option><option value="retain">Retain at same level</option><option value="transfer">Change stream at same level</option>{['Grade 7','Form 4','Upper Six','Form 6'].includes(row.class_level)&&<option value="complete">Complete / leave school</option>}</select></label>
   {draft[row.id]?.action&&draft[row.id].action!=='complete'&&<label>Destination for {row.full_name}<select value={draft[row.id].destination||''} onChange={e=>change(row.id,'destination',e.target.value)}><option value="">Choose registered class</option>{data.classes.filter(c=>c.class_level===(draft[row.id].action==='promote'?row.suggested_level:row.class_level)).map(c=><option key={c.id} value={c.id}>{label(c)} · {c.current_occupancy}/{c.capacity??'unset'} currently enrolled</option>)}</select></label>}
  </article>)}</div>
  {data&&rows.length<data.total&&<button type="button" disabled={loading} className="btn secondary" onClick={()=>setPage(v=>v+1)}>Load more learners</button>}
  <label>School decision reason<textarea minLength={8} maxLength={500} value={reason} onChange={e=>{setReason(e.target.value);clear()}} /></label>
  <button type="button" className="btn secondary" disabled={loading||!selected.length||reason.trim().length<8} onClick={requestPreview}>Validate and preview placements</button>
  </fieldset>
  {preview&&<div className="card rollover-card"><h2>Review before applying</h2><p>{preview.result.count} learners · Reference {preview.request.p_batch_id}</p><ul>{preview.result.capacity.map(c=><li key={c.class_id}>{label(c)}: {c.projected_occupancy}/{c.capacity??'unset'} projected learners</li>)}</ul><p>All decisions and capacity checks run again when applying.</p><label><input type="checkbox" disabled={locked} checked={approved} onChange={e=>setApproved(e.target.checked)} />I verified these placements and the school-approved rollover date.</label><button className="btn primary" disabled={busy||!approved} onClick={apply}>{busy?'Applying…':uncertain?'Retry same batch':'Apply reviewed placements'}</button></div>}
  <h2>Recent campus batches</h2><p>The latest 20 batches are shown. Main Admin can reverse an eligible batch before new-year reporting begins.</p>
  {batches.map(batch=><article key={batch.id} className="card rollover-card"><h3>{batch.state} · {new Date(batch.created_at).toLocaleDateString('en-ZW')}</h3><p>{batch.reason}</p><p className="rollover-reference">Reference {batch.id}</p>{batch.reversal_reason&&<p>Correction: {batch.reversal_reason}</p>}{campusScope==='all'&&batch.state==='applied'&&<button type="button" className="btn secondary" disabled={locked} onClick={()=>{setReversal(batch.id);setReversalReason('')}}>Review reversal</button>}</article>)}
  {reversal&&<form className="card rollover-card" onSubmit={e=>{e.preventDefault();reverse()}}><h2>Reverse batch {reversal}</h2><p>This restores the original placements for the entire batch. Changed placements, new-year reporting or insufficient original class capacity block reversal.</p><label>Correction reason<textarea required minLength={8} maxLength={500} value={reversalReason} disabled={locked} onChange={e=>setReversalReason(e.target.value)} /></label><button className="btn secondary" type="button" disabled={locked} onClick={()=>setReversal(null)}>Cancel reversal</button><button className="btn primary" disabled={locked||reversalReason.trim().length<8}>Reverse reviewed batch</button></form>}
 </section>
}
