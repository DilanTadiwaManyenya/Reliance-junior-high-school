-- Expose learner-specific link state to the existing, campus-scoped parent
-- account support screen so staff can verify extra learner requests safely.
begin;

drop function if exists public.parent_account_support();

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
  campus text,
  learner_student_id uuid,
  learner_link_verified boolean
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
    coalesce(student.admission_number, account.child_admission_number), account.verified, account.verified_at,
    student.full_name, student.date_of_birth, student.class_level, student.class_stream, student.campus,
    link.student_id, link.verified_at is not null
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

create or replace function public.parent_pending_student_links()
returns table (
  student_id uuid,
  learner_name text,
  campus text,
  class_level text,
  class_stream text,
  requested_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.has_active_role('parent') then
    raise exception 'Parent account access required' using errcode = '42501';
  end if;

  return query
  select student.id, student.full_name, student.campus, student.class_level,
    student.class_stream, link.created_at
  from public.parent_student link
  join public.students student on student.id = link.student_id
  where link.parent_id = auth.uid()
    and link.verified_at is null
  order by link.created_at;
end;
$$;

revoke all on function public.parent_pending_student_links() from public, anon;
grant execute on function public.parent_pending_student_links() to authenticated;

notify pgrst, 'reload schema';
commit;
