begin;

create or replace function public.admission_class_code(student_campus text,student_class_level text)
returns text language sql immutable as $$
 select case
 when lower(trim(student_class_level)) in ('form 5','lower six','lower 6') then 'f5'
 when lower(trim(student_class_level)) in ('form 6','upper six','upper 6') then 'f6'
 when lower(trim(student_class_level)) ~ '^form [1-4]$' then 'f'||regexp_replace(student_class_level,'\D','','g')
 when lower(trim(student_class_level)) ~ '^grade [1-7]$' then 'g'||regexp_replace(student_class_level,'\D','','g')
 when lower(trim(student_class_level))='ecd a' then 'eA'
 when lower(trim(student_class_level))='ecd b' then 'eB'
 else 'x0' end;
$$;
create or replace function public.next_admission_number(requested_year integer,requested_campus text,requested_class_level text)
returns text language plpgsql security definer set search_path=public as $$
declare class_code text:=public.admission_class_code(requested_campus,requested_class_level); next_sequence integer;
begin
 -- Admission numbers are globally unique. Every alias emitting the same
 -- prefix must lock and inspect the same namespace, not its display label.
 perform pg_advisory_xact_lock(hashtext(requested_year::text||':'||class_code));
 select coalesce(max(right(admission_number,2)::integer),-1)+1 into next_sequence
 from public.students where admission_number ~ ('^'||right(requested_year::text,2)||class_code||'[0-9]{2}$');
 if next_sequence>99 then raise exception 'Admission sequence is full for % %',requested_year,requested_class_level; end if;
 return right(requested_year::text,2)||class_code||lpad(next_sequence::text,2,'0');
end $$;
create or replace function public.seed_fee_account_for_new_learner()
returns trigger language plpgsql security definer set search_path=public as $$
declare current_term text:='Term '||least(3,greatest(1,ceil(extract(month from current_date)/4.0)::integer))::text;
 band text:=case when new.class_level in ('ECD A','ECD B') then 'ECD'
 when lower(new.class_level) like 'grade%' then 'Grade 1-7'
 when new.class_level in ('Form 1','Form 2') then 'Form 1-2'
 when new.class_level in ('Form 3','Form 4') then 'Form 3-4'
 when new.class_level in ('Form 5','Form 6','Lower Six','Upper Six','Lower 6','Upper 6') then 'Lower & Upper Six' end;
 fee_amount numeric(12,2);
begin
 select amount into fee_amount from public.fee_structure_mapping where band_name=band and currency='USD' limit 1;
 insert into public.fee_balances(student_id,term,academic_year,currency,total_fees,amount_paid,updated_at)
 values(new.id,current_term,extract(year from current_date)::integer,'USD',coalesce(fee_amount,0),0,now())
 on conflict(student_id,term,academic_year,currency) do nothing;
 return new;
end $$;
-- Exercises enabled teacher allocations using synthetic learners/marks only.
-- Every write, admission number increment and audit entry is rolled back.

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
