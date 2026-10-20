begin read only;
select exists(select 1 from supabase_migrations.schema_migrations where version='20261020100000') migration_recorded,
 not (select prosecdef from pg_proc where oid='public.export_learner_register(text,text,text,text)'::regprocedure) source_rls_preserved,
 (select provolatile='s' from pg_proc where oid='public.export_learner_register(text,text,text,text)'::regprocedure) stable_snapshot,
 not has_function_privilege('anon','public.export_learner_register(text,text,text,text)','EXECUTE') anonymous_denied,
 has_function_privilege('authenticated','public.export_learner_register(text,text,text,text)','EXECUTE') guarded_client_rpc;
rollback;
