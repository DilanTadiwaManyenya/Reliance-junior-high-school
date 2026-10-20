-- Actual existing role identities; READ ONLY; no personal rows in output.
begin read only;
do $$ declare actor record; target text; expected integer; result jsonb; allowed boolean; passed integer:=0; denied integer:=0;
begin
 for actor in select distinct on(p.active_role,p.campus) p.id,p.active_role,p.campus from public.profiles p join public.user_roles r on r.user_id=p.id and r.role=p.active_role
 where p.active_role in ('admin','principal','accountant','teacher','parent') order by p.active_role,p.campus,p.id loop
  foreach target in array array['junior','senior'] loop
   allowed:=actor.active_role='admin' and coalesce(actor.campus in ('all',target),false);
   select count(*) into expected from public.students where campus=target;
   perform set_config('request.jwt.claim.sub',actor.id::text,true);
   perform set_config('request.jwt.claims',jsonb_build_object('sub',actor.id,'role','authenticated','aal','aal2')::text,true);
   set local role authenticated;
   if allowed then
    result:=public.export_learner_register('campus',target,null,null);
    if (result->>'count')::integer<>expected or jsonb_array_length(result->'learners')<>expected or exists(select 1 from jsonb_array_elements(result->'learners')s where s->>'campus'<>target) then raise exception 'Export count or campus escaped source policy'; end if;
    passed:=passed+1;
   else
    begin perform public.export_learner_register('campus',target,null,null);raise exception 'Unauthorized register export allowed';exception when others then
     if sqlerrm not in ('Administrator access required for learner exports','Export campus is outside your authority') then raise;end if;
    end;
    denied:=denied+1;
   end if;
   reset role;
  end loop;
 end loop;
 perform set_config('test.export_allowed',passed::text,true);perform set_config('test.export_denied',denied::text,true);
end $$;
select current_setting('test.export_allowed')::integer authorized_campus_scopes,current_setting('test.export_denied')::integer unauthorized_scopes_denied,true counts_match_source;
rollback;
