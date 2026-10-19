-- Read-only installation checks; aggregate output only.
begin read only;
select exists(select 1 from supabase_migrations.schema_migrations where version='20261019120000') migration_recorded,
 (select relrowsecurity from pg_class where oid='public.report_period_contexts'::regclass) context_rls,
 exists(select 1 from pg_policies where tablename='report_period_contexts' and policyname='Admin sessions require MFA' and permissive='RESTRICTIVE') mfa_policy,
 not has_table_privilege('authenticated','public.report_period_contexts','INSERT,UPDATE,DELETE') no_direct_context_writes,
 not has_function_privilege('anon','public.read_report_period(uuid,integer,integer)','EXECUTE') anon_read_denied,
 not has_function_privilege('anon','public.review_report_contexts(uuid[],text,uuid,boolean)','EXECUTE') anon_review_denied,
 not has_function_privilege('authenticated','public.capture_report_class(uuid,integer,integer,text)','EXECUTE') private_capture,
 not (select prosecdef from pg_proc where oid='public.read_report_period(uuid,integer,integer)'::regprocedure) invoker_preserves_source_rls,
 (select provolatile='v' from pg_proc where oid='public.can_write_report_row(uuid,integer,integer)'::regprocedure) insert_policy_sees_trigger_snapshot,
 (select count(*) from pg_trigger where tgname='capture_report_period' and not tgisinternal) capture_trigger_count,
 exists(select 1 from pg_trigger where tgrelid='public.students'::regclass and tgname='preserve_report_class') class_guard,
 exists(select 1 from pg_trigger where tgrelid='public.coursework_assessments'::regclass and tgname='protect_marked_assessment_context') assessment_guard;
select campus,academic_year,term,count(*) contexts,
 count(*) filter(where provenance='legacy_inferred' and confirmed_at is null) awaiting_school_verification,
 count(*) filter(where confirmed_at is not null) confirmed,
 count(*) filter(where staffing_verified_at is null) staffing_review_pending
from public.report_period_contexts group by campus,academic_year,term order by campus,academic_year,term;
with periods as (
 select student_id,coalesce(year,extract(year from created_at)::integer) y,public.report_term_number(term) t from public.academic_records
 union select student_id,year,public.report_term_number(term) from public.junior_component_marks
 union select student_id,year,public.report_term_number(term) from public.junior_developmental_ratings
 union select student_id,year,term from public.report_card_comments
 union select m.student_id,a.academic_year,public.report_term_number(a.term) from public.coursework_marks m join public.coursework_assessments a on a.id=m.assessment_id
 union select student_id,extract(year from date)::integer,(extract(month from date)::integer-1)/4+1 from public.attendance
 union select student_id,coalesce(year,extract(year from created_at)::integer),public.report_term_number(term) from public.sports_records
 union select student_id,academic_year,public.report_term_number(term) from public.student_awards
)
select count(*) missing_period_contexts from periods p where not exists(select 1 from public.report_period_contexts c where c.student_id=p.student_id and c.academic_year=p.y and c.term=p.t);
rollback;
