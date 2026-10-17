select jsonb_build_object(
 'migration_applied',exists(select 1 from supabase_migrations.schema_migrations where version='20261017100000'),
 'remaining_legacy_policies',(select count(*) from pg_policies where schemaname='public' and policyname in ('Accountants select academic records','Staff and admins can insert fee balances','Staff and admins can select fee balances','Staff and admins can update fee balances','Admin principal read students')),
 'client_truncate_grants',(select count(*) from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated') and privilege_type='TRUNCATE'),
 'effective_client_truncate_tables',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') and (has_table_privilege('anon',c.oid,'TRUNCATE') or has_table_privilege('authenticated',c.oid,'TRUNCATE'))),
 'definers_without_settings',(select count(*) from pg_proc where pronamespace='public'::regnamespace and prosecdef and proconfig is null),
 'accountant_helper',pg_get_functiondef('public.accountant_can_access_campus(text)'::regprocedure),
 'teacher_helper',pg_get_functiondef('public.teacher_owns_student(uuid)'::regprocedure),
 'unassigned_admin_accounts',(select count(*) from profiles where role='admin' and campus is null),
 'unassigned_accountant_accounts',(select count(*) from profiles p left join staff_accounts sa on sa.user_id=p.id where p.role='accountant' and coalesce(sa.campus,p.campus) is null)
) as verification;
