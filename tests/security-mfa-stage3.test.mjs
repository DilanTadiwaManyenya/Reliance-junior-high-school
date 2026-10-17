import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { requireAdminMfa } from '../supabase/functions/_shared/adminMfa.js'
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8')
const id=n=>'20000000-0000-4000-8000-'+String(n).padStart(12,'0')
test('Mandatory admin MFA blocks records and admin roles until aal2 while setup remains readable',async()=>{
 const db=new PGlite()
 try{
  await db.exec(await read('tests/fixtures/security-rpc/schema.sql'))
  await db.exec(`
   create function auth.jwt() returns jsonb language sql as $$select jsonb_build_object('aal',current_setting('test.aal',true))$$;
   create schema storage;create table storage.objects(id uuid);
   alter table storage.objects enable row level security;
   create table coursework_marks(assessment_id uuid,student_id uuid);
   create table academic_records(id uuid,student_id uuid,term text,year int,grade text,exam_mark numeric,term_mark numeric,percentage numeric,score numeric);
   create table junior_component_marks(student_id uuid,subject text,component text,term text,year int,score numeric,possible_mark numeric);
   alter table teacher_class_assignments add column created_at timestamptz default now();
   alter table students enable row level security;
   create policy basic_access on students for all to authenticated using(true) with check(true);
   grant select,insert,update on students to authenticated;
   alter table profiles enable row level security;
   create policy own_profile on profiles for select to authenticated using(id=auth.uid());
   grant select on profiles,user_roles to authenticated;
  `)
  await db.exec(await read('tests/fixtures/security-rpc/baseline.sql'))
  await db.exec('grant execute on all functions in schema public to authenticated')
  for(const [n,role]of [[1,'admin'],[2,'teacher'],[3,'accountant'],[4,'parent'],[5,'principal']]){await db.query("insert into profiles(id,full_name,role,active_role,campus)values($1,'Example',$2,$2,'junior')",[id(n),role]);await db.query('insert into user_roles values($1,$2)',[id(n),role])}
  await db.query("insert into students(id,campus,class_level,status)values($1,'junior','Grade 4','active')",[id(101)])
  const sql=await read('supabase/migrations/20261017120000_admin_mfa_guards.sql')
  await db.exec(sql);await db.exec(sql)
  const act=async(n,aal)=>{await db.exec('reset role');await db.query("select set_config('test.uid',$1,false),set_config('test.aal',$2,false)",[id(n),aal]);await db.exec('set role authenticated')}
  const count=async()=>Number((await db.query('select count(*) as n from students')).rows[0].n)
  await act(1,'aal1');assert.equal(await count(),1,'rollout off preserves existing access')
  await db.exec('reset role;update portal_security_settings set require_admin_mfa=true where id=1')
  await act(1,'aal1');assert.equal(await count(),0)
  assert.equal((await db.query('select * from profiles')).rows.length,1,'own profile readable for MFA setup')
  assert.equal((await db.query("select has_active_role('admin') as ok")).rows[0].ok,false)
  await assert.rejects(db.query("insert into students(id,campus)values($1,'junior')",[id(102)]),/row-level security/)
  await assert.rejects(db.exec('update portal_security_settings set require_admin_mfa=false'),/permission denied/)
  await assert.rejects(db.query('select * from report_subject_teachers_for_student($1)',[id(101)]),/two-factor/)
  await act(1,'aal2');assert.equal(await count(),1);assert.equal((await db.query("select has_active_role('admin') as ok")).rows[0].ok,true)
  for(const n of [2,3,4,5]){await act(n,'aal1');assert.equal(await count(),1,'non-admin role unaffected '+n)}
  await db.exec('reset role');await db.query("insert into user_roles values($1,'admin')",[id(2)]);await act(2,'aal1');assert.equal(await count(),0,'admin membership requires MFA even in teacher role')
  await act(2,'aal2');assert.equal(await count(),1)
 }finally{await db.close()}
})
test('Service-role Edge guards verify signed aal2 claims and fail closed on errors',async()=>{
 const client=(required,aal='aal1',failure=null)=>({from:()=>({select:()=>({eq:()=>({single:async()=>({data:required===null?null:{require_admin_mfa:required},error:null})})})}),auth:{getClaims:async()=>({data:{claims:{aal}},error:failure})}})
 await requireAdminMfa(client(false),'token')
 await requireAdminMfa(client(true,'aal2'),'token')
 await assert.rejects(requireAdminMfa(client(true),'token'),/authenticator/)
 await assert.rejects(requireAdminMfa(client(true,'aal2',new Error('invalid signature')),'token'),/authenticator/)
 await assert.rejects(requireAdminMfa(client(null),'token'),/Unable to verify/)
})
