-- Existing live role identities, simulated JWT claims. No records changed.
begin read only;
do $$
declare actor record; actual_count integer; expected_count integer; probes integer:=0; main_id uuid; sample uuid;
begin
 for actor in select distinct on(p.active_role,p.campus) p.id,p.active_role,p.campus
  from public.profiles p join public.user_roles r on r.user_id=p.id and r.role=p.active_role
  where p.active_role in ('admin','principal','accountant','teacher','parent') order by p.active_role,p.campus,p.id loop
  select count(*) into expected_count from public.report_period_contexts c where
   (actor.active_role in ('admin','principal') and actor.campus in ('all',c.campus))
   or (actor.active_role='accountant' and actor.campus=c.campus)
   or exists(select 1 from public.parent_student l where l.parent_id=actor.id and l.student_id=c.student_id and l.verified_at is not null);
  perform set_config('request.jwt.claim.sub',actor.id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor.id,'role','authenticated','aal','aal2')::text,true);
  set local role authenticated;
  select count(*) into actual_count from public.report_period_contexts;
  if actual_count<>expected_count then raise exception 'Historical metadata escaped expected role/campus scope: %',actor.active_role; end if;
  -- Exercise the invoker bundle against real source-table grants and policies.
  select student_id into sample from public.report_period_contexts order by academic_year desc,term desc limit 1;
  if sample is not null then
   perform public.read_report_period(c.student_id,c.academic_year,c.term) from public.report_period_contexts c where c.student_id=sample;
  end if;
  reset role;probes:=probes+1;
 end loop;
 select id into main_id from public.profiles where active_role='admin' and campus='all' limit 1;
 perform set_config('request.jwt.claim.sub',main_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',main_id,'role','authenticated','aal','aal1')::text,true);
 set local role authenticated;
 if exists(select 1 from public.report_period_contexts) then raise exception 'Password-only admin accessed report contexts'; end if;
 reset role;
 perform set_config('test.history_scopes',probes::text,true);
end $$;
select current_setting('test.history_scopes')::integer role_campus_scopes_passed,true password_only_admin_denied;
rollback;
