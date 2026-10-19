-- Live role/campus probes. READ ONLY; outputs aggregate checks, never learner identities.
begin read only;
do $$
declare actor record; target text; result jsonb; allowed boolean; passed integer:=0; denied integer:=0; main_id uuid;
begin
  select p.id into main_id from public.profiles p join public.user_roles r on r.user_id=p.id and r.role=p.active_role
    where p.active_role='admin' and p.campus='all' limit 1;
  for actor in select distinct on(p.active_role,p.campus) p.id,p.active_role,p.campus
    from public.profiles p join public.user_roles r on r.user_id=p.id and r.role=p.active_role
    where p.active_role in ('admin','principal','teacher','accountant','parent') order by p.active_role,p.campus,p.id loop
    foreach target in array array['junior','senior'] loop
      allowed:=actor.active_role='admin' and coalesce(actor.campus in ('all',target),false);
      perform set_config('request.jwt.claim.sub',actor.id::text,true);
      perform set_config('request.jwt.claims',jsonb_build_object('sub',actor.id,'role','authenticated','aal','aal2')::text,true);
      set local role authenticated;
      if allowed then
        result:=public.preview_year_rollover(target,'',0,100);
        if result->>'campus'<>target or exists(select 1 from jsonb_array_elements(result->'rows') item where item->>'campus'<>target) then
          raise exception 'Preview escaped source campus';
        end if;
        if actor.campus<>'all' and exists(select 1 from jsonb_array_elements(result->'rows') item,
          jsonb_array_elements(item->'candidates') candidate where candidate->>'campus'<>target) then
          raise exception 'Preview exposed another campus destination classes';
        end if;
        passed:=passed+1;
      else
        begin
          perform public.preview_year_rollover(target,'',0,1);
          raise exception 'Preview unexpectedly allowed an unassigned role or campus';
        exception when others then
          if sqlerrm not like 'Only an administrator assigned to this campus%' then raise; end if;
          denied:=denied+1;
        end;
      end if;
      reset role;
    end loop;
  end loop;
  if main_id is null then raise exception 'Main Admin is required for MFA denial probe'; end if;
  perform set_config('request.jwt.claim.sub',main_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',main_id,'role','authenticated','aal','aal1')::text,true);
  set local role authenticated;
  begin
    perform public.preview_year_rollover('junior','',0,1);
    raise exception 'Password-only Main Admin unexpectedly allowed';
  exception when others then
    if sqlerrm not like 'Only an administrator assigned to this campus%' then raise; end if;
  end;
  reset role;
  perform set_config('test.rollover_allowed',passed::text,true);
  perform set_config('test.rollover_denied',denied::text,true);
end;
$$;
select current_setting('test.rollover_allowed')::integer as allowed_scope_checks,
  current_setting('test.rollover_denied')::integer as denied_scope_checks,true as password_only_admin_denied;
rollback;
