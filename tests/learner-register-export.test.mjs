import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {test} from 'node:test'
import {PGlite} from '@electric-sql/pglite'
import {registerCsv,registerRows,registerWorkbookData} from '../src/lib/learnerRegisterExport.js'
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8')
const id=n=>'80000000-0000-4000-8000-'+String(n).padStart(12,'0')
test('Register export returns complete snapshots under existing administrator campus RLS',async()=>{
 const db=new PGlite()
 try{
  await db.exec(await read('tests/fixtures/security-rpc/schema.sql'));await db.exec(await read('tests/fixtures/security-rpc/baseline.sql'))
  await db.exec(`create function auth.jwt() returns jsonb language sql as $$select jsonb_build_object('aal',current_setting('test.aal',true))$$;
   create table portal_security_settings(id int,require_admin_mfa boolean);insert into portal_security_settings values(1,false);
   alter table students add column date_of_birth date,add column sex text,add column parent_name text,add column parent_phone text,add column address text,add column birth_cert_no text;
   alter table students enable row level security;grant select on students to authenticated;
   create policy manager_read on students for select to authenticated using(can_manage_school_campus(campus));`)
  const helper=async(file,name)=>{const s=await read('supabase/migrations/'+file);const start=s.indexOf('create or replace function public.'+name+'(');assert.ok(start>=0);await db.exec(s.slice(start,s.indexOf('$$;',s.indexOf('as $$',start))+3))}
  for(const name of ['portal_mfa_satisfied','has_active_role'])await helper('20261017120000_admin_mfa_guards.sql',name)
  await helper('20261012160000_restrict_schoolwide_settings_to_main_admin.sql','is_main_school_admin')
  for(const[n,role,campus]of [[1,'admin','all'],[2,'admin','junior'],[3,'admin','senior'],[4,'accountant','senior'],[5,'teacher','junior'],[6,'parent',null],[7,'principal','all'],[8,'admin',null]]){
   await db.query('insert into profiles(id,role,active_role,campus)values($1,$2,$2,$3)',[id(n),role,campus]);await db.query('insert into user_roles values($1,$2)',[id(n),role])
  }
  await db.exec(`insert into students(id,full_name,admission_number,campus,class_level,class_stream,status)
   select md5('learner-'||n)::uuid,'Learner '||n,lpad(n::text,8,'0'),case when n<=2 then 'junior' else 'senior' end,
   case when n<=2 then 'Grade 1' else 'Form 1' end,case when n%2=0 then 'Blue' else 'Green' end,case when n=1 then 'inactive' else 'active' end from generate_series(1,1007)n`)
  const migration=await read('supabase/migrations/20261022150000_canonical_class_labels_across_portal.sql');await db.exec(migration)
  const before=(await db.query('select md5(jsonb_agg(to_jsonb(s) order by id)::text) hash from students s')).rows[0].hash
  const act=async(n,aal='aal1',role='authenticated')=>{await db.exec('reset role');await db.query("select set_config('test.uid',$1,false),set_config('test.aal',$2,false)",[n?id(n):'',aal]);await db.exec('set role '+role)}
  const exportRows=(scope,campus=null,level=null,stream=null)=>db.query('select export_learner_register($1,$2,$3,$4) r',[scope,campus,level,stream])
  await act(1);const all=(await exportRows('all')).rows[0].r;assert.equal(all.count,1007);assert.equal(all.learners.length,1007);assert.ok(all.generated_at)
  await act(2);const junior=(await exportRows('campus','junior')).rows[0].r;assert.equal(junior.count,2);assert.equal(junior.learners.filter(s=>s.status==='inactive').length,1)
  await assert.rejects(exportRows('all'),/Main Admin/);await assert.rejects(exportRows('campus','senior'),/outside your authority/)
  await act(3);assert.equal((await exportRows('stream','senior','Form 1','Blue')).rows[0].r.count,502)
  await assert.rejects(exportRows('stream','senior','Form 1',''),/filters/)
  await assert.rejects(exportRows('campus',null),/Main Admin|filters/)
  for(const n of [4,5,6,7]){await act(n);await assert.rejects(exportRows('all'),/Administrator access/)}
  await act(8);await assert.rejects(exportRows('all'),/Main Admin/)
  await act(0,'aal1','anon');await assert.rejects(exportRows('all'),/permission denied/)
    await db.exec('reset role');assert.equal((await db.query('select md5(jsonb_agg(to_jsonb(s) order by id)::text) hash from students s')).rows[0].hash,before)
  await db.exec(`insert into students(id,full_name,admission_number,campus,class_level,class_stream,status) values
   (md5('legacy-lower-six')::uuid,'Legacy Lower Six','LEGACY-L6','senior','Form 5','Commercials','active'),
   (md5('canonical-lower-six')::uuid,'Canonical Lower Six','CANONICAL-L6','senior','Lower Six','Commercials','active')`)
  await act(1,'aal2');const lowerSix=(await exportRows('stream','senior','Lower Six','Commercials')).rows[0].r
  assert.equal(lowerSix.count,2);assert.equal(lowerSix.level,'Lower Six');assert.deepEqual(lowerSix.learners.map(row=>row.full_name).sort(),['Canonical Lower Six','Legacy Lower Six'])
  await db.exec('reset role');await db.exec('update portal_security_settings set require_admin_mfa=true');await act(1);await assert.rejects(exportRows('all'),/Administrator access/)
  await act(1,'aal2');assert.equal((await exportRows('all')).rows[0].r.count,1009)
  await db.exec('reset role');await db.exec(`insert into students(id,full_name,admission_number,campus,class_level,status)select md5('extra-'||n)::uuid,'Extra '||n,'EX'||n,'senior','Form 2','active' from generate_series(1,20001)n`)
  await act(1,'aal2');await assert.rejects(exportRows('all'),/exceeds 20000/);assert.equal((await exportRows('class',null,'Grade 1')).rows[0].r.count,2)
 }finally{await db.close()}
})
test('Register spreadsheet exports preserve identifiers, quotes, line breaks and literal formula-like text',()=>{
 const learners=[{admission_number:'0000123',full_name:' \t=HYPERLINK("bad")',date_of_birth:'2015-10-21',parent_phone:'+263770000001',address:'A,"B"\nC',birth_cert_no:'001-002',status:'inactive'}]
 const rows=registerRows(learners,'2026-10-20T10:00:00Z');assert.equal(rows[0][3],'10');assert.equal(rows[0][0],'0000123');assert.equal(rows[0][10],'+263770000001')
 const csv=registerCsv(learners,'2026-10-20T10:00:00Z');assert.ok(csv.startsWith('\ufeff'));assert.match(csv,/"' \t=HYPERLINK\(""bad""\)"/);assert.match(csv,/"'\+263770000001"/);assert.match(csv,/"A,""B""\nC"/)
 for(const c of registerWorkbookData(learners)[1])assert.equal(c.type,String)
 assert.equal(registerWorkbookData(learners)[1][1].value,learners[0].full_name)
})
