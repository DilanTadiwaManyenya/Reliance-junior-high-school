-- ONE-TIME, DESTRUCTIVE maintenance: explicitly authorized pilot-data cleanup.
-- Run manually as postgres in the intended Supabase project's SQL Editor.
-- Deletes only the three matched disabled 2026 Form 1 White pilot learners,
-- their confirmed pilot fee payments, and linked learner/academic records.
-- Normal policies, authorization functions, reporting locks and audit triggers
-- stay enabled. Other financial/order/rollover history aborts the entire batch.
-- Review the returned counts after execution. Do not rerun blindly.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create temporary table pilot_cleanup_targets on commit drop as
select s.id, s.admission_number
from public.students s
where s.admission_number in ('F1-2026-032', 'F1-2026-039', 'F1-2026-046')
  and upper(trim(s.full_name)) = case s.admission_number
    when 'F1-2026-032' then 'ANGEL MUSHANYUKI'
    when 'F1-2026-039' then 'ANDREW DUBE'
    when 'F1-2026-046' then 'ALBERT MVURA' end
  and s.campus = 'senior' and s.class_level = 'Form 1'
  and s.class_stream = 'White' and s.enrolled_year = 2026
  and s.status = 'inactive'
for update of s;

create temporary table pilot_cleanup_result (
  learners_deleted integer, pilot_payments_deleted integer
) on commit drop;

do $cleanup$
declare payment_count integer; learner_count integer;
begin
  if (select count(*) from pilot_cleanup_targets) <> 3 then
    raise exception 'Expected exactly the three authorized disabled pilot learners. No cleanup performed; verify the roster and admission numbers.';
  end if;
  if exists(select 1 from public.pos_sales where student_id in (select id from pilot_cleanup_targets))
    or exists(select 1 from public.parent_uniform_orders where student_id in (select id from pilot_cleanup_targets))
    or exists(select 1 from public.year_rollover_entries where student_id in (select id from pilot_cleanup_targets)) then
    raise exception 'Sales, uniform orders or rollover history exists. Stop and review; cleanup is not authorized for that history.';
  end if;
  if exists(select 1 from public.fee_payments where student_id in (select id from pilot_cleanup_targets) and academic_year is distinct from 2026) then
    raise exception 'Payments outside 2026 exist. Stop and review the pilot scope.';
  end if;

  delete from public.fee_payments where student_id in (select id from pilot_cleanup_targets);
  get diagnostics payment_count = row_count;

  -- Reporting triggers need the learner and period context to remain present.
  -- Closed-period errors must abort and roll back payment deletion as well.
  delete from public.academic_records where student_id in (select id from pilot_cleanup_targets);
  delete from public.junior_component_marks where student_id in (select id from pilot_cleanup_targets);
  delete from public.junior_developmental_ratings where student_id in (select id from pilot_cleanup_targets);
  delete from public.report_card_comments where student_id in (select id from pilot_cleanup_targets);
  delete from public.coursework_marks where student_id in (select id from pilot_cleanup_targets);
  delete from public.report_period_contexts where student_id in (select id from pilot_cleanup_targets);
  delete from public.students where id in (select id from pilot_cleanup_targets);
  get diagnostics learner_count = row_count;
  if learner_count <> 3 then raise exception 'Learner count changed; rolling back cleanup'; end if;
  insert into pilot_cleanup_result values (learner_count, payment_count);
end;
$cleanup$;

select learners_deleted, pilot_payments_deleted from pilot_cleanup_result;
commit;

-- Run separately after COMMIT: must return zero remaining targeted learners.
select count(*) as remaining_targeted_learners
from public.students
where admission_number in ('F1-2026-032', 'F1-2026-039', 'F1-2026-046');
