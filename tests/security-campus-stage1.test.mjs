import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'
const source = name => readFile(new URL('../supabase/migrations/' + name, import.meta.url), 'utf8')
const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12,'0')
test('Campus security: actual helpers and RLS reject legacy bypasses', async () => {
 const db = new PGlite()
 try {
  await db.exec(`
   create role anon; create role authenticated;
   create schema auth;
   create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
   create table profiles(id uuid primary key,role text,active_role text,campus text);
   create table user_roles(user_id uuid,role text);
   create table staff_accounts(user_id uuid,campus text);
   create table students(id uuid primary key,campus text,class_level text,class_stream text);
   create table parent_student(parent_id uuid,student_id uuid,verified_at timestamptz);
   create table teacher_class_assignments(teacher_id uuid,campus text,class_level text,class_stream text);
   create table academic_records(id uuid primary key,student_id uuid,subject text);
   create table fee_balances(id uuid primary key,student_id uuid,amount_paid numeric);
   create function verify_student_admission(text,date) returns boolean language sql security definer as $$select false$$;
   create function verify_parent_admission(text,date) returns boolean language sql security definer as $$select false$$;
   grant usage on schema public,auth to authenticated,anon;
   grant select on parent_student,profiles,user_roles,staff_accounts,teacher_class_assignments to authenticated;
   grant select,insert,update,delete,truncate on students,academic_records,fee_balances to authenticated;
   grant truncate on students to anon;
   alter table students enable row level security;
   alter table academic_records enable row level security;
   alter table fee_balances enable row level security;
  `)
  const helpers = async (file,names) => {
   const sql=await source(file)
   for(const name of names){const start=sql.indexOf('create or replace function public.'+name+'(')>=0?sql.indexOf('create or replace function public.'+name+'('):sql.indexOf('create function public.'+name+'(');assert.ok(start>=0,name);const end=sql.indexOf('$$;',sql.indexOf('as $$',start))+3;await db.exec(sql.slice(start,end))}
  }
  await helpers('20260815130000_create_parent_portal_schema.sql',['is_staff_or_admin'])
  await helpers('20260910100000_multi_role_active_access.sql',['has_active_role'])
  await helpers('20261012120000_scope_campus_admin_core_records.sql',['can_read_school_campus','can_manage_school_campus'])
  await helpers('20261012130000_scope_campus_admin_learner_records.sql',['can_read_student_record','can_manage_student_record'])
  await helpers('20261012310000_fix_teacher_junior_enrolment_rls.sql',['teacher_can_create_student'])
  await helpers('20260903130000_class_visibility_filters.sql',['accountant_can_access_campus'])
  await helpers('20261015100000_allow_whole_form_class_teachers.sql',['teacher_owns_student'])
  for(const [n,role,campus] of [[1,'admin','all'],[2,'admin','junior'],[3,'admin','senior'],[4,'accountant','junior'],[5,'accountant','senior'],[6,'teacher','junior'],[7,'parent','junior'],[8,'principal','junior'],[9,'accountant',null],[10,'accountant','all']]){
   await db.query('insert into profiles values ($1,$2,$2,$3)',[id(n),role,campus]);await db.query('insert into user_roles values ($1,$2)',[id(n),role])
  }
  await db.exec(`
   insert into students values ('${id(101)}','junior','Grade 4',''),('${id(102)}','senior','Grade 4','');
   insert into academic_records values ('${id(201)}','${id(101)}','Maths'),('${id(202)}','${id(102)}','Maths');
   insert into fee_balances values ('${id(301)}','${id(101)}',0),('${id(302)}','${id(102)}',0);
   insert into parent_student values ('${id(7)}','${id(101)}',now());
   create policy "Parents read linked students" on students for select to authenticated using(exists(select 1 from parent_student ps where ps.student_id=students.id and ps.parent_id=auth.uid() and ps.verified_at is not null));
   create policy "Parents read linked academic" on academic_records for select to authenticated using(exists(select 1 from parent_student ps where ps.student_id=academic_records.student_id and ps.parent_id=auth.uid() and ps.verified_at is not null));
   create policy "Parents read linked fees" on fee_balances for select to authenticated using(exists(select 1 from parent_student ps where ps.student_id=fee_balances.student_id and ps.parent_id=auth.uid() and ps.verified_at is not null));
   insert into teacher_class_assignments values ('${id(6)}','junior','Grade 4','');
   create policy "Campus managers read students" on students for select to authenticated using(can_read_school_campus(campus));
   create policy "Accountants can view students in their campus" on students for select to authenticated using(accountant_can_access_campus(campus));
  `)
  await db.exec(`create policy "Admin principal read students" on students for select to authenticated using(has_active_role('admin') or has_active_role('principal'));`)
  await db.exec(`
   create policy "Teacher select assigned students" on students for select to authenticated using(teacher_owns_student(id));
   create policy "Campus managers read academic" on academic_records for select to authenticated using(can_read_student_record(student_id));
   create policy "Accountants select academic profile" on academic_records for select to authenticated using(exists(select 1 from students s where s.id=student_id and accountant_can_access_campus(s.campus)));
   create policy "Accountants select academic records" on academic_records for select to authenticated using(has_active_role('accountant'));
   create policy "Teacher select academic" on academic_records for select to authenticated using(teacher_owns_student(student_id));
   create policy "Campus managers read learner fees" on fee_balances for select to authenticated using(can_read_student_record(student_id));
   create policy "Campus admins manage learner fees" on fee_balances for all to authenticated using(can_manage_student_record(student_id)) with check(can_manage_student_record(student_id));
   create policy "Accountants manage fees in their campus" on fee_balances for all to authenticated using(exists(select 1 from students s where s.id=student_id and accountant_can_access_campus(s.campus))) with check(exists(select 1 from students s where s.id=student_id and accountant_can_access_campus(s.campus)));
   create policy "Staff and admins can select fee balances" on fee_balances for select to authenticated using(is_staff_or_admin());
   create policy "Staff and admins can insert fee balances" on fee_balances for insert to authenticated with check(is_staff_or_admin());
   create policy "Staff and admins can update fee balances" on fee_balances for update to authenticated using(is_staff_or_admin());
  `)
  const act=async n=>{await db.exec('reset role');await db.query("select set_config('test.uid',$1,false)",[id(n)]);await db.exec('set role authenticated')}
  const count=async table=>Number((await db.query('select count(*) as n from '+table)).rows[0].n)
  await act(4);assert.equal(await count('academic_records'),2,'reproduce accountant leak')
  await act(2);assert.equal(await count('students'),2,'reproduce campus admin leak')
  await db.exec('reset role')
  const migration=await source('20261017100000_close_legacy_campus_access.sql')
  await db.exec(migration);await db.exec(migration)
  for(const [n,learners,marks,fees] of [[1,2,2,2],[2,1,1,1],[3,1,1,1],[4,1,1,1],[5,1,1,1],[6,1,1,0],[7,1,1,1],[8,1,1,1],[9,0,0,0],[10,0,0,0]]){
   await act(n);assert.equal(await count('students'),learners,'learner scope '+n);assert.equal(await count('academic_records'),marks,'marks scope '+n);assert.equal(await count('fee_balances'),fees,'fee scope '+n)
  }
  for(const n of [2,4]){
   await act(n);assert.equal((await db.query('update fee_balances set amount_paid=amount_paid+1 returning id')).rows.length,1)
   await assert.rejects(db.query('insert into fee_balances values ($1,$2,0)',[id(400+n),id(102)]),/row-level security/)
  }
  await act(8);assert.equal((await db.query('update fee_balances set amount_paid=99 returning id')).rows.length,0,'principal is read-only')
  await act(7);assert.equal((await db.query('update fee_balances set amount_paid=99 returning id')).rows.length,0,'parent cannot change fees')
  await act(6);assert.equal((await db.query('update fee_balances set amount_paid=99 returning id')).rows.length,0)
  await assert.rejects(db.query('insert into students values ($1,$2,$3,$4)',[id(500),'senior','Grade 4','']),/row-level security/)
  await db.query('insert into students values ($1,$2,$3,$4)',[id(501),'junior','Grade 4',''])
  await assert.rejects(db.exec('truncate students'),/permission denied/)
  await db.exec('reset role; set role anon');await assert.rejects(db.exec('truncate students'),/permission denied/)
  await db.exec('reset role;');await db.query("update profiles set active_role='teacher' where id=$1",[id(4)]);await act(4);assert.equal(await count('fee_balances'),0,'inactive accountant denied')
  await db.exec('reset role');
  await db.query("update profiles set campus='senior' where id=$1",[id(6)]);
  await db.query("insert into teacher_class_assignments values ($1,'senior','Form 1','')",[id(6)]);
  await db.query("insert into students values ($1,'senior','Form 1','Blue')",[id(600)]);
  await act(6);assert.equal(await count('students'),1,'whole-form teacher retains own campus; stale Junior assignment denied');
  await db.exec('reset role; create table future_security_probe(id int)');
  assert.equal((await db.query("select has_table_privilege('authenticated','future_security_probe','TRUNCATE') as allowed")).rows[0].allowed,false);
  const settings=await db.query("select proconfig from pg_proc where proname in ('verify_student_admission','verify_parent_admission')");assert.equal(settings.rows.length,2);assert.ok(settings.rows.every(r=>r.proconfig.includes('search_path=public')))
 } finally {await db.close()}
})
