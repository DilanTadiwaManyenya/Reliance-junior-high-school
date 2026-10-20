-- Read-only live role/campus checks. Emits counts only, no learner/customer data.
begin read only;
do $$
declare actor record; outside_count bigint; actual_count bigint; expected_count bigint; checked integer:=0; denied integer:=0;
begin
 for actor in select distinct on(p.active_role,p.campus) p.id,p.active_role,p.campus
  from public.profiles p join public.user_roles r on r.user_id=p.id and r.role=p.active_role
  where p.active_role in ('admin','accountant','principal','teacher','parent') order by p.active_role,p.campus,p.id loop
  select count(*) into expected_count from public.fee_payments f join public.students s on s.id=f.student_id
   where actor.campus='all' or s.campus=actor.campus;
  perform set_config('request.jwt.claim.sub',actor.id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor.id,'role','authenticated','aal','aal1')::text,true);
  set local role authenticated;
  if actor.active_role in ('admin','accountant','principal') and actor.campus in ('junior','senior') then
   select (select count(*) from public.fee_balances f join public.students s on s.id=f.student_id where s.campus is distinct from actor.campus)
        + (select count(*) from public.fee_payments f join public.students s on s.id=f.student_id where s.campus is distinct from actor.campus)
        + (select count(*) from public.school_expenses where campus is distinct from actor.campus)
        + (select count(*) from public.pos_sales where campus is distinct from actor.campus)
        + (select count(*) from public.parent_uniform_orders o join public.students s on s.id=o.student_id where s.campus is distinct from actor.campus)
   into outside_count;
   if outside_count<>0 then raise exception 'Cross-campus finance export visibility'; end if;
   checked:=checked+1;
  end if;
  if actor.active_role in ('admin','accountant','principal') and actor.campus in ('all','junior','senior') then
   select count(*) into actual_count from public.fee_payments;
   if actual_count<>expected_count then raise exception 'Fee payment ledger completeness mismatch';end if;
   checked:=checked+1;
  end if;
  if actor.active_role in ('teacher','parent') then
   select (select count(*) from public.pos_sales)+(select count(*) from public.school_expenses) into outside_count;
   if outside_count<>0 then raise exception 'Non-finance role can read operations ledger';end if;
   denied:=denied+1;
  end if;
  reset role;
 end loop;
 perform set_config('test.operations_checked',checked::text,true);
 perform set_config('test.operations_denied',denied::text,true);
end $$;
select current_setting('test.operations_checked')::integer campus_and_completeness_checks,
 current_setting('test.operations_denied')::integer non_finance_roles_denied,
 (select not require_admin_mfa from public.portal_security_settings limit 1) mfa_still_paused;
rollback;
