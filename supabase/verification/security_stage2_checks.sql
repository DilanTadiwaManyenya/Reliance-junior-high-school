select jsonb_build_object(
 'migration_applied',exists(select 1 from supabase_migrations.schema_migrations where version='20261017110000'),
 'anonymous_definer_execute',(select count(*) from pg_proc p where p.pronamespace='public'::regnamespace and p.prosecdef and has_function_privilege('anon',p.oid,'EXECUTE')),
 'client_trigger_execute',(select count(*) from pg_proc p where p.pronamespace='public'::regnamespace and p.prosecdef and p.prorettype='pg_catalog.trigger'::regtype and has_function_privilege('authenticated',p.oid,'EXECUTE')),
 'client_internal_admission_execute',(select count(*) from pg_proc p where p.pronamespace='public'::regnamespace and p.proname in ('next_admission_number','verify_student_admission','verify_parent_admission') and has_function_privilege('authenticated',p.oid,'EXECUTE')),
 'definers_without_service_execute',(select count(*) from pg_proc p where p.pronamespace='public'::regnamespace and p.prosecdef and not has_function_privilege('service_role',p.oid,'EXECUTE')),
 'trusted_signup_role',position('new.raw_app_meta_data' in pg_get_functiondef('public.handle_new_user()'::regprocedure))>0,
 'campus_correction_guard',position('can_manage_school_campus(source_class.campus)' in pg_get_functiondef('public.correct_school_class(uuid,uuid)'::regprocedure))>0,
 'campus_report_guard',position('can_read_student_record(requested_student_id)' in pg_get_functiondef('public.report_subject_teachers_for_student(uuid)'::regprocedure))>0
) as verification;
