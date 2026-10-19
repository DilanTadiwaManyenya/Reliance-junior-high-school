begin read only;
do $$ declare actor record; actual integer; expected integer; probes integer:=0; denied integer:=0; main_id uuid;
begin
 for actor in select distinct on(p.active_role,p.campus) p.id,p.active_role,p.campus from public.profiles p join public.user_roles r on r.user_id=p.id and r.role=p.active_role
 where p.active_role in ('admin','principal','teacher','accountant','parent') order by p.active_role,p.campus,p.id loop
  select count(*) into expected from public.reporting_periods p where
   (actor.active_role in ('admin','principal') and actor.campus in ('all',p.campus))
   or (actor.active_role in ('teacher','accountant') and actor.campus=p.campus);
  perform set_config('request.jwt.claim.sub',actor.id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor.id,'role','authenticated','aal','aal2')::text,true);
  set local role authenticated;
  select count(*) into actual from public.reporting_periods;
  if actual<>expected then raise exception 'Term metadata escaped assigned role/campus'; end if;
  if actor.active_role<>'admin' then
   begin perform public.change_reporting_period('junior',2026,3,'close','Unauthorized period change',1);raise exception 'Unauthorized management allowed';exception when others then if sqlerrm<>'Administrator campus access required' then raise;end if;end;
   denied:=denied+1;
  end if;
  reset role;probes:=probes+1;
 end loop;
 select p.id into main_id from public.profiles p where p.active_role='admin' and p.campus='all' limit 1;
 perform set_config('request.jwt.claim.sub',main_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',main_id,'role','authenticated','aal','aal1')::text,true);
 set local role authenticated;
 begin perform public.change_reporting_period('junior',2026,3,'close','Password only period change',1);raise exception 'Password-only management allowed';exception when others then if sqlerrm<>'Administrator campus access required' then raise;end if;end;
 reset role;perform set_config('test.period_scopes',probes::text,true);perform set_config('test.period_denied',denied::text,true);
end $$;
select current_setting('test.period_scopes')::integer role_campus_scopes,current_setting('test.period_denied')::integer nonadmin_management_denials,true password_only_admin_denied;
rollback;
