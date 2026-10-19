select jsonb_build_object(
  'migration_applied',exists(select 1 from supabase_migrations.schema_migrations where version='20261019110000'),
  'preview_installed',to_regprocedure('public.preview_year_rollover(text,text,integer,integer)') is not null,
  'anonymous_execute',has_function_privilege('anon','public.preview_year_rollover(text,text,integer,integer)','EXECUTE'),
  'authenticated_execute',has_function_privilege('authenticated','public.preview_year_rollover(text,text,integer,integer)','EXECUTE'),
  'read_only_function',(select provolatile='s' from pg_proc where oid='public.preview_year_rollover(text,text,integer,integer)'::regprocedure),
  'admin_guard',position('has_active_role(''admin'')' in pg_get_functiondef('public.preview_year_rollover(text,text,integer,integer)'::regprocedure))>0,
  'campus_guard',position('can_manage_school_campus(p_campus)' in pg_get_functiondef('public.preview_year_rollover(text,text,integer,integer)'::regprocedure))>0,
  'mfa_enabled',(select require_admin_mfa from public.portal_security_settings where id=1)
) as verification;
