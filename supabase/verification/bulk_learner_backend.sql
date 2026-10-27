-- READ ONLY: run in the Supabase SQL Editor for the intended project.
-- Returns schema/security metadata only; does not read learner records.
with required(signature) as (
  values ('public.correct_assigned_learner(uuid,jsonb)'),
         ('public.manage_disabled_learner(uuid,text,text)')
)
select r.signature,
       p.oid is not null as installed,
       p.prosecdef as security_definer,
       p.proconfig as function_configuration,
       case when p.oid is not null then has_function_privilege('authenticated', p.oid, 'EXECUTE') end as authenticated_can_execute,
       case when p.oid is not null then has_function_privilege('anon', p.oid, 'EXECUTE') end as anonymous_can_execute
from required r
left join pg_proc p on p.oid = to_regprocedure(r.signature);

-- Inspect actual deployed code; local migration files do not prove deployment.
select p.oid::regprocedure as signature, pg_get_functiondef(p.oid) as deployed_definition
from pg_proc p
where p.oid in (
  to_regprocedure('public.correct_assigned_learner(uuid,jsonb)'),
  to_regprocedure('public.manage_disabled_learner(uuid,text,text)')
);

-- Direct learner deletes must remain restricted to the lifecycle RPC.
select c.relrowsecurity as students_rls_enabled,
       c.relforcerowsecurity as students_force_rls
from pg_class c where c.oid = to_regclass('public.students');
select policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'students' and cmd in ('DELETE', 'ALL')
order by policyname;
