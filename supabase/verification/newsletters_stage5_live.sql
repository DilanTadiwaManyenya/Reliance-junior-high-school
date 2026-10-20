select to_regprocedure('public.parent_school_updates(uuid,integer,integer)') is not null as parent_reader_live,
 to_regprocedure('public.save_announcement_targets(uuid,jsonb)') is not null as atomic_audience_editor_live,
 not has_function_privilege('anon','public.parent_school_updates(uuid,integer,integer)','execute') as anonymous_reader_denied,
 not has_function_privilege('anon','public.save_announcement_targets(uuid,jsonb)','execute') as anonymous_editor_denied,
 exists(select 1 from supabase_migrations.schema_migrations where version='20261021160000') as migration_recorded,
 exists(select 1 from storage.buckets where id='school-newsletters' and not public and file_size_limit=10485760) as private_10mb_bucket_live;
