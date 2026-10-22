begin;

-- Extend the support-only RPC with the exact learner date of birth used by
-- parent registration. Keep the admission-number match tied to the account's
-- registered learner when a parent has more than one linked child.
drop function public.parent_account_support();

create function public.parent_account_support()
returns table (
  parent_user_id uuid,
  parent_name text,
  phone_number text,
  child_admission_number text,
  verified boolean,
  verified_at timestamptz,
  learner_name text,
  learner_date_of_birth date,
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
    student.full_name, student.date_of_birth, student.class_level,
    student.class_stream, student.campus
  from public.parent_accounts account
  left join public.profiles profile on profile.id = account.user_id
  left join lateral (
    select learner.*
    from public.parent_student link
    join public.students learner on learner.id = link.student_id
    where link.parent_id = account.user_id
      and lower(trim(learner.admission_number)) = lower(trim(account.child_admission_number))
    limit 1
  ) student on true
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
notify pgrst, 'reload schema';

commit;
