export const registerColumns = ['Admission no.','Learner full name','Date of birth','Age','Sex','Birth certificate','Class','Stream','Campus','Guardian','Phone','Address','Status']
const ageAt=(birth,asOf)=>{
 if(!birth||!/^\d{4}-\d{2}-\d{2}$/.test(birth))return ''
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Africa/Harare'}).format(new Date(asOf))
 const age=Number(today.slice(0,4))-Number(birth.slice(0,4))-(today.slice(5)<birth.slice(5)?1:0)
 return age>=0?String(age):''
}
export const registerRows = (learners,asOf=new Date()) => learners.map(s=>[s.admission_number,s.full_name,s.date_of_birth,ageAt(s.date_of_birth,asOf),s.sex,s.birth_cert_no,s.class_level,s.class_stream,s.campus,s.parent_name,s.parent_phone,s.address,s.status].map(v=>String(v??'')))
// Quote every field, escape quotes/newlines and neutralize spreadsheet formulas,
// including leading whitespace/control characters before the formula prefix.
export function registerCsv(learners,asOf) {
 const cell=v=>{
  let value=String(v)
  const first=[...value].find(char=>char.charCodeAt(0)>32&&!/\s/.test(char))
  if(first&&'=+@-'.includes(first))value="'"+value
  return `"${value.replaceAll('"','""')}"`
 }
 return '\ufeff'+[registerColumns,...registerRows(learners,asOf)].map(row=>row.map(cell).join(',')).join('\r\n')
}
export function registerWorkbookData(learners,asOf) {
 return [registerColumns.map(value=>({value,type:String,fontWeight:'bold',backgroundColor:'#172B59',textColor:'#FFFFFF'})),
 ...registerRows(learners,asOf).map(row=>row.map(value=>({value,type:String}))) ]
}
export function downloadFile(blob,filename) {
 const url=URL.createObjectURL(blob),anchor=document.createElement('a')
 anchor.href=url;anchor.download=filename;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
}
export async function downloadRegisterWorkbook(snapshot,filename) {
 const {default:writeExcelFile}=await import('write-excel-file/browser')
 // Text cells preserve admission numbers/phones/ISO dates and never become formulas.
 const workbook=writeExcelFile([
  {sheet:'Learners',data:registerWorkbookData(snapshot.learners,snapshot.generated_at),columns:[18,32,16,8,10,22,18,14,14,30,22,40,14].map(width=>({width}))},
  {sheet:'Export details',data:[['School','Reliance Learning Centre'],['Scope',snapshot.scope],['Campus',snapshot.campus||'all'],['Class',snapshot.level||'all'],['Stream',snapshot.stream||'all'],['Generated at',snapshot.generated_at],['Learners',String(snapshot.count)],['Status coverage','Active and inactive']]},
 ])
 downloadFile(await workbook.toBlob(),filename)
}
