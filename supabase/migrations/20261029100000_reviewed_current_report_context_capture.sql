-- Give campus administrators a safe repair path for learners created after
-- the historical report-context backfill. The selected current period and
-- reason are explicit, and the learner row itself is never modified.
begin;

create or replace function public.capture_reviewed_current_report_context(
  p_student uuid,
  p_year integer,
  p_term integer,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  learner public.students%rowtype;
  actor public.profiles%rowtype;
  staff jsonb;
  context_id uuid;
  reason_text text := trim(coalesce(p_reason, ''));
begin
  if auth.uid() is null
     or not coalesce(public.portal_mfa_satisfied(), false)
     or not coalesce(public.has_active_role('admin'), false) then
    raise exception 'Verified administrator access is required' using errcode = '42501';
  end if;
  if p_student is null or p_year is null or p_term is null
     or p_year <> extract(year from timezone('Africa/Harare', now()))::integer
     or p_term not between 1 and 3 then
    raise exception 'Choose a learner and a reporting period in the current academic year';
  end if;
  if length(reason_text) not between 8 and 500 then
    raise exception 'Give a review reason of 8–500 characters';
  end if;

  select * into learner from public.students where id = p_student for share;
  if not found then raise exception 'Learner not found'; end if;
  if learner.campus not in ('junior', 'senior') or learner.campus is null
     or learner.enrolled_year is null or learner.enrolled_year > p_year then
    raise exception 'Learner must have a valid campus and be enrolled by the selected year';
  end if;
  if not coalesce(public.can_manage_school_campus(learner.campus), false) then
    raise exception 'Learner is outside your campus authority' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.report_period_contexts
    where student_id = learner.id and academic_year = p_year and term = p_term
  ) then
    raise exception 'A report context already exists for this learner and period';
  end if;

  staff := public.report_staff_snapshot(learner.campus, learner.class_level, learner.class_stream);
  insert into public.report_period_contexts (
    student_id, academic_year, term, campus, class_level, class_stream,
    learner_name, admission_number, enrolled_year, active_when_captured,
    class_teacher, subject_teachers, report_rules, provenance,
    confirmed_at, confirmed_by, confirmation_reason, staffing_verified_at
  ) values (
    learner.id, p_year, p_term, learner.campus, learner.class_level, learner.class_stream,
    learner.full_name, learner.admission_number, learner.enrolled_year, learner.status = 'active',
    staff->'class_teacher', coalesce(staff->'subject_teachers', '[]'::jsonb),
    public.report_rules_for_new_period(learner.class_level, learner.class_stream), 'captured',
    now(), auth.uid(), reason_text, now()
  ) returning id into context_id;

  select * into actor from public.profiles where id = auth.uid();
  insert into public.school_record_changes (
    source_table, record_id, operation, actor_id, actor_name, actor_role,
    learner_id, learner_name, campus, previous_campus, context,
    old_values, new_values, changed_fields
  ) values (
    'report_period_contexts', context_id, 'INSERT', auth.uid(),
    coalesce(actor.full_name, 'Administrator'), coalesce(actor.active_role, actor.role, 'admin'),
    learner.id, learner.full_name, learner.campus, null,
    jsonb_build_object('academic_year', p_year, 'term', p_term, 'review_reason', reason_text),
    '{}'::jsonb,
    jsonb_build_object('class_level', learner.class_level, 'class_stream', learner.class_stream,
      'admission_number', learner.admission_number, 'provenance', 'captured',
      'confirmed_at', now(), 'confirmed_by', auth.uid()),
    array['academic_year', 'term', 'campus', 'class_level', 'class_stream', 'review_reason']
  );

  return context_id;
end;
$$;

revoke all on function public.capture_reviewed_current_report_context(uuid, integer, integer, text) from public, anon;
grant execute on function public.capture_reviewed_current_report_context(uuid, integer, integer, text) to authenticated, service_role;

commit;
