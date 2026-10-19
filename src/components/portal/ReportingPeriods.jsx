import {useEffect,useState} from 'react'
import './yearRolloverReadiness.css'
export default function ReportingPeriods({supabase,campusScope='all'}) {
 const [campus,setCampus]=useState(campusScope==='senior'?'senior':'junior'),[year,setYear]=useState(new Date().getFullYear()),[term,setTerm]=useState(1)
 const [rows,setRows]=useState([]),[events,setEvents]=useState([]),[selected,setSelected]=useState(null),[reason,setReason]=useState('')
 const [revision,setRevision]=useState(0),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
 const activeCampus=campusScope==='all'?campus:campusScope
 useEffect(()=>{
  let active=true,timer;const controller=new AbortController()
  Promise.race([Promise.all([
   supabase.from('reporting_periods').select('*').eq('campus',activeCampus).order('academic_year',{ascending:false}).order('term',{ascending:false}).limit(50).abortSignal(controller.signal),
   supabase.from('reporting_period_events').select('id,created_at,actor_name,action,reason,after_state').eq('campus',activeCampus).order('created_at',{ascending:false}).limit(30).abortSignal(controller.signal),
  ]),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('Term registry timed out. Please refresh.'))},12000)})]).then(([periods,history])=>{
   if(periods.error||history.error)throw new Error('Could not load the term registry. Please refresh.')
   if(active){setRows(periods.data||[]);setEvents(history.data||[])}
  }).catch(failure=>{if(active)setError(failure.message)}).finally(()=>{clearTimeout(timer);if(active)setLoading(false)})
  return()=>{active=false;clearTimeout(timer);controller.abort()}
 },[supabase,activeCampus,revision])
 const refresh=()=>{setLoading(true);setError('');setSelected(null);setRevision(v=>v+1)}
 const save=async event=>{
  event.preventDefault();setBusy(true);setError('');let timer
  try{
   const result=await Promise.race([supabase.rpc('change_reporting_period',{p_campus:activeCampus,p_year:selected.year,p_term:selected.term,p_action:selected.action,p_reason:reason.trim(),p_expected_revision:selected.revision??null}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Outcome unconfirmed. Refresh the registry and check its history before repeating.')),15000)})])
   if(result.error)throw new Error(result.error.message)
   setNotice(`Term ${result.data.term} ${result.data.academic_year}: ${result.data.state}${result.data.is_current?' · current reporting period':''}. Change recorded.`);setReason('');refresh()
  }catch(failure){setError(failure.message)}finally{clearTimeout(timer);setBusy(false)}
 }
 const choose=(row,action)=>{setSelected({year:row.academic_year,term:row.term,action,revision:row.revision});setReason('');setNotice('')}
 return <section className="dash-section rollover-readiness"><h1 className="dash-page-title">Terms and marks locking</h1><p>Closing a reporting period blocks marks, components, development ratings, official notes and assessments in the database. Reopen with a recorded reason for authorised corrections.</p>
  {error&&<p role="alert" className="portal-notice error">{error}</p>}{notice&&<p role="status" className="portal-notice">{notice}</p>}
  <fieldset className="rollover-workflow-fields" disabled={busy}><div className="rollover-filters">{campusScope==='all'?<label>Campus<select aria-label="Term campus" value={campus} onChange={e=>{setCampus(e.target.value);setRows([]);refresh()}}><option value="junior">Junior School</option><option value="senior">Senior School</option></select></label>:<p>Your {activeCampus} campus</p>}<button type="button" className="btn secondary" onClick={refresh}>Refresh terms</button></div>
  <div className="rollover-filters"><label>New academic year<input type="number" min="2020" max="2100" value={year} onChange={e=>setYear(e.target.value)} /></label><label>New term<select value={term} onChange={e=>setTerm(Number(e.target.value))}>{[1,2,3].map(t=><option key={t} value={t}>Term {t}</option>)}</select></label><button type="button" className="btn secondary" onClick={()=>{setSelected({year:Number(year),term,action:'create'});setReason('')}}>Review opening a term</button></div>
  {loading&&<p role="status">Loading reporting periods…</p>}
  <div className="rollover-cards">{rows.map(row=><article className="card rollover-card" key={row.id}><h2>Term {row.term} · {row.academic_year}</h2><p>{row.state}{row.is_current?' · current reporting period':''} · revision {row.revision}</p><button type="button" className="btn secondary" onClick={()=>choose(row,row.state==='open'?'close':'reopen')}>{row.state==='open'?'Review closing':'Review reopening'} Term {row.term} {row.academic_year}</button>{row.state==='open'&&!row.is_current&&<button type="button" className="btn secondary" onClick={()=>choose(row,'set_current')}>Review making Term {row.term} {row.academic_year} current</button>}</article>)}</div>
  {selected&&<form className="card rollover-card" onSubmit={save}><h2>Confirm {selected.action.replace('_',' ')} · Term {selected.term} {selected.year}</h2><p>{selected.action==='close'?'All writes to this period will be blocked, including direct API requests. Current coursework defaults will be cleared if this is the current term.':'Opening permits authorised edits. Set an open term as current to update coursework defaults.'}</p><label>Term change reason<textarea required minLength={8} maxLength={500} value={reason} onChange={e=>setReason(e.target.value)} /></label><button type="button" className="btn secondary" onClick={()=>setSelected(null)}>Cancel term change</button><button className="btn primary" disabled={reason.trim().length<8||busy}>Save reviewed term change</button></form>}
  </fieldset><h2>Recent term activity</h2><p>Latest 30 events for this campus.</p>{events.map(e=><article key={e.id} className="card rollover-card"><h3>{e.action} · Term {e.after_state?.term} {e.after_state?.academic_year} · {new Date(e.created_at).toLocaleDateString('en-ZW')}</h3><p>{e.actor_name||'Initial registry setup'} · {e.reason}</p></article>)}
 </section>
}
