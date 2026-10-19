import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { rolloverReviewCsv } from '../src/lib/rolloverReview.js'
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8')
const id=n=>'60000000-0000-4000-8000-'+String(n).padStart(12,'0')

test('Actual rollover preview SQL scopes, progression review, destinations, pagination and zero mutations',async()=>{
 const db=new PGlite()
 try{
  await db.exec(await read('tests/fixtures/security-rpc/schema.sql'))
  await db.exec(await read('tests/fixtures/security-rpc/baseline.sql'))
  await db.exec(`create function auth.jwt() returns jsonb language sql as $$select jsonb_build_object('aal',current_setting('test.aal',true))$$;
   create table portal_security_settings(id int,require_admin_mfa boolean);insert into portal_security_settings values(1,true);
   alter table school_classes add column capacity int default 50;
   create table fee_balances(id uuid,amount_paid numeric);insert into fee_balances values(gen_random_uuid(),42);
  `)
  const helper=async(file,name)=>{const sql=await read('supabase/migrations/'+file);const start=sql.indexOf('create or replace function public.'+name+'(');assert.ok(start>=0);await db.exec(sql.slice(start,sql.indexOf('$$;',sql.indexOf('as $$',start))+3))}
  for(const name of ['portal_mfa_satisfied','has_active_role'])await helper('20261017120000_admin_mfa_guards.sql',name)
  await helper('20261012160000_restrict_schoolwide_settings_to_main_admin.sql','is_main_school_admin')
  for(const[n,role,campus]of [[1,'admin','all'],[2,'admin','junior'],[3,'admin','senior'],[4,'teacher','junior'],[5,'accountant','junior'],[6,'parent','junior'],[7,'principal','all'],[8,'admin',null]]){
   await db.query('insert into profiles(id,role,active_role,campus)values($1,$2,$2,$3)',[id(n),role,campus]);await db.query('insert into user_roles values($1,$2)',[id(n),role])
  }
  let classId=200
  const addClass=async(level,stream,campus,active=true)=>{const uid=id(classId++);await db.query('insert into school_classes(id,campus,class_level,class_stream,active,capacity)values($1,$2,$3,$4,$5,50)',[uid,campus,level,stream,active]);return uid}
  for(const[level,stream]of [['Grade 1','Blue'],['Grade 2','Blue'],['Grade 6','White'],['Grade 7','Blue'],['ECD A',null],['ECD B',null],['Bridge',null],['Grade 4','Red'],['Grade 5','Blue']])await addClass(level,stream,'junior')
  await addClass('Grade 3','Blue','junior',false)
  for(const[level,stream]of [['Form 1','Blue'],['Form 4','Sciences'],['Lower Six','Sciences'],['Lower Six','Arts'],['Upper Six','Arts']])await addClass(level,stream,'senior')
  let learnerId=100
  const learners={}
  for(const[name,level,stream,campus,year,status]of [
   ['standard','Grade 1','Blue','junior',2026,'active'],['missing','Grade 2','Blue','junior',2026,'active'],
   ['transition','Grade 7','Blue','junior',2026,'active'],['ecd','ECD A',null,'junior',2026,'active'],
   ['unknown','Bridge',null,'junior',2026,'active'],['source','Grade 3','Red','junior',2026,'active'],
   ['stream','Grade 4','Red','junior',2026,'active'],['sixth','Form 4','Sciences','senior',2026,'active'],
   ['upper','Lower Six','Arts','senior',2026,'active'],['complete','Upper Six','Arts','senior',2026,'active'],
   ['future','Grade 1','Blue','junior',2999,'active'],['inactive','Grade 1','Blue','junior',2026,'inactive'],
  ]){const uid=id(learnerId++);learners[name]=uid;await db.query('insert into students(id,full_name,admission_number,campus,class_level,class_stream,enrolled_year,status)values($1,$2,$3,$4,$5,$6,$7,$8)',[uid,name,'ADMISSION-'+name,campus,level,stream,year,status])}
  const migration=await read('supabase/migrations/20261019110000_rollover_readiness_preview.sql');await db.exec(migration);await db.exec(migration)
  const act=async(n,aal='aal2',role='authenticated')=>{await db.exec('reset role');await db.query("select set_config('test.uid',$1,false),set_config('test.aal',$2,false)",[n?id(n):'',aal]);await db.exec('set role '+role)}
  const preview=async(campus='junior',search='',offset=0,limit=50)=>(await db.query('select preview_year_rollover($1,$2,$3,$4) data',[campus,search,offset,limit])).rows[0].data
  const fingerprint=async()=>JSON.stringify((await db.query("select (select jsonb_agg(to_jsonb(s) order by id) from students s) learners,(select jsonb_agg(to_jsonb(f)) from fee_balances f) fees")).rows)
  const before=await fingerprint()
  await act(1)
  const junior=await preview()
  assert.equal(junior.total,8)
  assert.equal(junior.rows.some(row=>row.id===learners.inactive),false)
  const find=name=>junior.rows.find(row=>row.id===learners[name])
  assert.equal(find('standard').review_status,'standard_review');assert.ok(find('standard').proposed_class_id)
  assert.equal(find('ecd').review_status,'standard_review')
  assert.equal(find('missing').review_status,'missing_target_class','inactive destination class is excluded')
  assert.equal(find('transition').review_status,'campus_transition_review');assert.equal(find('transition').proposed_class_id,null)
  assert.equal(find('unknown').review_status,'unknown_level_review')
  assert.equal(find('source').review_status,'source_class_review')
  assert.equal(find('stream').review_status,'stream_review');assert.equal(find('stream').proposed_class_id,null)
  assert.equal(find('future').review_status,'enrolment_year_review')
  assert.equal(junior.target_year,junior.source_year+1)
  const first=await preview('junior','',0,2),second=await preview('junior','',2,2)
  assert.equal(first.rows.length,2);assert.equal(second.rows.length,2)
  assert.equal(first.total,8);assert.equal(first.rows.some(row=>second.rows.some(other=>other.id===row.id)),false)
  assert.equal((await preview('junior','ADMISSION-standard')).total,1)
  assert.equal((await preview('junior','%')).total,0,'search is literal, not a wildcard or SQL fragment')
  const senior=await preview('senior')
  assert.equal(senior.rows.find(row=>row.id===learners.sixth).review_status,'sixth_form_review')
  assert.equal(senior.rows.find(row=>row.id===learners.upper).review_status,'standard_review')
  assert.equal(senior.rows.find(row=>row.id===learners.complete).review_status,'completion_review')
  await act(2)
  const scoped=await preview()
  const transition=scoped.rows.find(row=>row.id===learners.transition)
  assert.equal(transition.review_status,'main_admin_transition');assert.deepEqual(transition.candidates,[],'Junior admin cannot fetch Senior classes')
  await assert.rejects(preview('senior'),/assigned to this campus/)
  await act(3);assert.equal((await preview('senior')).total,3);await assert.rejects(preview(),/assigned to this campus/)
  for(const n of [4,5,6,7,8]){await act(n);await assert.rejects(preview(),/assigned to this campus/)}
  await act(1,'aal1');await assert.rejects(preview(),/assigned to this campus/)
  await act(0,'aal1','anon');await assert.rejects(preview(),/permission denied/)
  await act(1)
  for(const args of [['all'],['junior','',-1],['junior','',0,101],['junior','x'.repeat(121)]])await assert.rejects(preview(...args),/Invalid preview|assigned to this campus/)
  await db.exec('begin read only');assert.equal((await preview()).total,8);await db.exec('rollback;reset role')
  assert.equal(await fingerprint(),before,'preview never changes enrollment, admission identifiers or fee balances')
 }finally{await db.close()}
})

test('Review CSV preserves text, quotes and multiline fields and neutralises spreadsheet formulas',()=>{
 const csv=rolloverReviewCsv([{full_name:'=1+1',admission_number:'26g101',campus:'junior',source_level:'Grade 1',source_stream:'Blue',target_level:'Grade 2',candidates:[{class_level:'Grade 2',class_stream:'Blue, "A"\nB'}],review_status:'standard_review'}],2026,2027)
 assert.ok(csv.startsWith('\uFEFF"Source year"'))
 assert.ok(csv.includes('"\'=1+1"'))
 assert.ok(csv.includes('Blue, ""A""\nB'))
 assert.ok(csv.includes('"26g101"'))
})
