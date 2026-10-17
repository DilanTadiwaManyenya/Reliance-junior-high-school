select jsonb_build_object(
 'migration_applied',exists(select 1 from supabase_migrations.schema_migrations where version='20261017120000'),
 'mfa_required',(select require_admin_mfa from public.portal_security_settings where id=1),
 'tables_missing_mfa_policy',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') and c.relrowsecurity and c.relname not in ('profiles','user_roles','portal_security_settings') and not exists(select 1 from pg_policies p where p.schemaname='public' and p.tablename=c.relname and p.policyname='Admin sessions require MFA' and p.permissive='RESTRICTIVE')),
 'storage_mfa_policy',exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='Admin sessions require MFA' and permissive='RESTRICTIVE'),
 'role_helper_checks_mfa',position('portal_mfa_satisfied()' in pg_get_functiondef('public.has_active_role(text)'::regprocedure))>0,
 'temporary_profiles_remaining',(select count(*) from public.profiles where full_name='Temporary MFA acceptance account'),
 'temporary_accounts_remaining',(select count(*) from auth.users where email like 'mfa-smoke-%@portal.reliance.local')
) as verification;
