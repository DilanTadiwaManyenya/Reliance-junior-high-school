// Read-only requests: no real admission details or account creation.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
const ref='ejrtmdvnumjwikehzrrk'
let keys
try {
  keys=JSON.parse(execFileSync('powershell.exe',['-NoProfile','-Command',`& node_modules/.bin/supabase.cmd projects api-keys --project-ref ${ref} --output json --reveal`],{encoding:'utf8',stdio:['ignore','pipe','pipe']}))
} catch { throw new Error('Unable to obtain the public project credential for live registration checks.') }
const key=keys.find(k=>k.name==='anon')?.api_key||keys.find(k=>k.type==='publishable')?.api_key
if(!key)throw new Error('Public project credential is unavailable.')
const url=`https://${ref}.supabase.co`
const headers={apikey:key,'Content-Type':'application/json'}
const send=(path,body,method='POST')=>fetch(url+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)})
const path='/functions/v1/register-student'
assert.equal((await send(path,undefined,'GET')).status,405)
for(const body of [null,{admission_number:'26f146',date_of_birth:'2011-02-29',password:'AcceptanceOnly7!',class_level:'Form 1',class_stream:'Red'},
  {admission_number:'99f199',date_of_birth:'2012-02-29',password:'AcceptanceOnly7!',class_level:'Form 1',class_stream:'Red'}]){
  const response=await send(path,body)
  assert.equal(response.status,400)
  assert.equal((await response.json()).success,false)
}
const denied=await send('/rest/v1/rpc/complete_student_registration',{p_user_id:'00000000-0000-4000-8000-000000000001',p_admission_number:'99f199',p_date_of_birth:'2012-02-29',p_class_level:'Form 1',p_class_stream:'Red'})
assert.ok([401,403].includes(denied.status),'Anonymous caller cannot complete registration')
console.log('PASS live HTTP method/invalid-date/missing-learner validation and anonymous completion denial; no accounts created')
