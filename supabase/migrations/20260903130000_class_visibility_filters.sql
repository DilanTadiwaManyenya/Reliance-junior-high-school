-- Class visibility and campus-aware accounting for the Reliance portal.
-- Apply in Supabase SQL Editor after teacher_class_assignments exists.

create or replace function public.accountant_can_access_campus(student_campus text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.profiles p
    left join public.staff_accounts sa on sa.user_id = p.id
    where p.id = auth.uid()
      and p.role = 'accountant'
      and coalesce(sa.campus, p.campus, 'all') in ('all', student_campus)
  );
$$;
revoke all on function public.accountant_can_access_campus(text) from public;
grant execute on function public.accountant_can_access_campus(text) to authenticated;

-- The current teacher helper must respect every assignment, not the legacy
-- single class_level/class_stream fields on profiles.
create or replace function public.teacher_owns_student(check_student_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.teacher_class_assignments a
    join public.students s on s.id = check_student_id
    join public.profiles p on p.id = a.teacher_id
    where a.teacher_id = auth.uid()
      and p.role = 'teacher'
      and a.class_level = s.class_level
      and a.class_stream is not distinct from s.class_stream
  );
$$;
revoke all on function public.teacher_owns_student(uuid) from public;
grant execute on function public.teacher_owns_student(uuid) to authenticated;

drop policy if exists "Accountant select students" on public.students;
drop policy if exists "Accountants can view students in their campus" on public.students;
create policy "Accountants can view students in their campus"
on public.students for select to authenticated
using (public.accountant_can_access_campus(campus));

drop policy if exists "Accountant manage fees" on public.fee_balances;
drop policy if exists "Accountants can view fees in their campus" on public.fee_balances;
create policy "Accountants manage fees in their campus"
on public.fee_balances for all to authenticated
using (exists (
  select 1 from public.students s
  where s.id = fee_balances.student_id
    and public.accountant_can_access_campus(s.campus)
))
with check (exists (
  select 1 from public.students s
  where s.id = fee_balances.student_id
    and public.accountant_can_access_campus(s.campus)
));

-- Ensure the accountant account is scoped to the campus containing Form 1.
-- Form 1 currently follows the portal's junior-campus classification.
update public.profiles set campus = 'junior'
where role = 'accountant' and campus is null;
update public.staff_accounts set campus = 'junior'
where role = 'accountant' and campus is null;
