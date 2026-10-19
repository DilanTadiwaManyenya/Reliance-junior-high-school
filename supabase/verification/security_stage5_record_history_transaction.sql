-- Live RLS probe. The learner correction and its audit event are ALWAYS rolled back.
begin;
do $$
declare main_id uuid; learner uuid; event_id uuid; original_name text; probe record; visible_count integer;
begin
  select p.id into main_id from public.profiles p join public.user_roles r on r.user_id=p.id and r.role='admin'
    where p.role='admin' and p.active_role='admin' and p.campus='all' limit 1;
  select id,full_name into learner,original_name from public.students where campus='junior' limit 1;
  if main_id is null or learner is null then raise exception 'Main Admin and Junior learner required for rollback probe'; end if;
  perform set_config('request.jwt.claim.sub',main_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',main_id,'role','authenticated','aal','aal2')::text,true);
  set local role authenticated;
  update public.students set full_name=original_name||' [rolled-back history acceptance]' where id=learner;
  select id into event_id from public.school_record_changes
    where learner_id=learner and operation='UPDATE' and actor_id=main_id
      and old_values->>'full_name'=original_name
      and new_values->>'full_name'=original_name||' [rolled-back history acceptance]'
      and campus='junior' order by created_at desc limit 1;
  if event_id is null then raise exception 'Live database did not capture the correction'; end if;
  reset role;
  for probe in select distinct on (p.role,p.campus) p.id,p.role,p.campus
    from public.profiles p join public.user_roles r on r.user_id=p.id and r.role=p.active_role
    where p.active_role=p.role and p.role in ('admin','principal','teacher','accountant','parent')
    order by p.role,p.campus,p.id loop
    perform set_config('request.jwt.claim.sub',probe.id::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',probe.id,'role','authenticated','aal','aal2')::text,true);
    set local role authenticated;
    select count(*) into visible_count from public.school_record_changes where id=event_id;
    reset role;
    if (probe.role in ('admin','principal') and probe.campus in ('all','junior')) then
      if visible_count<>1 then raise exception 'Authorised campus manager could not read correction history'; end if;
    elsif visible_count<>0 then raise exception 'Correction history escaped its role/campus scope'; end if;
  end loop;
  perform set_config('request.jwt.claim.sub',main_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',main_id,'role','authenticated','aal','aal1')::text,true);
  set local role authenticated;
  select count(*) into visible_count from public.school_record_changes where id=event_id;
  reset role;
  if visible_count<>0 then raise exception 'Password-only admin accessed correction history'; end if;
end;
$$;
select true as captured_correction,true as campus_and_role_checks_passed,true as password_only_admin_denied;
rollback;
