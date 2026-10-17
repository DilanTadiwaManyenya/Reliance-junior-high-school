import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'
const read = path => readFile(new URL('../'+path,import.meta.url),'utf8')
const id = n => '10000000-0000-4000-8000-'+String(n).padStart(12,'0')
test('Privileged RPCs enforce campus scope and signup roles use trusted metadata', async()=>{
 const db=new PGlite()
 try {
  await db.exec(`
   create role anon; create role authenticated; create role service_role;
   create schema auth;
   create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
   create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}',raw_app_meta_data jsonb default '{}');
   create table profiles(id uuid primary key,full_name text,phone text,role text,active_role text,campus text,signature_initials text);
   create table user_roles(user_id uuid,role text,primary key(user_id,role));
   create table staff_accounts(user_id uuid,campus text);
   create table students(id uuid primary key,full_name text,admission_number text,campus text,class_level text,class_stream text,enrolled_year int,auth_user_id uuid,status text);
   create table parent_student(parent_id uuid,student_id uuid,verified_at timestamptz);
   create table student_accounts(admission_number text);
   create table parent_accounts(child_admission_number text);
   create table school_classes(id uuid primary key,campus text,class_level text,class_stream text,active boolean,updated_at timestamptz);
   create table school_class_corrections(source_class_id uuid,target_class_id uuid,source_class_level text,source_class_stream text,target_class_level text,target_class_stream text,learners_moved int,class_assignments_moved int,subject_assignments_moved int,coursework_assessments_moved int,corrected_by uuid);
   create table teacher_class_assignments(teacher_id uuid,campus text,class_level text,class_stream text,unique(teacher_id,class_level,class_stream));
   create table teacher_class_subject_assignments(teacher_id uuid,campus text,class_level text,class_stream text,subject text,created_at timestamptz default now(),unique(teacher_id,class_level,class_stream,subject));
   create table coursework_assessments(id uuid,campus text,class_level text,class_stream text,teacher_id uuid,subject text);
   create function admission_class_code(text,text) returns text language sql as $$select 'f1'$$;
   create function next_admission_number(integer,text,text) returns text language sql security definer as $$select 'preview'$$;
   create function verify_student_admission(text,date) returns boolean language sql security definer as $$select true$$;
   create function verify_parent_admission(text,date) returns boolean language sql security definer as $$select true$$;
   grant usage on schema public,auth to anon,authenticated,service_role;
  `)
  await db.exec(await read('tests/fixtures/security-rpc/baseline.sql'))
  await db.exec('create trigger bootstrap after insert on auth.users for each row execute function handle_new_user(); grant execute on all functions in schema public to authenticated;')
  for(const [n,role,campus] of [[1,'admin','all'],[2,'admin','junior'],[3,'admin','senior'],[4,'accountant','junior'],[5,'teacher','senior'],[6,'parent',null],[7,'principal','junior'],[8,'teacher','junior']]){
   await db.query('insert into profiles(id,full_name,signature_initials,role,active_role,campus) values($1,$2,$3,$4,$4,$5)',[id(n),'Example '+n,'EX',role,campus]);await db.query('insert into user_roles values($1,$2)',[id(n),role])
  }
  for(const [n,campus] of [[101,'junior'],[102,'senior']])await db.query("insert into students values($1,$2,$3,$4,'Form 1','Blue',2026,null,'active')",[id(n),'Learner '+n,'26f101',campus])
  await db.query('insert into parent_student values($1,$2,now())',[id(6),id(102)])
  await db.query("insert into teacher_class_subject_assignments(teacher_id,campus,class_level,class_stream,subject) values($1,'senior','Form 1','','Maths')",[id(5)])
  for(const [n,campus,stream] of [[201,'junior','Blue'],[202,'junior','White'],[203,'senior','Blue'],[204,'senior','White']])await db.query("insert into school_classes values($1,$2,'Form 1',$3,true,now())",[id(n),campus,stream])
  const act=async(n,role='authenticated')=>{await db.exec('reset role');await db.query("select set_config('test.uid',$1,false)",[n?id(n):'']);await db.exec('set role '+role)}
  await act(2)
  assert.equal((await db.query('select * from report_subject_teachers_for_student($1)',[id(102)])).rows.length,1,'reproduces cross-campus report RPC')
  await act(0,'anon');assert.equal((await db.query('select verify_parent_admission($1,$2) as ok',['test','2020-01-01'])).rows[0].ok,true,'reproduces unnecessary anonymous RPC')
  await db.exec('reset role')
  const migration=await read('supabase/migrations/20261017110000_harden_privileged_rpc_access.sql')
  await db.exec(migration);await db.exec(migration)
  for(const n of [2,4,7]){await act(n);await assert.rejects(db.query('select * from report_subject_teachers_for_student($1)',[id(102)]),/not allowed/)}
  for(const n of [1,3,6]){await act(n);assert.equal((await db.query('select * from report_subject_teachers_for_student($1)',[id(102)])).rows.length,1)}
  await act(6);await assert.rejects(db.query('select * from report_subject_teachers_for_student($1)',[id(101)]),/not allowed/)
  await act(2);assert.equal((await db.query('select * from audit_admission_numbers()')).rows.length,1)
  await act(1);assert.equal((await db.query('select * from audit_admission_numbers()')).rows.length,2)
  await act(4);await assert.rejects(db.query('select * from audit_admission_numbers()'),/Only administrators/)
  await act(2);await assert.rejects(db.query('select correct_school_class($1,$2)',[id(203),id(204)]),/assigned campus/)
  await db.query('select correct_school_class($1,$2)',[id(201),id(202)])
  await act(1);await db.query('select correct_school_class($1,$2)',[id(203),id(204)])
  await act(2);assert.equal((await db.query('select preview_admission_number(2026,$1,$2) as value',['junior','Grade 4'])).rows[0].value,'26f100')
  await assert.rejects(db.query('select preview_admission_number(2026,$1,$2)',['senior','Form 1']),/Campus administrator/)
  await act(5);assert.equal((await db.query('select teacher_has_subject_student_access($1,$2) as ok',[id(102),'Maths'])).rows[0].ok,true)
  assert.equal((await db.query('select teacher_has_subject_student_access($1,$2) as ok',[id(101),'Maths'])).rows[0].ok,false)
  assert.equal((await db.query('select teacher_has_coursework_allocation($1,$2,$3,$4) as ok',[id(5),'Form 1','','Maths'])).rows[0].ok,true)
  await db.exec('reset role');await db.query("update profiles set active_role='parent' where id=$1",[id(5)]);await act(5)
  assert.equal((await db.query('select teacher_has_coursework_allocation($1,$2,$3,$4) as ok',[id(5),'Form 1','','Maths'])).rows[0].ok,false)
  await act(0,'anon');await assert.rejects(db.query('select verify_parent_admission($1,$2)',['test','2020-01-01']),/permission denied/)
  await act(2);await assert.rejects(db.query('select next_admission_number(2026,$1,$2)',['junior','Grade 4']),/permission denied/)
  await act(0,'service_role');assert.equal((await db.query('select verify_parent_admission($1,$2) as ok',['test','2020-01-01'])).rows[0].ok,true)
  await db.exec('reset role')
  for(const [n,user,app,expected] of [[301,{role:'admin'},{},'parent'],[302,{role:'teacher'},{role:'student'},'student'],[303,{}, {role:'accountant'},'accountant'],[304,{role:'admin'},{role:'invalid'},'parent']]){
   await db.query('insert into auth.users values($1,$2,$3)',[id(n),JSON.stringify(user),JSON.stringify(app)])
   const row=(await db.query('select role,active_role from profiles where id=$1',[id(n)])).rows[0];assert.equal(row.role,expected);assert.equal(row.active_role,expected)
   assert.equal((await db.query('select role from user_roles where user_id=$1',[id(n)])).rows[0].role,expected)
  }
  await db.exec('create function future_rpc_probe() returns boolean language sql as $$select true$$;')
  assert.equal((await db.query("select has_function_privilege('anon','future_rpc_probe()','EXECUTE') as ok")).rows[0].ok,false)
  assert.equal((await db.query("select has_function_privilege('service_role','future_rpc_probe()','EXECUTE') as ok")).rows[0].ok,true)
  assert.equal((await db.query("select count(*)::int as n from pg_proc where pronamespace='public'::regnamespace and prosecdef and has_function_privilege('anon',oid,'EXECUTE')")).rows[0].n,0)
  assert.equal((await db.query("select has_function_privilege('authenticated','handle_new_user()','EXECUTE') as ok")).rows[0].ok,false)
 }finally{await db.close()}
})
