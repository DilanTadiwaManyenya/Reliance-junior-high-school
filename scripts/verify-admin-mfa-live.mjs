// Creates one temporary synthetic Auth account, then deletes it in finally.
// --activate enables mandatory admin MFA ONLY after enrolment succeeds.
// Project credentials, passwords, QR codes and TOTP secrets stay in memory.
import { execFileSync } from 'node:child_process'
import { randomUUID,randomBytes,createHmac } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { requireAdminMfa } from '../supabase/functions/_shared/adminMfa.js'
const ref='ejrtmdvnumjwikehzrrk'
const url=`https://${ref}.supabase.co`
const activate=process.argv.includes('--activate')
let keys
try { keys=JSON.parse(execFileSync('powershell.exe',['-NoProfile','-Command',`& node_modules/.bin/supabase.cmd projects api-keys --project-ref ${ref} --output json --reveal`],{encoding:'utf8',stdio:['ignore','pipe','pipe']})) } catch { throw new Error('Unable to obtain project credentials for the isolated live MFA check.') }
const service=keys.find(k=>k.name==='service_role')?.api_key||keys.find(k=>k.type==='secret')?.api_key
const anon=keys.find(k=>k.name==='anon')?.api_key||keys.find(k=>k.type==='publishable')?.api_key
if(!service||!anon)throw new Error('The project test credentials are unavailable.')
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}
const admin=createClient(url,service,options)
const client=createClient(url,anon,options)
const must=result=>{if(result.error)throw new Error(result.error.message);return result.data}
const codeFor=secret=>{
 const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits=''
 for(const char of secret.toUpperCase().replace(/=+$/,'')){const i=alphabet.indexOf(char);if(i<0)throw new Error('Invalid test factor encoding');bits+=i.toString(2).padStart(5,'0')}
 const bytes=[];for(let i=0;i+8<=bits.length;i+=8)bytes.push(parseInt(bits.slice(i,i+8),2))
 const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)))
 const hash=createHmac('sha1',Buffer.from(bytes)).update(counter).digest();const offset=hash.at(-1)&15
 return ((hash.readUInt32BE(offset)&0x7fffffff)%1000000).toString().padStart(6,'0')
}
let userId,changed=false,prior=false
try{
 const settings=must(await admin.from('portal_security_settings').select('require_admin_mfa').eq('id',1).single());prior=settings.require_admin_mfa
 const password=randomBytes(32).toString('base64url')+'aA1!'
 const email=`mfa-smoke-${randomUUID()}@portal.reliance.local`
 userId=must(await admin.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{role:'admin'},user_metadata:{full_name:'Temporary MFA acceptance account'}})).user.id
 must(await admin.from('profiles').update({campus:'all'}).eq('id',userId))
 must(await client.auth.signInWithPassword({email,password}))
 const passwordToken=must(await client.auth.getSession()).session.access_token
 const factor=must(await client.auth.mfa.enroll({factorType:'totp',friendlyName:'Temporary acceptance test',issuer:'Reliance acceptance'}))
 must(await client.auth.mfa.challengeAndVerify({factorId:factor.id,code:codeFor(factor.totp.secret)}))
 if(must(await client.auth.mfa.getAuthenticatorAssuranceLevel()).currentLevel!=='aal2')throw new Error('Live MFA did not upgrade the session.')
 console.log('PASS live TOTP enrolment, challenge and aal2 verification')
 if(activate&&!prior){must(await admin.from('portal_security_settings').update({require_admin_mfa:true}).eq('id',1));changed=true}
 if(activate||prior){
  const low=createClient(url,anon,{...options,global:{headers:{Authorization:`Bearer ${passwordToken}`}}})
  const lowCount=await low.from('students').select('id',{count:'exact',head:true})
  if(lowCount.error||lowCount.count!==0)throw new Error('Password-only admin record access was not denied.')
  const lowProfile=must(await low.from('profiles').select('id').eq('id',userId).single());if(!lowProfile)throw new Error('MFA setup profile is not readable.')
  let rejected=false;try{await requireAdminMfa(admin,passwordToken)}catch{rejected=true}if(!rejected)throw new Error('Password-only Edge caller was not denied.')
  const elevated=must(await client.auth.getSession()).session.access_token
  await requireAdminMfa(admin,elevated)
  const high=await client.from('students').select('id',{count:'exact',head:true});if(high.error||high.count===0)throw new Error('Verified Main Admin access did not recover.')
  console.log('PASS mandatory MFA: aal1 record/Edge denial, setup profile read and aal2 admin access')
 }
 console.log(activate?'PASS mandatory admin MFA activated':'PASS provider preflight; activation setting unchanged')
}catch(error){
 if(changed){const rollback=await admin.from('portal_security_settings').update({require_admin_mfa:prior}).eq('id',1);if(rollback.error)console.error('ERROR: MFA activation rollback requires operator attention.')}
 throw error
}finally{
 if(userId){let deleted=false;for(let attempt=0;attempt<3;attempt++){const result=await admin.auth.admin.deleteUser(userId);if(!result.error){deleted=true;break}}
  if(!deleted)throw new Error('Temporary MFA account cleanup requires operator attention.')
  console.log('PASS temporary acceptance account deleted')
 }
}
