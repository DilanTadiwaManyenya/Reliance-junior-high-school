-- Stage 2: enforce one parent per learner, keep student claims idempotent,
-- and provide an audited Main Admin account deletion path.
begin;

do $$
begin
  if exists (
    select 1
    from public.parent_student
    group by student_id
    having count(distinct parent_id) > 1
  ) then
    raise exception 'Resolve existing parent-to-learner conflicts before applying the one-parent constraint.';
  end if;
end;
$$;

create unique index if not exists parent_student_one_parent_per_student_idx
  on public.parent_student (student_id);

create or replace function public.request_parent_student_link(
  requested_admission_number text,
  requested_date_of_birth date
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  matched_student_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;
  if not coalesce(public.portal_mfa_satisfied(), false) then
    raise exception 'Admin two-factor verification required' using errcode = '42501';
  end if;
  if not public.has_active_role('parent') then
    raise exception 'Only parent accounts can request a learner link' using errcode = '42501';
  end if;

  select student.id into matched_student_id
  from public.students student
  where student.admission_number = requested_admission_number
    and student.date_of_birth = requested_date_of_birth
  for update;

  if matched_student_id is null then
    return false;
  end if;

  if exists (
    select 1 from public.parent_student link
    where link.student_id = matched_student_id
      and link.parent_id <> auth.uid()
  ) then
    raise exception 'This learner is already linked to a parent account. Contact the school office.'
      using errcode = '23505';
  end if;

  -- Additional learners can be linked to the same parent. A repeat request
  -- leaves an existing verified link unchanged; a new request remains pending.
  insert into public.parent_student (parent_id, student_id, verified_at)
  values (auth.uid(), matched_student_id, null)
  on conflict (parent_id, student_id) do nothing;

  return true;
end;
$$;

revoke all on function public.request_parent_student_link(text, date) from public, anon;
grant execute on function public.request_parent_student_link(text, date) to authenticated;

create or replace function public.delete_parent_account(target_parent_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  anonymized_audit_rows integer := 0;
  affected_rows integer := 0;
begin
  if auth.uid() is null
    or not coalesce(public.portal_mfa_satisfied(), false)
    or not public.is_main_school_admin() then
    raise exception 'Only the verified Main Admin can delete parent accounts' using errcode = '42501';
  end if;

  if target_parent_user_id is null or target_parent_user_id = auth.uid() then
    raise exception 'Choose a different parent account';
  end if;

  perform 1 from public.parent_accounts
  where user_id = target_parent_user_id
  for update;
  if not found then
    raise exception 'Parent account not found';
  end if;

  if not exists (
    select 1 from public.user_roles
    where user_id = target_parent_user_id and role = 'parent'
  ) or exists (
    select 1 from public.user_roles
    where user_id = target_parent_user_id and role <> 'parent'
  ) then
    raise exception 'Only a parent-only login can be deleted';
  end if;

  if exists (
    select 1 from public.profiles
    where id = target_parent_user_id and coalesce(is_protected, false)
  ) then
    raise exception 'Protected accounts cannot be deleted';
  end if;

  if exists (
    select 1 from public.parent_uniform_orders
    where parent_id = target_parent_user_id
  ) then
    raise exception 'This parent has uniform-order history. Keep the account so the orders remain attached.';
  end if;

  -- Preserve audit events while removing their FK to the soon-to-be-deleted
  -- profile. This update and the Auth deletion share the caller transaction.
  update public.audit_logs
  set actor_id = null
  where actor_id = target_parent_user_id;
  get diagnostics anonymized_audit_rows = row_count;

  insert into public.audit_logs (
    actor_id, action_type, description, target_table, target_id, metadata
  ) values (
    auth.uid(), 'delete',
    'Deleted parent portal account; historical actor references were anonymized.',
    'parent_accounts', target_parent_user_id,
    jsonb_build_object('anonymized_audit_rows', anonymized_audit_rows)
  );

  delete from auth.users where id = target_parent_user_id;
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception 'Parent account changed during deletion; no changes were committed';
  end if;

  return anonymized_audit_rows;
end;
$$;

revoke all on function public.delete_parent_account(uuid) from public, anon;
grant execute on function public.delete_parent_account(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
