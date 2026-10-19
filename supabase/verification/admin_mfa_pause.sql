-- Read-only check of the owner-authorized temporary pause.
begin read only;
do $$ declare actor record; target text; scopes integer:=0; expected boolean;
begin
 if (select require_admin_mfa from public.portal_security_settings where id=1) is distinct from false then raise exception 'MFA requirement is not paused'; end if;
 for actor in select distinct on(p.active_role,p.campus) p.id,p.active_role,p.campus from public.profiles p join public.user_roles r on r.user_id=p.id and r.role=p.active_role
 where p.active_role in ('admin','accountant','teacher','parent','principal') order by p.active_role,p.campus,p.id loop
  perform set_config('request.jwt.claim.sub',actor.id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor.id,'role','authenticated','aal','aal1')::text,true);
  set local role authenticated;
  if not public.portal_mfa_satisfied() then raise exception 'Password-only session blocked by paused MFA'; end if;
  foreach target in array array['junior','senior'] loop
   expected:=actor.active_role='admin' and coalesce(actor.campus in ('all',target),false);
   if public.can_manage_school_campus(target) is distinct from expected then raise exception 'Existing administrator campus authority changed'; end if;
   scopes:=scopes+1;
  end loop;
  reset role;
 end loop;
 perform set_config('test.paused_mfa_scopes',scopes::text,true);
end $$;
select (select require_admin_mfa from public.portal_security_settings where id=1) authenticator_required,
 current_setting('test.paused_mfa_scopes')::integer password_only_role_campus_checks,
 not has_table_privilege('authenticated','public.portal_security_settings','UPDATE') clients_cannot_change_requirement;
rollback;
