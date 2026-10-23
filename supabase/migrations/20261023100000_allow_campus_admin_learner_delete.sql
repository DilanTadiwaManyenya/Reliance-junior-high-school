begin;

-- Allow an administrator to remove a learner in their campus after a reasoned
-- confirmation. The history checks keep financially or operationally linked
-- records intact, and deletion remains restricted to this audited RPC.
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

  if p_action = 'activate' then
    if learner.status <> 'inactive' then raise exception 'Only disabled learners can be activated'; end if;
    if not coalesce(public.can_manage_school_campus(learner.campus), false) then
      raise exception 'Campus administrator access is required to reactivate this learner' using errcode = '42501';
    end if;
    update public.students
      set status = 'active', inactive_reason = null, record_disable_reason = null
      where id = learner.id;
    return;
  end if;

  if p_action <> 'delete' then raise exception 'Choose activate or delete'; end if;
  if not coalesce(public.can_manage_school_campus(learner.campus), false) then
    raise exception 'Campus administrator access is required to delete this learner' using errcode = '42501';
  end if;
  if length(reason_text) < 5 then raise exception 'A deletion reason of at least five characters is required'; end if;

  -- Keep receipts, sales, orders, and rollover decisions attached to learners.
  if exists (select 1 from public.fee_payments where student_id = learner.id) then
    raise exception 'This learner has fee payment history. Keep the learner record so receipts remain attached.';
  end if;
  if exists (select 1 from public.pos_sales where student_id = learner.id) then
    raise exception 'This learner has POS transaction history. Keep the learner record so transactions remain attached.';
  end if;
  if exists (select 1 from public.parent_uniform_orders where student_id = learner.id) then
    raise exception 'This learner has uniform order history. Keep the learner record so orders remain attached.';
  end if;
  if exists (select 1 from public.year_rollover_entries where student_id = learner.id) then
    raise exception 'This learner has year rollover history. Keep the learner record so the decision remains attached.';
  end if;

  -- Explicitly remove reporting rows while their learner and report-period
  -- context still exist. Reporting-period triggers need one of those records
  -- to resolve campus and term. Deleting contexts first makes a cascading
  -- delete lose that scope and falsely report a closed or missing period.
  delete from public.academic_records where student_id = learner.id;
  delete from public.junior_component_marks where student_id = learner.id;
  delete from public.junior_developmental_ratings where student_id = learner.id;
  delete from public.report_card_comments where student_id = learner.id;
  delete from public.coursework_marks where student_id = learner.id;

  -- Keep report contexts until guarded report rows have been removed; their FK
  -- uses RESTRICT. Existing audit triggers retain the learner deletion event.
  delete from public.report_period_contexts where student_id = learner.id;
  delete from public.students where id = learner.id;
  if not found then raise exception 'Learner changed while deleting; refresh the roster and retry'; end if;
end;
$$;

revoke all on function public.manage_disabled_learner(uuid, text, text) from public, anon;
grant execute on function public.manage_disabled_learner(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
commit;
