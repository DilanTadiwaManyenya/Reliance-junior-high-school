import {useEffect,useState} from 'react'
// Only new coursework defaults move to the registry in this phase. Existing
// assessments retain their recorded period; fee/calendar defaults are separate.
export function useReportingPeriodDefault(supabase,campus,setForm) {
 const [state,setState]=useState({loading:true,period:null,error:''})
 useEffect(()=>{
  let active=true;const controller=new AbortController();let timer
  Promise.race([
   supabase.from('reporting_periods').select('academic_year,term').eq('campus',campus).eq('is_current',true).eq('state','open').maybeSingle().abortSignal(controller.signal),
   new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('Could not load the current reporting period. Reopen this workspace to retry.'))},12000)}),
  ]).then(result=>{
   if(result.error)throw new Error('Could not load the current reporting period. Reopen this workspace to retry.')
   if(active){if(result.data)setForm(form=>({...form,term:String(result.data.term),academic_year:result.data.academic_year}));setState({loading:false,period:result.data,error:result.data?'':'No open current reporting period. Ask your campus administrator to set one before creating assessments.'})}
  }).catch(failure=>{if(active)setState({loading:false,period:null,error:failure.message})}).finally(()=>clearTimeout(timer))
  return()=>{active=false;clearTimeout(timer);controller.abort()}
 },[supabase,campus,setForm])
 return state
}
