-- Read-only verification: run after the focused migration and Edge deployment.
select to_regprocedure('public.complete_student_registration(uuid,text,date,text,text)') is not null as completion_installed;
select
  has_function_privilege('anon','public.complete_student_registration(uuid,text,date,text,text)','execute') as anonymous_can_complete,
  has_function_privilege('authenticated','public.complete_student_registration(uuid,text,date,text,text)','execute') as portal_user_can_complete,
  has_function_privilege('service_role','public.complete_student_registration(uuid,text,date,text,text)','execute') as service_can_complete;
-- Expected: false, false, true. Parent, teacher and admin JWTs use authenticated.
select column_name,is_nullable from information_schema.columns
where table_schema='public' and table_name='student_accounts' order by ordinal_position;
-- Class, stream and enrolled_year belong to students, not student_accounts.
select require_admin_mfa from public.portal_security_settings where id=1;
select version,name from supabase_migrations.schema_migrations where version='20261017130000';
