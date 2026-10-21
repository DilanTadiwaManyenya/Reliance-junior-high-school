-- Exercises enabled teacher allocations using synthetic learners/marks only.
-- Every write, admission number increment and audit entry is rolled back.
begin;
create temporary table launch_checks(area text,campus text,class_level text,passed boolean,detail text);
do $$
declare allocation record; learner uuid; assessment uuid; found_student boolean; mark_id uuid;
begin
 for allocation in select a.*,p.campus as teacher_campus from public.teacher_class_assignments a join public.profiles p on p.id=a.teacher_id
 where p.active_role='teacher' and p.portal_access_enabled is distinct from false and p.campus in ('junior','senior') loop
  begin
   learner:=gen_random_uuid();
   perform set_config('request.jwt.claim.sub',allocation.teacher_id::text,true);
   perform set_config('request.jwt.claims',jsonb_build_object('sub',allocation.teacher_id,'role','authenticated','aal','aal1')::text,true);
   set local role authenticated;
   insert into public.students(id,full_name,date_of_birth,class_level,class_stream,campus,enrolled_year,status)
   values(learner,'Launch rollback learner','2015-01-01',allocation.class_level,nullif(allocation.class_stream,''),allocation.teacher_campus,2026,'active');
   select exists(select 1 from public.students where id=learner) into found_student;
   reset role;
   if not found_student then raise exception 'Inserted learner not readable by assigned teacher'; end if;
   if not exists(select 1 from public.fee_balances where student_id=learner and currency='USD') then raise exception 'Admission fee account missing'; end if;
   insert into launch_checks values('teacher_admission',allocation.teacher_campus,allocation.class_level,true,'Assigned-class insertion, read and fee seed passed');
  exception when others then reset role; insert into launch_checks values('teacher_admission',allocation.teacher_campus,allocation.class_level,false,sqlerrm); end;
 end loop;
 for allocation in select a.*,p.campus as teacher_campus from public.teacher_class_subject_assignments a join public.profiles p on p.id=a.teacher_id
 where p.active_role='teacher' and p.portal_access_enabled is distinct from false and p.campus in ('junior','senior') and a.class_level not like 'ECD%' loop
  begin
   learner:=gen_random_uuid();assessment:=gen_random_uuid();
   reset role;
   insert into public.students(id,full_name,date_of_birth,class_level,class_stream,campus,enrolled_year,status)
   values(learner,'Launch rollback coursework learner','2015-01-01',allocation.class_level,coalesce(nullif(allocation.class_stream,''),(select class_stream from public.school_classes where class_level=allocation.class_level and campus=allocation.teacher_campus and active limit 1)),allocation.teacher_campus,2026,'active');
   perform set_config('request.jwt.claim.sub',allocation.teacher_id::text,true);
   perform set_config('request.jwt.claims',jsonb_build_object('sub',allocation.teacher_id,'role','authenticated','aal','aal1')::text,true);
   set local role authenticated;
   insert into public.coursework_assessments(id,teacher_id,campus,class_level,class_stream,subject,title,assessment_type,total_marks,assessment_date,term,academic_year)
   values(assessment,allocation.teacher_id,allocation.teacher_campus,allocation.class_level,nullif(allocation.class_stream,''),allocation.subject,'Launch rollback only','weekly',50,current_date,'3',2026);
   insert into public.coursework_marks(assessment_id,student_id,score) values(assessment,learner,0);
   update public.coursework_marks set score=1 where assessment_id=assessment and student_id=learner;
   if not exists(select 1 from public.coursework_marks where assessment_id=assessment and student_id=learner and score=1) then raise exception 'Coursework save/read failed'; end if;
   insert into public.academic_records(student_id,subject,score,term_mark,exam_mark,grade,term,year)
   values(learner,allocation.subject,1,1,1,'U','3',2026) returning id into mark_id;
   update public.academic_records set score=2,term_mark=2,exam_mark=2 where id=mark_id;
   if not exists(select 1 from public.academic_records where id=mark_id and score=2) then raise exception 'Senior markbook create/edit/read failed'; end if;
   reset role;
   insert into launch_checks values('coursework_and_markbook',allocation.teacher_campus,allocation.class_level,true,'Assessment, coursework mark and report mark create/edit/read passed');
  exception when others then reset role; insert into launch_checks values('coursework',allocation.teacher_campus,allocation.class_level,false,sqlerrm); end;
 end loop;
