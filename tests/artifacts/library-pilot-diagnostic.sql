begin;
do $$
declare a public.teacher_class_subject_assignments;
begin
 select * into a from public.teacher_class_subject_assignments where id='a0ca7447-4115-4de9-beff-5e2bb61e875c';
 perform set_config('request.jwt.claim.sub',a.teacher_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a.teacher_id,'role','authenticated','aal','aal1')::text,true);
end; $$;
select a.campus as allocation_campus,p.campus as profile_campus,p.active_role,p.portal_access_enabled,
 public.portal_mfa_satisfied() as mfa_satisfied,public.has_active_role('teacher') as active_teacher,
 public.library_teacher_scope(a.teacher_id,a.campus,a.class_level,a.class_stream,a.subject) as scope_allowed
from public.teacher_class_subject_assignments a join public.profiles p on p.id=a.teacher_id where a.id='a0ca7447-4115-4de9-beff-5e2bb61e875c';
do $$
declare a public.teacher_class_subject_assignments; r uuid:=gen_random_uuid(); result uuid; blocked boolean:=false;
begin
 select * into a from public.teacher_class_subject_assignments where id='a0ca7447-4115-4de9-beff-5e2bb61e875c';
 set local role authenticated;
 begin
 insert into public.learning_resources(id,teacher_id,allocation_id,campus,class_level,class_stream,subject,academic_year,term,title)
 values(r,a.teacher_id,a.id,a.campus,a.class_level,a.class_stream,a.subject,2026,3,'Rollback draft response test') returning id into result;
 exception when insufficient_privilege then blocked:=true;
 end;
 if not blocked then raise exception 'Expected INSERT RETURNING issue was not reproduced'; end if;
 insert into public.learning_resources(id,teacher_id,allocation_id,campus,class_level,class_stream,subject,academic_year,term,title)
 values(r,a.teacher_id,a.id,a.campus,a.class_level,a.class_stream,a.subject,2026,3,'Rollback draft response test');
 select id into result from public.learning_resources where id=r;
 if result is distinct from r then raise exception 'Separate read did not recover the saved draft'; end if;
 reset role;
end; $$;
select true as insert_returning_failure_reproduced,true as separate_write_and_read_passed;
rollback;
