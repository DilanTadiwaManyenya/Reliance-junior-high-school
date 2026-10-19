-- Service-side completion only; learner, profile and membership changes commit together.
begin;
create or replace function public.complete_student_registration(
  p_user_id uuid, p_admission_number text, p_date_of_birth date,
  p_class_level text, p_class_stream text
) returns void language plpgsql security definer set search_path=public as $$
declare learner public.students%rowtype;
begin
  select * into learner from public.students
    where admission_number=p_admission_number for update;
  if not found or p_date_of_birth is null or p_date_of_birth > current_date
     or learner.status is distinct from 'active'
     or learner.auth_user_id is not null
     or learner.date_of_birth is distinct from p_date_of_birth
     or learner.class_level is distinct from p_class_level
     or coalesce(nullif(learner.class_stream,'N/A'),'') is distinct from coalesce(nullif(p_class_stream,'N/A'),'')
     or learner.campus is null or learner.campus not in ('junior','senior') then
    raise exception 'Student registration verification failed';
  end if;
  -- This routine cannot repurpose an existing parent or staff account.
  perform 1 from auth.users u where u.id=p_user_id
    and lower(u.email)=lower('student-'||p_admission_number||'@portal.reliance.local')
    and u.raw_app_meta_data->>'role'='student'
    and u.created_at > now()-interval '10 minutes';
  if not found or exists(select 1 from public.student_accounts where user_id=p_user_id or admission_number=p_admission_number)
    or exists(select 1 from public.user_roles where user_id=p_user_id and role not in ('parent','student')) then
    raise exception 'Student registration account is not eligible';
  end if;
  update public.profiles set role='student',active_role='student',full_name=learner.full_name,
    campus=learner.campus,class_level=learner.class_level,class_stream=learner.class_stream
    where id=p_user_id and role in ('parent','student');
  if not found then raise exception 'Student registration profile is not eligible'; end if;
  insert into public.user_roles(user_id,role) values(p_user_id,'student') on conflict(user_id,role) do nothing;
  delete from public.user_roles where user_id=p_user_id and role='parent';
  insert into public.student_accounts(user_id,admission_number,phone_number,verified,verified_at)
    values(p_user_id,learner.admission_number,null,true,now());
  update public.students set auth_user_id=p_user_id where id=learner.id;
end;
$$;
revoke all on function public.complete_student_registration(uuid,text,date,text,text) from public,anon,authenticated;
grant execute on function public.complete_student_registration(uuid,text,date,text,text) to service_role;
notify pgrst,'reload schema';
commit;
