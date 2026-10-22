import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'
const read = path => readFile(new URL('../'+path,import.meta.url),'utf8')
const id = n => '10000000-0000-4000-8000-'+String(n).padStart(12,'0')
test('Privileged RPCs enforce campus scope and signup roles use trusted metadata', async()=>{
 const db=new PGlite()
 try {
  await db.exec(await read('tests/fixtures/security-rpc/schema.sql'))
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
  const allocationScopeMigration=await read('supabase/migrations/20261022120000_scope_coursework_learners_to_allocation_campus.sql')
  await db.exec(allocationScopeMigration);await db.exec(allocationScopeMigration)
  await db.query("insert into coursework_assessments(id,campus,class_level,class_stream,teacher_id,subject) values($1,'senior','Form 1','Blue',$2,'Maths'),($3,'senior','Upper Six','Arts',$2,'Accounting')",[id(401),id(5),id(402)])
  await db.query("insert into teacher_class_subject_assignments(teacher_id,campus,class_level,class_stream,subject) values($1,'senior','Upper Six','Arts','Accounting')",[id(5)])
  for(const n of [2,4,7]){await act(n);await assert.rejects(db.query('select * from report_subject_teachers_for_student($1)',[id(102)]),/not allowed/)}
  for(const n of [1,3,6]){await act(n);assert.equal((await db.query('select * from report_subject_teachers_for_student($1)',[id(102)])).rows.length,1)}
  await act(6);await assert.rejects(db.query('select * from report_subject_teachers_for_student($1)',[id(101)]),/not allowed/)
  await act(2);assert.equal((await db.query('select * from audit_admission_numbers()')).rows.length,1)
  await act(1);assert.equal((await db.query('select * from audit_admission_numbers()')).rows.length,2)
  await db.exec('reset role')
  await db.query("insert into students(id,full_name,admission_number,campus,class_level,class_stream,enrolled_year,status) values($1,'Arts learner','TEST-ARTS','senior','Upper Six','Arts',2026,'active'),($2,'Commercials learner','TEST-COM','senior','Upper Six','Commercials',2026,'active')",[id(103),id(104)])
  await act(5)
  assert.deepEqual((await db.query('select id from coursework_learners($1)',[id(401)])).rows.map(row=>row.id),[id(102)],'coursework learner RPC must not cross Junior campus with a reused class name')
  assert.deepEqual((await db.query('select id from coursework_learners($1)',[id(402)])).rows.map(row=>row.id),[id(103)],'stream-specific coursework learner RPC must exclude Commercials from Arts')
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
