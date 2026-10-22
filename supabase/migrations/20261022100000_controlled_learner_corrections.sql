begin;
alter table public.students add column record_disable_reason text;
drop trigger if exists school_record_change_history on public.students;
create trigger school_record_change_history after insert or update or delete on public.students for each row
 execute function public.capture_school_record_change('{full_name,admission_number,date_of_birth,class_level,class_stream,enrolled_year,status,inactive_reason,record_disable_reason,sex,birth_cert_no,address,parent_phone,parent_name,campus}');
-- Existing database-authored school_record_changes trigger records before/after.
create or replace function public.correct_assigned_learner(p_student uuid,p_details jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare s public.students%rowtype; new_name text; birth date;
begin
 select * into s from public.students where id=p_student for update;
 if not found then raise exception 'Learner not found'; end if;
 if auth.uid() is null or not public.portal_mfa_satisfied() or not
   (public.can_manage_school_campus(s.campus) or public.teacher_owns_student(s.id))
 then raise exception 'You may only correct learners in your assigned class'; end if;
 if p_details ? 'disable_reason' then
   if length(trim(coalesce(p_details->>'disable_reason','')))<5 then raise exception 'Give a reason for disabling this learner'; end if;
   update public.students set status='inactive',inactive_reason=null,record_disable_reason=left(trim(p_details->>'disable_reason'),1000) where id=s.id;
 else
   new_name:=trim(p_details->>'full_name'); birth:=(p_details->>'date_of_birth')::date;
   if coalesce(length(new_name),0)<2 or length(new_name)>200 or birth is null or birth>current_date or birth<'1900-01-01' then raise exception 'Enter a valid learner name and birth date'; end if;
   update public.students set full_name=new_name,date_of_birth=birth where id=s.id;
 end if;
end $$;
revoke all on function public.correct_assigned_learner(uuid,jsonb) from public,anon;
grant execute on function public.correct_assigned_learner(uuid,jsonb) to authenticated;
-- Restrictive policy applies even if an older permissive campus-delete policy exists.
create policy "Only Main Admin deletes disabled learners" on public.students as restrictive
 for delete to authenticated using(public.is_main_school_admin() and status='inactive');
commit;
