import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { calculateGrade } from '../src/utils/GradeCalculator.js'
import { getJuniorReportBook,getSubjectsByGradeStream } from '../src/utils/CurriculumData.js'
import { calculateReportGrade } from '../src/lib/reportContext.js'
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8')
const id=n=>'70000000-0000-4000-8000-'+String(n).padStart(12,'0')

test('Historical contexts preserve class, policy, staffing, rankings and scoped access across promotions',async()=>{
 const db=new PGlite()
 try{
  await db.exec(await read('tests/fixtures/security-rpc/schema.sql'));await db.exec(await read('tests/fixtures/security-rpc/baseline.sql'))
  await db.exec(`
   create function auth.jwt() returns jsonb language sql as $$select jsonb_build_object('aal',current_setting('test.aal',true))$$;
   create table portal_security_settings(id int,require_admin_mfa boolean);insert into portal_security_settings values(1,true);
   alter table students add column date_of_birth date;
   alter table teacher_class_assignments add column created_at timestamptz default now();
   alter table coursework_assessments add column academic_year int,add column term text,add column created_at timestamptz default now();
   create table academic_records(id uuid primary key default gen_random_uuid(),student_id uuid references students,subject text,term text,year int,score numeric,grade text,term_mark numeric,exam_mark numeric,percentage numeric,recorded_by uuid,created_at timestamptz default now());
   create table junior_component_marks(id uuid primary key default gen_random_uuid(),student_id uuid references students,subject text,component text,score numeric,possible_mark numeric,term text,year int,recorded_by uuid,created_at timestamptz default now());
   create table junior_developmental_ratings(id uuid default gen_random_uuid(),student_id uuid,development_area text,rating int,term text,year int,created_at timestamptz default now());
   create table report_card_comments(id uuid default gen_random_uuid(),student_id uuid,term int,year int,created_at timestamptz default now());
   create table attendance(id uuid default gen_random_uuid(),student_id uuid,date date,status text,created_at timestamptz default now());
   create table sports_records(id uuid default gen_random_uuid(),student_id uuid,term text,year int,created_at timestamptz default now());
   create table student_awards(id uuid default gen_random_uuid(),student_id uuid,term text,academic_year int,created_at timestamptz default now());
   create table coursework_marks(id uuid default gen_random_uuid(),student_id uuid,assessment_id uuid,score numeric);
   create table fee_balances(id uuid default gen_random_uuid(),student_id uuid,academic_year int,term text,total_fees numeric,amount_paid numeric);
   create table term_settings(academic_year int,term int);
   create table report_term_fee_settings(academic_year int,term int,class_level text,amount numeric);
   create table school_record_changes(id uuid default gen_random_uuid(),source_table text,record_id uuid,operation text,actor_id uuid,actor_name text,actor_role text,learner_id uuid,learner_name text,campus text,previous_campus text,context jsonb,old_values jsonb,new_values jsonb,changed_fields text[]);
   grant select on profiles,user_roles,parent_student to authenticated;
   grant select on fee_balances,term_settings,report_term_fee_settings to authenticated;
  `)
  const helper=async(file,name)=>{const s=await read('supabase/migrations/'+file);const start=s.indexOf('create or replace function public.'+name+'(');assert.ok(start>=0);await db.exec(s.slice(start,s.indexOf('$$;',s.indexOf('as $$',start))+3))}
  for(const name of ['portal_mfa_satisfied','has_active_role','is_staff_or_admin'])await helper('20261017120000_admin_mfa_guards.sql',name)
  await helper('20261012130000_scope_campus_admin_learner_records.sql','can_manage_student_record')
  await helper('20261017100000_close_legacy_campus_access.sql','teacher_owns_student')
  for(const[n,role,campus]of [[1,'admin','all'],[2,'admin','junior'],[3,'admin','senior'],[4,'accountant','junior'],[5,'teacher','junior'],[6,'teacher','senior'],[7,'teacher','senior'],[8,'parent',null],[9,'principal','junior']]){
   await db.query('insert into profiles(id,full_name,signature_initials,role,active_role,campus)values($1,$2,$3,$4,$4,$5)',[id(n),'Original staff '+n,'S'+n,role,campus]);await db.query('insert into user_roles values($1,$2)',[id(n),role])
  }
  for(const[n,level,campus]of [[101,'Grade 1','junior'],[102,'Grade 1','junior'],[201,'Form 4','senior'],[202,'Form 4','senior'],[203,'Lower Six','senior']])
   await db.query("insert into students(id,full_name,admission_number,class_level,class_stream,campus,enrolled_year,status)values($1,$2,$3,$4,$5,$6,2026,'active')",[id(n),'Learner '+n,'26g'+n,level,n===203?'Sciences':'Blue',campus])
  await db.query('insert into parent_student values($1,$2,now()),($1,$3,now())',[id(8),id(101),id(201)])
  await db.query("insert into teacher_class_assignments(teacher_id,class_level,class_stream,campus)values($1,'Grade 1','Blue','junior')",[id(5)])
  await db.query("insert into teacher_class_subject_assignments(teacher_id,class_level,class_stream,campus,subject)values($1,'Form 4','Blue','senior','Mathematics')",[id(6)])
  await db.query("insert into school_classes(id,campus,class_level,class_stream,active)values($1,'junior','Grade 3','Blue',true),($2,'senior','Form 4','Blue',true)",[id(301),id(302)])
  for(const n of [101,102])for(const subject of getJuniorReportBook('Grade 1').subjects)for(const component of subject.components)
   await db.query("insert into junior_component_marks(student_id,subject,component,score,possible_mark,term,year)values($1,$2,$3,$4,10,'3',2026)",[id(n),subject.subject,component,n===101?9:8])
  for(const n of [201,202])for(const [subject,grade,score]of [['Mathematics','A',80],['English','E',30]])
   await db.query("insert into academic_records(student_id,subject,grade,score,term,year,recorded_by)values($1,$2,$3,$4,'3',2026,$5)",[id(n),subject,grade,score,id(6)])
  const sourceTables=['academic_records','junior_component_marks','junior_developmental_ratings','report_card_comments','attendance','sports_records','student_awards']
  for(const table of sourceTables){await db.exec(`alter table ${table} enable row level security;grant select,insert,update,delete on ${table} to authenticated;
   create policy original_manager on ${table} for all to authenticated using(can_manage_student_record(student_id)) with check(can_manage_student_record(student_id));
   create policy original_parent on ${table} for select to authenticated using(exists(select 1 from parent_student p where p.student_id=${table}.student_id and p.parent_id=auth.uid() and p.verified_at is not null));
   create policy original_teacher on ${table} for all to authenticated using(teacher_owns_student(student_id)) with check(teacher_owns_student(student_id));`)}
  const feePolicy=await read('supabase/migrations/20261002110000_current_term_fee_result_lock.sql');await db.exec(feePolicy.slice(feePolicy.indexOf('create policy block_academics_if_current_term_fee_owing')))
  const before=JSON.stringify((await db.query('select jsonb_agg(to_jsonb(s) order by id) data from students s')).rows)
  const migration=await read('supabase/migrations/20261019120000_historical_report_contexts.sql')
  await db.exec(migration);await db.exec(migration)
  assert.equal(JSON.stringify((await db.query('select jsonb_agg(to_jsonb(s) order by id) data from students s')).rows),before,'backfill never alters learners')
  let contexts=(await db.query('select * from report_period_contexts')).rows
  assert.ok(contexts.length>=5);assert.ok(contexts.every(c=>c.provenance==='legacy_inferred'&&!c.confirmed_at))
  for(const level of ['Grade 1','Form 4','Lower Six']){
   const rules=(await db.query("select report_rules_baseline($1,'Sciences') r",[level])).rows[0].r
   for(let score=0;score<=100;score+=0.5)assert.deepEqual(calculateReportGrade(score,level,rules),calculateGrade(score,level))
   if(level==='Form 4')assert.deepEqual(rules.subjects,getSubjectsByGradeStream('Form 4','Sciences'))
  }
  const oldJunior=contexts.find(c=>c.student_id===id(101)&&c.academic_year===2026&&c.term===3)
  const oldSenior=contexts.find(c=>c.student_id===id(201)&&c.academic_year===2026&&c.term===3)
  assert.equal(oldJunior.class_teacher.teacher_name,'Original staff 5')
  assert.equal(oldSenior.subject_teachers[0].teacher_name,'Original staff 6')
  const act=async(n,aal='aal2',role='authenticated')=>{await db.exec('reset role');await db.query("select set_config('test.uid',$1,false),set_config('test.aal',$2,false)",[n?id(n):'',aal]);await db.exec('set role '+role)}
  const junior=async()=> (await db.query('select * from junior_report_summary($1,3,2026)',[id(101)])).rows[0]
  const senior=async()=> (await db.query('select * from senior_report_summary($1,3,2026)',[id(201)])).rows[0]
  await act(1);const juniorBefore=await junior(),seniorBefore=await senior()
  assert.equal(juniorBefore.class_size,2);assert.equal(juniorBefore.class_position,1)
  assert.equal(seniorBefore.form_size,2);assert.equal(seniorBefore.subjects_passed,1)
  await db.exec('reset role')
  await db.query("update students set class_level='Form 1',campus='senior' where id=$1",[id(101)])
  await db.query("update students set class_level='Lower Six',class_stream='Sciences' where id=$1",[id(201)])
  await db.query("update students set status='inactive' where id in($1,$2)",[id(102),id(202)])
  await db.query("update profiles set full_name='Changed teacher',signature_initials='XX' where id in($1,$2)",[id(5),id(6)])
  await db.exec('delete from teacher_class_subject_assignments;delete from teacher_class_assignments')
  await act(1);assert.deepEqual(await junior(),juniorBefore);assert.deepEqual(await senior(),seniorBefore)
  const historical=(await db.query('select read_report_period($1,2026,3) r',[id(101)])).rows[0].r
  assert.equal(historical.context.class_level,'Grade 1');assert.equal(historical.context.campus,'junior')
  assert.equal(historical.context.class_teacher.teacher_name,'Original staff 5')
  assert.deepEqual(historical.context.report_rules.junior_book,getJuniorReportBook('Grade 1'))
  await act(2);assert.equal((await db.query('select read_report_period($1,2026,3) r',[id(101)])).rows.length,1,'old campus admin retains historical report access')
  await act(3);assert.equal((await db.query('select * from junior_component_marks where student_id=$1',[id(101)])).rows.length,0,'new campus cannot read old campus results')
  await assert.rejects(db.query('select read_report_period($1,2026,3)',[id(101)]),/unavailable/)
  await db.exec('update junior_component_marks set score=1')
  await db.exec('reset role');assert.equal((await db.query('select min(score)::int n from junior_component_marks')).rows[0].n,8,'literal bulk UPDATE cannot bypass historical campus ownership')
  await db.query("insert into teacher_class_assignments(teacher_id,class_level,class_stream,campus)values($1,'Form 1','Blue','senior')",[id(7)])
  await act(7)
  await db.query("insert into academic_records(student_id,subject,score,grade,year,term,recorded_by)values($1,'Mathematics',75,'A',2027,'1',$2)",[id(101),id(7)])
  await db.exec('reset role')
  const newContext=(await db.query('select * from report_period_contexts where student_id=$1 and academic_year=2027',[id(101)])).rows[0]
  assert.equal(newContext.class_level,'Form 1');assert.equal(newContext.campus,'senior')
  assert.equal((await db.query('select class_level from report_period_contexts where id=$1',[oldJunior.id])).rows[0].class_level,'Grade 1')
  assert.equal((await db.query('select admission_number from students where id=$1',[id(101)])).rows[0].admission_number,'26g101')
  await act(8);assert.equal((await db.query('select read_report_period($1,2026,3) r',[id(101)])).rows[0].r.context.class_level,'Grade 1','verified family retains selected-period access')
  await db.exec('reset role');await db.query("insert into fee_balances(student_id,academic_year,term,total_fees,amount_paid)values($1,2026,'Term 3',100,0)",[id(201)])
  await act(8);assert.deepEqual((await db.query('select read_report_period($1,2026,3) r',[id(201)])).rows[0].r.academics,[],'invoker bundle retains the original academic result fee gate')
  await act(2)
  const peer=contexts.find(c=>c.student_id===id(102)&&c.academic_year===2026&&c.term===3)
  await assert.rejects(db.query('select review_report_contexts($1,$2,null,false)',[[peer.id,oldSenior.id],'Attempted mixed-campus batch review']),/outside your campus/)
  await db.exec('reset role');assert.equal((await db.query('select confirmed_at from report_period_contexts where id=$1',[peer.id])).rows[0].confirmed_at,null,'mixed-campus review is atomic')
  await act(2)
  await assert.rejects(db.query('select review_report_contexts($1,$2,$3,false)',[[oldJunior.id],'Reviewed school register',id(302)]),/outside your campus/)
  const count=(await db.query('select review_report_contexts($1,$2,null,false) n',[[oldJunior.id],'Reviewed against original class register'])).rows[0].n
  assert.equal(count,1)
  await db.exec('reset role')
  const confirmed=(await db.query('select * from report_period_contexts where id=$1',[oldJunior.id])).rows[0]
  assert.ok(confirmed.confirmed_at);assert.equal(confirmed.confirmed_by,id(2));assert.equal(confirmed.class_level,'Grade 1')
  assert.ok((await db.query("select * from school_record_changes where source_table='report_period_contexts'")).rows.length)
  for(const n of [4,5,6,8,9]){await act(n);await assert.rejects(db.query('select review_report_contexts($1,$2,null,false)',[[oldJunior.id],'Attempted unauthorized confirmation']),/administrator access/)}
  await act(1,'aal1');await assert.rejects(db.query('select read_report_period($1,2026,3)',[id(101)]),/unavailable/)
  await assert.rejects(db.query('select review_report_contexts($1,$2,null,false)',[[oldJunior.id],'Password-only confirmation attempt']),/administrator access/)
  await act(0,'aal1','anon');await assert.rejects(db.query('select read_report_period($1,2026,3)',[id(101)]),/permission denied/)
  await act(1);await assert.rejects(db.exec('update report_period_contexts set class_level=\'Forged\''),/permission denied/)
  await assert.rejects(db.exec('delete from report_period_contexts'),/permission denied/)
  await assert.rejects(db.query("select capture_report_class($1,2026,3,'captured')",[id(101)]),/permission denied/)
  await db.exec('reset role')
  await assert.rejects(db.query('delete from students where id=$1',[id(101)]),/Deactivate/)
  await db.exec(migration)
  assert.equal((await db.query('select confirmed_by from report_period_contexts where id=$1',[oldJunior.id])).rows[0].confirmed_by,id(2),'reapplying migration cannot overwrite confirmations')
  await act(2)
  await db.query('select review_report_contexts($1,$2,$3,false)',[[peer.id],'Corrected against the original Grade 3 register',id(301)])
  await db.exec('reset role')
  const corrected=(await db.query('select * from report_period_contexts where id=$1',[peer.id])).rows[0]
  assert.equal(corrected.class_level,'Grade 3');assert.equal(corrected.class_teacher,null);assert.equal(corrected.staffing_verified_at,null)
  assert.deepEqual(corrected.report_rules.junior_book,getJuniorReportBook('Grade 3'))
  assert.equal((await db.query('select class_level from students where id=$1',[id(102)])).rows[0].class_level,'Grade 1','report correction cannot promote the learner')
  await db.query("insert into teacher_class_assignments(teacher_id,class_level,class_stream,campus)values($1,'Grade 3','Blue','junior')",[id(5)])
  await act(2)
  await db.query('select review_report_contexts($1,$2,null,true)',[[peer.id],'Verified the historically correct current teacher allocation'])
  await db.exec('reset role')
  const staffed=(await db.query('select * from report_period_contexts where id=$1',[peer.id])).rows[0]
  assert.equal(staffed.class_teacher.teacher_name,'Changed teacher');assert.ok(staffed.staffing_verified_at)
 }finally{await db.close()}
})
