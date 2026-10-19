-- Live-schema smoke test. ALL synthetic users, learners and trigger-created rows roll back.
begin;
do $$
declare learner_id uuid:=gen_random_uuid(); account_id uuid:=gen_random_uuid(); admission text;
begin
  insert into public.students(id,full_name,date_of_birth,class_level,class_stream,enrolled_year,status,campus)
    values(learner_id,'Temporary registration rollback acceptance','2012-02-29','Form 1','Red',2098,'active','senior')
    returning admission_number into admission;
  insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data,created_at)
    values(account_id,'student-'||admission||'@portal.reliance.local','{"role":"student"}',
      '{"full_name":"Temporary registration rollback acceptance"}',now());
  perform public.complete_student_registration(account_id,admission,'2012-02-29','Form 1','Red');
  if not exists(select 1 from public.students where id=learner_id and auth_user_id=account_id)
    or not exists(select 1 from public.student_accounts where user_id=account_id and verified and phone_number is null)
    or not exists(select 1 from public.profiles where id=account_id and role='student' and active_role='student' and campus='senior' and class_level='Form 1' and class_stream='Red')
    or not exists(select 1 from public.user_roles where user_id=account_id and role='student')
    or exists(select 1 from public.user_roles where user_id=account_id and role='parent') then
    raise exception 'Live registration transaction assertions failed';
  end if;
  begin
    perform public.complete_student_registration(account_id,admission,'2012-02-29','Form 1','Red');
    raise exception 'Duplicate registration unexpectedly accepted';
  exception when others then
    if sqlerrm='Duplicate registration unexpectedly accepted' then raise; end if;
  end;
end;
$$;
select true as live_schema_registration_passed, true as duplicate_claim_rejected;
rollback;
