import { useEffect, useState } from 'react'
import { reportContextNotice } from '../../lib/reportContext'
import './historicalReports.css'

export default function HistoricalReportCard({ render: Report, initialPeriod, reportRevision=0, ...props }) {
  const {supabase,student}=props
  const [contexts,setContexts]=useState([])
  const [period,setPeriod]=useState(initialPeriod||null)
  const [data,setData]=useState(null)
  const [error,setError]=useState('')
  const [loading,setLoading]=useState(true)
  const [revision,setRevision]=useState(0)
  useEffect(()=>{
    const controller=new AbortController();let active=true,timer
    void(async()=>{
      setLoading(true);setError('');setData(null)
      try{
        const result=await Promise.race([
          supabase.from('report_period_contexts').select('id,student_id,academic_year,term,class_level,class_stream,campus').eq('student_id',student.id).order('academic_year',{ascending:false}).order('term',{ascending:false}).abortSignal(controller.signal),
          new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('Loading report history timed out. Please retry.'))},12000)}),
        ])
        if(result.error)throw new Error('Could not load historical report classes. Please retry.')
        if(!active)return
        const rows=result.data||[];setContexts(rows)
        setPeriod(previous=>rows.some(row=>row.academic_year===previous?.year&&row.term===previous?.term)?previous:rows.length?{year:rows[0].academic_year,term:rows[0].term}:null)
        if(!rows.length){setError('No reporting class history is available for this learner. Ask the school office to review the record.');setLoading(false)}
      }catch(requestError){if(active){setError(requestError.message);setLoading(false)}}finally{clearTimeout(timer)}
    })()
    return()=>{active=false;clearTimeout(timer);controller.abort()}
  },[supabase,student.id,revision,reportRevision])
  useEffect(()=>{
    if(!period)return undefined
    const controller=new AbortController();let active=true,timer
    void(async()=>{
      setLoading(true);setError('');setData(null)
      try{
        const result=await Promise.race([
          supabase.rpc('read_report_period',{p_student:student.id,p_year:period.year,p_term:period.term}).abortSignal(controller.signal),
          new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('Loading this report timed out. Please retry.'))},12000)}),
        ])
        if(result.error||!result.data?.context)throw new Error('This report is unavailable for your account. Please retry or contact the school.')
        if(active)setData(result.data)
      }catch(requestError){if(active)setError(requestError.message)}finally{clearTimeout(timer);if(active)setLoading(false)}
    })()
    return()=>{active=false;clearTimeout(timer);controller.abort()}
  },[supabase,student.id,period,revision,reportRevision])
  const choose=(year,term)=>{setData(null);setLoading(true);setPeriod({year,term})}
  const years=[...new Set(contexts.map(row=>row.academic_year))]
  const terms=contexts.filter(row=>row.academic_year===period?.year).map(row=>row.term)
  const context=data?.context
  const historicalStudent=context?{...student,class_level:context.class_level,class_stream:context.class_stream,campus:context.campus,full_name:student.full_name||context.learner_name,admission_number:context.admission_number,enrolled_year:context.enrolled_year}:student
  const report=data?Object.fromEntries(data.termSettings.map(row=>[`${row.academic_year}-${row.term}`,row])):{}
  return <div className="historical-report-view">
    <div className="historical-report-controls no-print">
      {!!years.length&&<><label>Report year<select aria-label="Report year" value={period?.year||''} onChange={event=>{const year=Number(event.target.value);choose(year,contexts.find(row=>row.academic_year===year).term)}}>{years.map(year=><option key={year}>{year}</option>)}</select></label>
      <label>Report term<select aria-label="Report term" value={period?.term||''} onChange={event=>choose(period.year,Number(event.target.value))}>{terms.map(term=><option key={term} value={term}>Term {term}</option>)}</select></label></>}
      <button type="button" className="btn secondary" onClick={()=>setRevision(value=>value+1)}>Refresh report</button>
    </div>
    {loading&&<p role="status">Loading historical report…</p>}
    {error&&<div className="portal-notice error" role="alert">{error}</div>}
    {!loading&&!error&&data&&<Report {...props} student={historicalStudent} academics={data.academics} juniorComponentMarks={data.componentMarks} juniorDevelopmentalRatings={data.developmentalRatings}
      reportComments={data.reportComments} attendance={data.attendance} sports={data.sports} awards={data.awards} fees={data.fees} report={report} reportFees={data.reportFees}
      subjects={context.report_rules.subjects} subjectTeachers={context.subject_teachers} classTeacher={context.class_teacher}
      period={period} reportRules={context.report_rules} contextNotice={reportContextNotice(context)} />}
  </div>
}
