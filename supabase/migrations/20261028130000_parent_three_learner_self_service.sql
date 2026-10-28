-- Parents can connect up to three learners without staff review.
-- Further learner links remain pending for the existing admin verification flow.
begin;

drop function if exists public.request_parent_student_link(text, date);

create function public.request_parent_student_link(
  requested_admission_number text,
  requested_date_of_birth date
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  matched_student_id uuid;
  existing_verified_at timestamptz;
  existing_link boolean := false;
  linked_count integer;
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

  -- Serialize requests for this parent so concurrent submissions cannot
  -- exceed the three-link self-service allowance.
  perform 1 from public.parent_accounts
  where user_id = auth.uid()
  for update;
  if not found then
    raise exception 'Parent account not found' using errcode = '42501';
  end if;

  select student.id into matched_student_id
  from public.students student
  where student.admission_number = requested_admission_number
    and student.date_of_birth = requested_date_of_birth
  for update;

  if matched_student_id is null then
    return null;
  end if;

  if exists (
    select 1 from public.parent_student link
    where link.student_id = matched_student_id
      and link.parent_id <> auth.uid()
  ) then
    raise exception 'This learner is already linked to a parent account. Contact the school office.'
      using errcode = '23505';
  end if;

  select true, link.verified_at into existing_link, existing_verified_at
  from public.parent_student link
  where link.parent_id = auth.uid()
    and link.student_id = matched_student_id;

  select count(*)::integer into linked_count
  from public.parent_student link
  where link.parent_id = auth.uid();

  if existing_link then
    if existing_verified_at is not null then
      return 'linked';
    end if;
    if linked_count <= 3 then
      update public.parent_student
      set verified_at = now()
      where parent_id = auth.uid() and student_id = matched_student_id;
      return 'linked';
    end if;
    return 'pending';
  end if;

  if linked_count < 3 then
    insert into public.parent_student (parent_id, student_id, verified_at)
    values (auth.uid(), matched_student_id, now());
    return 'linked';
  end if;

  insert into public.parent_student (parent_id, student_id, verified_at)
  values (auth.uid(), matched_student_id, null);
  return 'pending';
end;
$$;

revoke all on function public.request_parent_student_link(text, date) from public, anon;
grant execute on function public.request_parent_student_link(text, date) to authenticated;

notify pgrst, 'reload schema';
commit;
