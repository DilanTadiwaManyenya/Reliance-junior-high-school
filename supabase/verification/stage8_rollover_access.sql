begin read only;
do $$ declare actor record; campus text; allowed boolean; passed integer:=0; denied integer:=0; main_id uuid; result jsonb;
begin
 for actor in select distinct on(p.active_role,p.campus) p.id,p.active_role,p.campus from public.profiles p
 join public.user_roles r on r.user_id=p.id and r.role=p.active_role where p.active_role in ('admin','principal','teacher','accountant','parent') order by p.active_role,p.campus,p.id loop
  foreach campus in array array['junior','senior'] loop
   allowed:=actor.active_role='admin' and coalesce(actor.campus in ('all',campus),false);
   perform set_config('request.jwt.claim.sub',actor.id::text,true);
   perform set_config('request.jwt.claims',jsonb_build_object('sub',actor.id,'role','authenticated','aal','aal2')::text,true);
   set local role authenticated;
   if allowed then
    result:=public.review_year_rollover(campus,'',0);
    if result->>'campus'<>campus or exists(select 1 from jsonb_array_elements(result->'rows')r where r->>'campus'<>campus) then raise exception 'Rollover escaped campus'; end if;
    if actor.campus<>'all' and exists(select 1 from jsonb_array_elements(result->'classes')c where c->>'campus'<>campus) then raise exception 'Destination class escaped campus'; end if;
    passed:=passed+1;
   else
    begin perform public.review_year_rollover(campus,'',0);raise exception 'Unauthorized rollover allowed';exception when others then if sqlerrm<>'Administrator campus access required' then raise; end if;end;
    begin perform public.apply_year_rollover(gen_random_uuid(),campus,'Unauthorized request','[]',false);raise exception 'Unauthorized apply allowed';exception when others then if sqlerrm<>'Administrator campus access required' then raise; end if;end;
    denied:=denied+1;
   end if;
   reset role;
  end loop;
 end loop;
 select p.id into main_id from public.profiles p where p.active_role='admin' and p.campus='all' limit 1;
 perform set_config('request.jwt.claim.sub',main_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',main_id,'role','authenticated','aal','aal1')::text,true);
 set local role authenticated;
 begin perform public.review_year_rollover('junior','',0);raise exception 'Password-only admin allowed';exception when others then if sqlerrm<>'Administrator campus access required' then raise; end if;end;
 reset role;perform set_config('test.rollover_allowed',passed::text,true);perform set_config('test.rollover_denied',denied::text,true);
end $$;
select current_setting('test.rollover_allowed')::integer authorized_scopes,current_setting('test.rollover_denied')::integer denied_scopes,true password_only_admin_denied;
rollback;
