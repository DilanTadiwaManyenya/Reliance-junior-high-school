-- Read-only checks using real existing role identities. No learner rows leave SQL.
begin read only;
do $$
declare actor record; sample record; expected integer; actual integer; checked integer:=0; bundles integer:=0; data jsonb;
begin
 for actor in select distinct on(p.active_role,p.campus) p.id,p.active_role,p.campus
  from public.profiles p join public.user_roles r on r.user_id=p.id and r.role=p.active_role
  where p.active_role in ('admin','principal','accountant','teacher','parent') order by p.active_role,p.campus,p.id loop
  select count(*) into expected from public.report_period_contexts c where
   (actor.active_role in ('admin','principal') and actor.campus in ('all',c.campus))
   or (actor.active_role='accountant' and actor.campus=c.campus)
   or exists(select 1 from public.parent_student l where l.parent_id=actor.id and l.student_id=c.student_id and l.verified_at is not null);
  perform set_config('request.jwt.claim.sub',actor.id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor.id,'role','authenticated','aal','aal1')::text,true);
  set local role authenticated;
  select count(*) into actual from public.report_period_contexts;
  if actual<>expected then raise exception 'Academic batch context authority mismatch';end if;
  for sample in select student_id,academic_year,term from public.report_period_contexts order by id limit 2 loop
   data:=public.read_report_period(sample.student_id,sample.academic_year,sample.term);
   select count(*) into actual from public.academic_records where student_id=sample.student_id and coalesce(year,extract(year from created_at)::integer)=sample.academic_year and public.report_term_number(term)=sample.term;
   if jsonb_array_length(data->'academics')<>actual then raise exception 'Report export bypassed source result policies';end if;
   bundles:=bundles+1;
  end loop;
  if actor.active_role='teacher' and actor.campus in ('junior','senior') then
   select count(*) into actual from public.attendance a join public.students s on s.id=a.student_id where s.campus is distinct from actor.campus;
   if actual<>0 then raise exception 'Teacher attendance escaped campus';end if;
  end if;
  reset role;checked:=checked+1;
 end loop;
 perform set_config('test.academic_roles',checked::text,true);
 perform set_config('test.academic_bundles',bundles::text,true);
end $$;
select current_setting('test.academic_roles')::integer role_campus_scopes_checked,
 current_setting('test.academic_bundles')::integer bundles_match_authorised_source,
 (select not prosecdef from pg_proc where oid='public.read_report_period(uuid,integer,integer)'::regprocedure) report_reader_security_invoker,
 (select not require_admin_mfa from public.portal_security_settings limit 1) mfa_still_paused;
rollback;
