import {useEffect,useMemo,useRef,useState} from 'react'
import {supabase as fallback} from '../../lib/supabaseClient'
import {useSchoolClasses} from '../../hooks/useSchoolClasses'
import {useRegisterPrint} from '../../hooks/useRegisterPrint'
import {registerColumns,registerRows,registerCsv,downloadFile,downloadRegisterWorkbook} from '../../lib/learnerRegisterExport'

const scopes=[{id:'class',title:'Class · all streams',description:'Every learner in one class level.'},{id:'stream',title:'Class · one stream',description:'Learners in one selected stream.'},{id:'campus',title:'Whole campus',description:'All learners in Junior or Senior.'},{id:'all',title:'All campuses',description:'The complete school learner register.'}]
const scopeTitle=({scope,campus,level,stream})=>scope==='all'?'All campuses':scope==='campus'?`${campus==='junior'?'Junior':'Senior'} campus`:scope==='stream'?`${level} · ${stream}`:`${level} · all streams`
export default function BulkLearnerExport({supabase:provided,campusScope='all'}) {
 const db=provided??fallback
 const {classes,loading:classesLoading,error:classesError}=useSchoolClasses(db)
 const [scope,setScope]=useState('class'),[campus,setCampus]=useState(campusScope==='all'?'junior':campusScope),[level,setLevel]=useState(''),[stream,setStream]=useState('')
 const [snapshot,setSnapshot]=useState(null),[loading,setLoading]=useState(false),[error,setError]=useState(''),[downloading,setDownloading]=useState(false),[printing,setPrinting]=useState(false)
 const request=useRef({id:0,controller:null})
 const isCampusScoped=['junior','senior'].includes(campusScope)
 const effectiveCampus=isCampusScoped?campusScope:campus
 const visibleClasses=useMemo(()=>isCampusScoped?classes.filter(c=>c.campus===campusScope):classes,[classes,campusScope,isCampusScoped])
 const levels=[...new Set(visibleClasses.map(c=>c.class_level))]
 const effectiveLevel=levels.includes(level)?level:levels[0]||''
 const streams=[...new Set(visibleClasses.filter(c=>c.class_level===effectiveLevel).map(c=>c.class_stream).filter(Boolean))]
 const effectiveStream=streams.includes(stream)?stream:streams[0]||''
 const availableScopes=isCampusScoped?scopes.filter(s=>s.id!=='all'&&!(campusScope==='junior'&&s.id==='stream')):scopes
 const filters={scope,campus:isCampusScoped||scope==='campus'?effectiveCampus:null,level:['class','stream'].includes(scope)?effectiveLevel:null,stream:scope==='stream'?effectiveStream:null}
 const scopeKey=JSON.stringify(filters)
 const visibleSnapshot=snapshot?.key===scopeKey?snapshot:null
 const currentScope=scopeTitle({...filters,campus:effectiveCampus})
 const documentTitle=visibleSnapshot?`Reliance learner register - ${scopeTitle(visibleSnapshot).replaceAll(' · ',' - ')}`:'Reliance learner register'
 useRegisterPrint(Boolean(visibleSnapshot),documentTitle,setPrinting)
 useEffect(()=>()=>{request.current.id++;request.current.controller?.abort()},[])
 const clear=()=>{request.current.id++;request.current.controller?.abort();setSnapshot(null);setLoading(false);setError('')}
 const canPreview=!classesLoading&&!classesError&&(['all','campus'].includes(scope)||Boolean(effectiveLevel&&(scope!=='stream'||effectiveStream)))
 const preview=async()=>{
  if(!canPreview)return
  clear();setLoading(true)
  const controller=new AbortController(),id=++request.current.id;request.current.controller=controller
  let timer
  try{
   const result=await Promise.race([db.rpc('export_learner_register',{p_scope:filters.scope,p_campus:filters.campus,p_level:filters.level,p_stream:filters.stream}).abortSignal(controller.signal),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('Register preparation timed out. Retry or choose a smaller scope.'))},15000)})])
   if(result.error||!result.data||!Array.isArray(result.data.learners)||result.data.count!==result.data.learners.length)throw new Error(result.error?.message||'The register response was incomplete. Please retry.')
   if(id===request.current.id)setSnapshot({...result.data,key:scopeKey})
  }catch(failure){if(id===request.current.id)setError(failure.message)}finally{clearTimeout(timer);if(id===request.current.id)setLoading(false)}
 }
 const filename=extension=>`reliance-learners-${visibleSnapshot.campus||'all'}-${visibleSnapshot.scope}-${visibleSnapshot.generated_at.slice(0,10)}.${extension}`
 const excel=async()=>{
  setDownloading(true);setError('')
  try{await downloadRegisterWorkbook(visibleSnapshot,filename('xlsx'))}catch{setError('Could not create the Excel file. Please retry, or download CSV.')}finally{setDownloading(false)}
 }
 const tableRows=visibleSnapshot?registerRows(printing?visibleSnapshot.learners:visibleSnapshot.learners.slice(0,200),visibleSnapshot.generated_at):[]
 return <section className="bulk-export">
  <div className="bulk-export-intro"><div><p className="eyebrow">Learner register · CSV, Excel and PDF</p><h2>Build the learner export</h2><p>Select the register, preview its complete count, then download or print the same snapshot.</p></div>{visibleSnapshot&&<div className="bulk-export-count"><b>{visibleSnapshot.count}</b><span>Learners in this export</span></div>}</div>
  <section className="bulk-export-controls" aria-label="Learner export scope"><fieldset disabled={downloading||printing}><legend>1. Choose the export scope</legend><div className="bulk-export-scope-grid">{availableScopes.map(option=><label key={option.id} className={`bulk-export-scope${scope===option.id?' selected':''}`}><input type="radio" name="export-scope" value={option.id} checked={scope===option.id} onChange={()=>{clear();setScope(option.id)}} /><span><b>{option.title}</b><small>{option.description}</small></span></label>)}</div></fieldset>
   {scope!=='all'&&<div className="bulk-export-fields">{scope==='campus'&&<label>Campus{isCampusScoped?<input readOnly value={`${effectiveCampus==='junior'?'Junior':'Senior'} campus`} aria-label="Campus locked to your admin campus" />:<select aria-label="Export campus" value={campus} disabled={downloading||printing} onChange={e=>{clear();setCampus(e.target.value)}}><option value="junior">Junior campus</option><option value="senior">Senior campus</option></select>}</label>}
   {['class','stream'].includes(scope)&&<label>Class<select aria-label="Export class" value={effectiveLevel} disabled={classesLoading||downloading||printing} onChange={e=>{clear();setLevel(e.target.value);setStream('')}}>{levels.map(item=><option key={item}>{item}</option>)}</select></label>}
   {scope==='stream'&&<label>Stream<select aria-label="Export stream" value={effectiveStream} disabled={classesLoading||downloading||printing} onChange={e=>{clear();setStream(e.target.value)}}>{streams.map(item=><option key={item}>{item}</option>)}</select></label>}</div>}
   <div className="bulk-export-actions"><div><b>{currentScope}</b><small>Includes active and inactive learners in this scope. Exports use the previewed snapshot.</small></div><button type="button" className="btn primary" disabled={!canPreview||loading||downloading||printing} onClick={preview}>{loading?'Loading learners…':'Preview learner list'}</button></div>
  </section>
  {(error||classesError)&&<p role="alert" className="portal-notice error">Unable to prepare the learner export: {error||classesError}</p>}
  {visibleSnapshot&&<section className="bulk-export-preview" id="learner-register-preview"><div className="bulk-export-preview-head"><div><p className="eyebrow">Reliance Learning Centre · learner register</p><h2>{scopeTitle(visibleSnapshot)}</h2><p>{visibleSnapshot.count} learners · active and inactive · prepared {new Date(visibleSnapshot.generated_at).toLocaleString('en-ZW',{timeZone:'Africa/Harare'})}</p></div>
   <div className="register-download-actions"><button type="button" className="btn secondary" disabled={!visibleSnapshot.count||downloading} onClick={()=>downloadFile(new Blob([registerCsv(visibleSnapshot.learners,visibleSnapshot.generated_at)],{type:'text/csv;charset=utf-8;'}),filename('csv'))}>Download CSV</button><button type="button" className="btn secondary" disabled={!visibleSnapshot.count||downloading} onClick={excel}>{downloading?'Preparing Excel…':'Download Excel'}</button><button type="button" className="btn secondary" disabled={!visibleSnapshot.count||downloading} onClick={()=>window.print()}>Print / save as PDF</button></div></div>
   {visibleSnapshot.count>200&&<p className="register-preview-limit">Showing the first 200 of {visibleSnapshot.count} learners on screen. CSV, Excel and print include all {visibleSnapshot.count}.</p>}
   {tableRows.length?<div className="portal-table-wrap bulk-export-table" tabIndex={0} role="region" aria-label="Learner register rows"><table className="portal-table"><colgroup>{[4,9,13,7,3,5,7,6,5,6,9,9,12,5].map((width,index)=><col key={index} style={{width:`${width}%`}} />)}</colgroup><thead><tr><th>#</th>{registerColumns.map(c=><th key={c}>{c}</th>)}</tr></thead><tbody>{tableRows.map((row,index)=><tr key={index}><td>{index+1}</td>{row.map((value,column)=><td key={column}>{value||'—'}</td>)}</tr>)}</tbody></table></div>:<p className="bulk-export-empty">No learners are currently recorded for this selection.</p>}
  </section>}
 </section>
}
