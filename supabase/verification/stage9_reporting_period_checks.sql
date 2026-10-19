begin read only;
select exists(select 1 from supabase_migrations.schema_migrations where version='20261019140000') migration_recorded,
 (select count(*) from pg_trigger where tgname='a_enforce_report_period' and not tgisinternal) locked_table_paths,
 not has_function_privilege('anon','public.change_reporting_period(text,integer,integer,text,text,integer)','EXECUTE') anonymous_management_denied,
 not has_table_privilege('authenticated','public.reporting_periods','INSERT,UPDATE,DELETE') direct_term_writes_denied,
 not has_table_privilege('authenticated','public.reporting_period_events','INSERT,UPDATE,DELETE') event_trail_immutable,
 exists(select 1 from pg_indexes where indexname='reporting_period_one_current') single_current_index,
 (select count(*) from public.reporting_periods where state='closed') closed_periods,
 (select count(*) from public.reporting_periods where is_current) current_campus_periods,
 not exists(select 1 from public.reporting_periods group by campus having count(*) filter(where is_current)>1) current_scope_valid;
rollback;
