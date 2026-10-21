-- Exercises enabled teacher allocations using synthetic learners/marks only.
-- Every write, admission number increment and audit entry is rolled back.
begin;
create temporary table launch_checks(area text,campus text,class_level text,passed boolean,detail text);
do $$
declare allocation record; learner uuid; assessment uuid; found_student boolean;
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
   reset role;
   insert into launch_checks values('coursework',allocation.teacher_campus,allocation.class_level,true,'Assessment and mark create/edit/read passed');
  exception when others then reset role; insert into launch_checks values('coursework',allocation.teacher_campus,allocation.class_level,false,sqlerrm); end;
 end loop;
end $$;
select jsonb_build_object(
 'checks',(select jsonb_agg(to_jsonb(t)) from(select area,campus,count(*) as allocations,bool_and(passed) as all_passed from launch_checks group by area,campus)t),
 'failures',coalesce((select jsonb_agg(to_jsonb(t)) from(select area,campus,class_level,detail from launch_checks where not passed)t),'[]'::jsonb),
 'teachers_missing_verified_initials',(select count(*) from public.profiles where active_role='teacher' and portal_access_enabled is distinct from false and nullif(signature_initials,'') is null),
 'teachers_missing_auth_account',(select count(*) from public.profiles p left join auth.users u on u.id=p.id where p.active_role='teacher' and p.portal_access_enabled is distinct from false and u.id is null)
) as launch_results;
rollback;
