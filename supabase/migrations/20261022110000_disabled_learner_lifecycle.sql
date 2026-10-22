begin;

-- All lifecycle changes go through this verified RPC. Direct deletes can otherwise
-- cascade away payment records because some legacy foreign keys use ON DELETE CASCADE.
drop policy if exists "Only Main Admin deletes disabled learners" on public.students;
create policy "Learners delete only through lifecycle RPC" on public.students as restrictive
  for delete to authenticated using (false);

create or replace function public.manage_disabled_learner(
  p_student uuid,
  p_action text,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  learner public.students%rowtype;
  reason_text text := left(trim(coalesce(p_reason, '')), 1000);
begin
  if auth.uid() is null or not coalesce(public.portal_mfa_satisfied(), false) then
    raise exception 'A verified signed-in session is required' using errcode = '42501';
  end if;

  select * into learner from public.students where id = p_student for update;
  if not found then raise exception 'Learner not found'; end if;
  if learner.status <> 'inactive' then raise exception 'Only disabled learners can be changed here'; end if;

  if p_action = 'activate' then
    if not coalesce(public.has_active_role('admin') and public.can_manage_school_campus(learner.campus), false) then
      raise exception 'Campus administrator access is required to reactivate this learner' using errcode = '42501';
    end if;
    update public.students
      set status = 'active', inactive_reason = null, record_disable_reason = null
      where id = learner.id;
    return;
  end if;

  if p_action <> 'delete' then raise exception 'Choose activate or delete'; end if;
  if not coalesce(public.is_main_school_admin(), false) then
    raise exception 'Only the Main Admin can permanently delete a learner' using errcode = '42501';
  end if;
  if length(reason_text) < 5 then raise exception 'A deletion reason of at least five characters is required'; end if;

  -- Never erase receipts, POS sales, uniform orders, or rollover decisions.
  if exists (select 1 from public.fee_payments where student_id = learner.id) then
    raise exception 'This learner has fee payment history. Keep the learner disabled so receipts remain attached.';
  end if;
  if exists (select 1 from public.pos_sales where student_id = learner.id) then
    raise exception 'This learner has POS transaction history. Keep the learner disabled so transactions remain attached.';
  end if;
  if exists (select 1 from public.parent_uniform_orders where student_id = learner.id) then
    raise exception 'This learner has uniform order history. Keep the learner disabled so orders remain attached.';
  end if;
  if exists (select 1 from public.year_rollover_entries where student_id = learner.id) then
    raise exception 'This learner has year rollover history. Keep the learner disabled so the decision remains attached.';
  end if;

  -- Report contexts deliberately use ON DELETE RESTRICT. For an approved permanent
  -- removal, delete the learner's report snapshots first; other academic records
  -- cascade with the learner. A retained audit event records the deletion.
  delete from public.report_period_contexts where student_id = learner.id;
  delete from public.students where id = learner.id and status = 'inactive';
  if not found then raise exception 'Learner status changed; refresh the roster and retry'; end if;
end;
$$;

revoke all on function public.manage_disabled_learner(uuid, text, text) from public, anon;
grant execute on function public.manage_disabled_learner(uuid, text, text) to authenticated;

-- The RPC returns only active learners to subject/class coursework selection.
create or replace function public.coursework_learners(requested_assessment_id uuid)
returns table (
  id uuid,
  full_name text,
  admission_number text,
  class_level text,
  class_stream text,
  campus text
)
language sql
stable
security definer
set search_path = public
as $$
  select learner.id, learner.full_name, learner.admission_number,
         learner.class_level, learner.class_stream, learner.campus
  from public.coursework_assessments assessment
  join public.students learner
    on learner.status = 'active'
   and learner.campus = assessment.campus
   and learner.class_level = assessment.class_level
   and (
     coalesce(assessment.class_stream, '') = ''
     or coalesce(learner.class_stream, '') = coalesce(assessment.class_stream, '')
   )
  where assessment.id = requested_assessment_id
    and (
      public.can_read_school_campus(assessment.campus)
      or public.teacher_has_coursework_allocation(
        assessment.teacher_id,
        assessment.class_level,
        assessment.class_stream,
        assessment.subject
      )
    )
  order by learner.class_stream, learner.full_name;
$$;
revoke all on function public.coursework_learners(uuid) from public, anon;
grant execute on function public.coursework_learners(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
