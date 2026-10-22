-- Let assigned campus accountants read parent account contact details through
-- the same campus boundary used for their school support work.
drop policy if exists "Campus managers read parent accounts" on public.parent_accounts;
create policy "Campus managers read parent accounts" on public.parent_accounts
  for select to authenticated
  using (
    public.is_main_school_admin()
    or exists (
      select 1
      from public.parent_student link
      join public.students student on student.id = link.student_id
      where link.parent_id = parent_accounts.user_id
        and (
          public.can_read_school_campus(student.campus)
          or public.accountant_can_access_campus(student.campus)
        )
    )
  );

-- Profiles have intentionally limited direct visibility. Return only the
-- parent contact and linked learner fields needed for account support.
create or replace function public.parent_account_support()
returns table (
  parent_user_id uuid,
  parent_name text,
  phone_number text,
  child_admission_number text,
  verified boolean,
  verified_at timestamptz,
  learner_name text,
  class_level text,
  class_stream text,
  campus text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null
     or not coalesce(public.portal_mfa_satisfied(), false)
     or not (public.has_active_role('admin') or public.has_active_role('accountant')) then
    raise exception 'Parent account support access required' using errcode = '42501';
  end if;

  return query
  select account.user_id, profile.full_name, account.phone_number,
    account.child_admission_number, account.verified, account.verified_at,
    student.full_name, student.class_level, student.class_stream, student.campus
  from public.parent_accounts account
  left join public.profiles profile on profile.id = account.user_id
  left join public.parent_student link on link.parent_id = account.user_id
  left join public.students student on student.id = link.student_id
  where public.is_main_school_admin()
     or (student.campus is not null and (
       (public.has_active_role('admin') and public.can_read_school_campus(student.campus))
       or (public.has_active_role('accountant') and public.accountant_can_access_campus(student.campus))
     ))
  order by profile.full_name nulls last, account.phone_number, account.child_admission_number;
end;
$$;

revoke all on function public.parent_account_support() from public, anon;
grant execute on function public.parent_account_support() to authenticated;
