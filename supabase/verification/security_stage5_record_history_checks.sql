-- Read-only. Expected: installed=true, triggers=6, immutable=true, RLS/MFA=true.
select jsonb_build_object(
  'migration_applied',exists(select 1 from supabase_migrations.schema_migrations where version='20261019100000'),
  'installed',to_regclass('public.school_record_changes') is not null,
  'capture_triggers',(select count(*) from pg_trigger where tgname='school_record_change_history' and tgenabled='O' and tgrelid in
    ('public.students'::regclass,'public.academic_records'::regclass,'public.attendance'::regclass,'public.coursework_marks'::regclass,'public.junior_component_marks'::regclass,'public.junior_developmental_ratings'::regclass)),
  'rls_enabled',(select relrowsecurity from pg_class where oid='public.school_record_changes'::regclass),
  'mfa_policy',exists(select 1 from pg_policies where schemaname='public' and tablename='school_record_changes' and policyname='Admin sessions require MFA' and permissive='RESTRICTIVE'),
  'client_immutable',not has_table_privilege('authenticated','public.school_record_changes','INSERT,UPDATE,DELETE,TRUNCATE'),
  'anonymous_read',has_table_privilege('anon','public.school_record_changes','SELECT'),
  'client_capture_execute',has_function_privilege('authenticated','public.capture_school_record_change()','EXECUTE'),
  'service_history_mutation',has_table_privilege('service_role','public.school_record_changes','INSERT,UPDATE,DELETE,TRUNCATE'),
  'events_since_activation',(select count(*) from public.school_record_changes)
) as verification;
