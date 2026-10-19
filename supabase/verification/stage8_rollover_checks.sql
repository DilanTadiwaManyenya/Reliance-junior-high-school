begin read only;
select exists(select 1 from supabase_migrations.schema_migrations where version='20261019130000') migration_recorded,
 (select relrowsecurity from pg_class where oid='public.year_rollover_batches'::regclass) batches_rls,
 (select relrowsecurity from pg_class where oid='public.year_rollover_entries'::regclass) entries_rls,
 not has_function_privilege('anon','public.apply_year_rollover(uuid,text,text,jsonb,boolean)','EXECUTE') anon_apply_denied,
 not has_table_privilege('authenticated','public.year_rollover_entries','INSERT,UPDATE,DELETE') immutable_client_trail,
 not has_function_privilege('authenticated','public.rollover_source_year(uuid,integer)','EXECUTE') private_source_year,
 exists(select 1 from pg_indexes where indexname='year_rollover_once') duplicate_year_guard,
 (select count(*) from public.year_rollover_batches) batches,
 (select count(*) from public.year_rollover_entries) placements;
rollback;
