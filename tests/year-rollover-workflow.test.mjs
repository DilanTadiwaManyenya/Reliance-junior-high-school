import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { calculateGrade } from '../src/utils/GradeCalculator.js'
import { getJuniorReportBook,getSubjectsByGradeStream } from '../src/utils/CurriculumData.js'
import { calculateReportGrade } from '../src/lib/reportContext.js'
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8')
const id=n=>'70000000-0000-4000-8000-'+String(n).padStart(12,'0')

test('Controlled rollover enforces reviewed history, stale guards, atomic capacity, scope and reversal',async()=>{
 const db=new PGlite()
 try{
  await db.exec(await read('tests/fixtures/security-rpc/schema.sql'));await db.exec(await read('tests/fixtures/security-rpc/baseline.sql'))
  await db.exec(`
   create function auth.jwt() returns jsonb language sql as $$select jsonb_build_object('aal',current_setting('test.aal',true))$$;
   create table portal_security_settings(id int,require_admin_mfa boolean);insert into portal_security_settings values(1,true);
   alter table students add column date_of_birth date;
   alter table school_classes add column capacity integer;
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
   grant select on students,profiles,user_roles,parent_student to authenticated;
   grant select on fee_balances,term_settings,report_term_fee_settings to authenticated;
  `)
  const helper=async(file,name)=>{const s=await read('supabase/migrations/'+file);const start=s.indexOf('create or replace function public.'+name+'(');assert.ok(start>=0);await db.exec(s.slice(start,s.indexOf('$$;',s.indexOf('as $$',start))+3))}
  for(const name of ['portal_mfa_satisfied','has_active_role','is_staff_or_admin'])await helper('20261017120000_admin_mfa_guards.sql',name)
  await helper('20261012130000_scope_campus_admin_learner_records.sql','can_manage_student_record')
  await helper('20261017100000_close_legacy_campus_access.sql','teacher_owns_student')
  await helper('20261012160000_restrict_schoolwide_settings_to_main_admin.sql','is_main_school_admin')
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

  await db.exec(await read('supabase/migrations/20261019120000_historical_report_contexts.sql'))
  await db.exec(await read('supabase/migrations/20261019130000_controlled_year_rollover.sql'))
  const act=async(n,aal='aal2',role='authenticated')=>{await db.exec('reset role');await db.query("select set_config('test.uid',$1,false),set_config('test.aal',$2,false)",[n?id(n):'',aal]);await db.exec('set role '+role)}
  await db.query("insert into school_classes(id,campus,class_level,class_stream,active,capacity)values($1,'junior','Grade 1','Blue',true,50),($2,'junior','Grade 2','Blue',true,1),($3,'senior','Lower Six','Sciences',true,50)",[id(401),id(402),id(403)])
  await act(2)
  const preview=async()=> (await db.query("select review_year_rollover('junior','',0) r")).rows[0].r
  let review=await preview();assert.equal(review.rows.length,2);assert.ok(review.rows.every(r=>!r.history_reviewed));assert.ok(review.classes.every(c=>c.campus==='junior'))
  const draft=(row,action='promote',destination=id(402))=>({student_id:row.id,source_year:row.source_year,expected_version:row.expected_version,action,destination_class_id:destination})
  const apply=(batch,decisions,preview=false,campus='junior')=>db.query('select apply_year_rollover($1,$2,$3,$4,$5) r',[id(batch),campus,'Reviewed against school placement register',JSON.stringify(decisions),preview])
  let decisions=review.rows.map(r=>draft(r))
  await assert.rejects(apply(501,[decisions[0]]),/Confirm every source-year/)
  await db.exec('reset role');await db.exec("update report_period_contexts set confirmed_at=now(),confirmed_by='70000000-0000-4000-8000-000000000002'")
  await act(2);review=await preview();decisions=review.rows.map(r=>draft(r))
  await assert.rejects(apply(501,decisions,true),/capacity exceeded/)
  await db.exec('reset role');assert.equal((await db.query("select count(*)::int n from year_rollover_batches")).rows[0].n,0)
  await act(2);const projection=(await apply(501,[decisions[0]],true)).rows[0].r;assert.equal(projection.count,1);assert.equal(projection.capacity[0].projected_occupancy,1)
  await db.exec('reset role');await db.query("update students set full_name='Corrected name' where id=$1",[decisions[0].student_id])
  await act(2);await assert.rejects(apply(501,[decisions[0]]),/changed after review/)
  review=await preview();decisions=review.rows.map(r=>draft(r));
  const learnerId=decisions[0].student_id
  const original=(await db.query('select admission_number,enrolled_year from students where id=$1',[learnerId])).rows[0]
  assert.equal((await apply(501,[decisions[0]])).rows[0].r.applied,true)
  assert.equal((await apply(501,[decisions[0]])).rows[0].r.already_applied,true,'lost success retry is idempotent')
  await assert.rejects(apply(501,[{...decisions[0],source_year:2025}]),/already been used/)
  await assert.rejects(apply(502,[decisions[0]]),/changed after review|already applied/)
  await db.exec('reset role');assert.deepEqual((await db.query('select admission_number,enrolled_year from students where id=$1',[learnerId])).rows[0],original)
  assert.equal((await db.query('select class_level from students where id=$1',[learnerId])).rows[0].class_level,'Grade 2')
  assert.equal((await db.query('select class_level from report_period_contexts where student_id=$1 and academic_year=2026 and term=3',[learnerId])).rows[0].class_level,'Grade 1')
  await act(2);await assert.rejects(db.query('select reverse_year_rollover($1,$2)',[id(501),'Verified reversal request']),/Main Admin/)
  await act(1);assert.equal((await db.query('select reverse_year_rollover($1,$2) n',[id(501),'Corrected reviewed school placement'])).rows[0].n,1)
  await db.exec('reset role');assert.equal((await db.query('select class_level from students where id=$1',[learnerId])).rows[0].class_level,'Grade 1')
  assert.equal((await db.query('select state from year_rollover_batches where id=$1',[id(501)])).rows[0].state,'reversed')
  await act(2);review=await preview();const retained=draft(review.rows.find(r=>r.id===learnerId),'retain',id(401));assert.equal((await apply(503,[retained])).rows[0].r.applied,true)
  await act(1);await db.query('select reverse_year_rollover($1,$2)',[id(503),'Reversal before new year teaching starts'])
  await db.exec('reset role')
  await db.query("insert into school_classes(id,campus,class_level,class_stream,active,capacity)values($1,'junior','Grade 7','Blue',true,50),($2,'senior','Form 1','Blue',true,50)",[id(404),id(405)])
  await db.query("update students set class_level='Grade 7' where id=$1",[learnerId])
  await act(2);review=await preview();assert.equal(review.rows.find(r=>r.id===learnerId).history_reviewed,false,'latest report class must match the roster')
  await db.exec('reset role');const contextId=(await db.query('select id from report_period_contexts where student_id=$1 and academic_year=2026 and term=3',[learnerId])).rows[0].id
  await act(2);await db.query('select review_report_contexts($1,$2,$3,false)',[[contextId],'Verified Grade 7 final-year register',id(404)])
  review=await preview();const crossing=draft(review.rows.find(r=>r.id===learnerId),'promote',id(405))
  await assert.rejects(apply(504,[crossing]),/outside your authority|Main Admin/)
  await act(1);assert.equal((await apply(504,[crossing])).rows[0].r.applied,true)
  await db.exec('reset role');assert.equal((await db.query('select campus from students where id=$1',[learnerId])).rows[0].campus,'senior')
  await act(1);await db.query('select reverse_year_rollover($1,$2)',[id(504),'School corrected cross-campus placement'])
  await act(2);review=await preview();const completing=draft(review.rows.find(r=>r.id===learnerId),'complete',null);assert.equal((await apply(505,[completing])).rows[0].r.applied,true)
  await db.exec('reset role');assert.equal((await db.query('select status from students where id=$1',[learnerId])).rows[0].status,'inactive')
  await act(1);await db.query('select reverse_year_rollover($1,$2)',[id(505),'School corrected final-year completion'])
  await act(2);review=await preview();const finalPromotion=draft(review.rows.find(r=>r.id===learnerId),'promote',id(405))
  await act(1);await apply(506,[finalPromotion]);await db.exec('reset role')
  await db.query("insert into academic_records(student_id,subject,score,year,term)values($1,'Mathematics',80,2027,'1')",[learnerId])
  await act(1);await assert.rejects(db.query('select reverse_year_rollover($1,$2)',[id(506),'Attempt to reverse after teaching starts']),/New-year reporting/)
  for(const n of [4,5,6,8,9]){await act(n);await assert.rejects(preview(),/Administrator campus/);await assert.rejects(apply(510,[retained]),/Administrator campus/)}
  await act(3);await assert.rejects(preview(),/Administrator campus/)
  await act(1,'aal1');await assert.rejects(preview(),/Administrator campus/)
  await act(0,'aal1','anon');await assert.rejects(preview(),/permission denied/)
  await act(1);await assert.rejects(db.exec("delete from year_rollover_entries"),/permission denied/)
  await db.exec('reset role');await db.exec(await read('supabase/migrations/20261019130000_controlled_year_rollover.sql'))
 }finally{await db.close()}
})
