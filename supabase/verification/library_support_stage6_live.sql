select to_regprocedure('public.school_library_oversight(text,text,text,text,text,integer,integer)') is not null as support_reader_live,
 to_regprocedure('public.school_content_trace(text,uuid,integer,integer)') is not null as activity_reader_live,
 not has_function_privilege('anon','public.school_library_oversight(text,text,text,text,text,integer,integer)','execute') as anonymous_support_denied,
 not has_function_privilege('anon','public.school_content_trace(text,uuid,integer,integer)','execute') as anonymous_activity_denied,
 exists(select 1 from supabase_migrations.schema_migrations where version='20261021170000') as migration_recorded,
 not has_table_privilege('authenticated','public.portal_content_events','insert,update,delete') as client_audit_writes_denied;
