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
join (values
  ('857f0939-6ab3-4458-9c88-f287ace0fad3'::uuid, '26f132', 'ANGEL MUSHANYUKI'),
  ('f67b347d-8fc9-488f-87d6-3eba5178e161'::uuid, '26f139', 'ANDREW DUBE'),
  ('2f732608-d3a8-4750-a73f-475d94b02d46'::uuid, '26f146', 'ALBERT MVURA')
) expected(id, admission_number, full_name)
  on s.id = expected.id and s.admission_number = expected.admission_number
  and upper(trim(s.full_name)) = expected.full_name
where s.campus = 'senior' and s.class_level = 'Form 1'
  and s.class_stream = 'White' and s.enrolled_year = 2026
  and s.status = 'inactive'
for update of s;

create temporary table pilot_cleanup_result (
  learners_deleted integer, pilot_payments_deleted integer, pilot_requests_deleted integer
) on commit drop;

do $cleanup$
declare payment_count integer; learner_count integer; request_count integer;
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

  -- Lock balances before removing their pilot retry metadata. The request FK
  -- otherwise prevents the learner -> balance cascade. No constraints are changed.
  perform 1 from public.fee_balances
    where student_id in (select id from pilot_cleanup_targets) for update;
  if exists(select 1 from public.fee_balances
    where student_id in (select id from pilot_cleanup_targets)
      and academic_year is distinct from 2026) then
    raise exception 'Fee balances outside 2026 exist. Stop and review the pilot scope.';
  end if;
  if exists(select 1 from public.fee_payment_requests r
    join public.fee_balances b on b.id = r.fee_balance_id
    where b.student_id in (select id from pilot_cleanup_targets)
      and (r.payload->>'student_id' is distinct from b.student_id::text
        or r.payload->>'year' is distinct from '2026')) then
    raise exception 'Payment request metadata does not match the pilot learner/year. Stop and review.';
  end if;
  delete from public.fee_payment_requests r
    using public.fee_balances b
    where r.fee_balance_id = b.id
      and b.student_id in (select id from pilot_cleanup_targets);
  get diagnostics request_count = row_count;

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
  insert into pilot_cleanup_result values (learner_count, payment_count, request_count);
end;
$cleanup$;

select learners_deleted, pilot_payments_deleted, pilot_requests_deleted from pilot_cleanup_result;
commit;

-- Run separately after COMMIT: must return zero remaining targeted learners.
select count(*) as remaining_targeted_learners
from public.students
where id in (
  '857f0939-6ab3-4458-9c88-f287ace0fad3'::uuid,
  'f67b347d-8fc9-488f-87d6-3eba5178e161'::uuid,
  '2f732608-d3a8-4750-a73f-475d94b02d46'::uuid
) or admission_number in ('26f132', '26f139', '26f146');