end $$;
do $$
declare allocation record; learner uuid; assessment uuid; rules jsonb; subject_name text; component_name text; area_name text;
begin
 for allocation in select a.*,p.campus as teacher_campus from public.teacher_class_assignments a join public.profiles p on p.id=a.teacher_id
 where p.active_role='teacher' and p.portal_access_enabled is distinct from false and p.campus='junior' loop
  begin
   learner:=gen_random_uuid();assessment:=gen_random_uuid();
   rules:=public.report_rules_baseline(allocation.class_level,allocation.class_stream);
   insert into public.students(id,full_name,date_of_birth,class_level,class_stream,campus,enrolled_year,status)
   values(learner,'Launch rollback Junior markbook','2015-01-01',allocation.class_level,nullif(allocation.class_stream,''),'junior',2026,'active');
   perform set_config('request.jwt.claim.sub',allocation.teacher_id::text,true);
   perform set_config('request.jwt.claims',jsonb_build_object('sub',allocation.teacher_id,'role','authenticated','aal','aal1')::text,true);
   if allocation.class_level like 'ECD%' then
    area_name:=rules->'junior_book'->'areas'->>0;
    if area_name is null then raise exception 'ECD blueprint missing'; end if;
    set local role authenticated;
    insert into public.junior_developmental_ratings(student_id,development_area,rating,term,year,recorded_by) values(learner,area_name,3,'3',2026,allocation.teacher_id);
    update public.junior_developmental_ratings set rating=4 where student_id=learner;
    if not exists(select 1 from public.junior_developmental_ratings where student_id=learner and rating=4) then raise exception 'ECD rating save/read failed'; end if;
    reset role;
    insert into launch_checks values('ecd_markbook','junior',allocation.class_level,true,'Developmental mark create/edit/read passed');
   else
    subject_name:=rules->'junior_book'->'subjects'->0->>'subject';
    component_name:=rules->'junior_book'->'subjects'->0->'components'->>0;
    if subject_name is null or component_name is null then raise exception 'Junior blueprint missing'; end if;
    set local role authenticated;
    insert into public.junior_component_marks(student_id,subject,component,score,possible_mark,term,year,recorded_by) values(learner,subject_name,component_name,10,50,'3',2026,allocation.teacher_id);
    update public.junior_component_marks set score=11 where student_id=learner;
    if not exists(select 1 from public.junior_component_marks where student_id=learner and score=11) then raise exception 'Junior component save/read failed'; end if;
    insert into public.coursework_assessments(id,teacher_id,campus,class_level,class_stream,subject,title,assessment_type,total_marks,assessment_date,term,academic_year,report_component)
    values(assessment,allocation.teacher_id,'junior',allocation.class_level,nullif(allocation.class_stream,''),subject_name,'Launch rollback Junior only','weekly',50,current_date,'3',2026,case when allocation.class_level ~ '^Grade [3-7]$' then component_name end);
    insert into public.coursework_marks(assessment_id,student_id,score) values(assessment,learner,10);
    update public.coursework_marks set score=11 where assessment_id=assessment and student_id=learner;
    reset role;
    insert into launch_checks values('junior_markbook_coursework','junior',allocation.class_level,true,'Component and coursework create/edit/read passed');
   end if;
  exception when others then reset role;insert into launch_checks values('junior_academics','junior',allocation.class_level,false,sqlerrm);end;
 end loop;
end $$;
select jsonb_build_object(
 'checks',(select jsonb_agg(to_jsonb(t)) from(select area,campus,count(*) as allocations,bool_and(passed) as all_passed from launch_checks group by area,campus)t),
 'failures',coalesce((select jsonb_agg(to_jsonb(t)) from(select area,campus,class_level,detail from launch_checks where not passed)t),'[]'::jsonb),
 'teachers_missing_verified_initials',(select count(*) from public.profiles where active_role='teacher' and portal_access_enabled is distinct from false and nullif(signature_initials,'') is null),
 'teachers_missing_auth_account',(select count(*) from public.profiles p left join auth.users u on u.id=p.id where p.active_role='teacher' and p.portal_access_enabled is distinct from false and u.id is null)
) as launch_results;
rollback;
