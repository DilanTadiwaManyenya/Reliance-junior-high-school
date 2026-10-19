-- Explicit school-owner request: pause authenticator enforcement for now.
-- Existing factors, campus policies and password sign-in remain intact.
begin;
insert into public.portal_security_settings(id,require_admin_mfa) values(1,false)
on conflict(id) do update set require_admin_mfa=false;
commit;
