-- Stage 1: retire permissive legacy access; reuse existing role/campus helpers.
begin;
drop policy if exists "Accountants select academic records" on public.academic_records;
drop policy if exists "Staff and admins can insert fee balances" on public.fee_balances;
drop policy if exists "Staff and admins can select fee balances" on public.fee_balances;
drop policy if exists "Staff and admins can update fee balances" on public.fee_balances;
drop policy if exists "Admin principal read students" on public.students;

-- No missing/all-campus fallback for accountants. Main Admin access remains in
-- can_manage_school_campus/can_read_school_campus, not in this helper.
create or replace function public.accountant_can_access_campus(student_campus text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_active_role('accountant') and exists (
    select 1 from public.profiles p
    left join public.staff_accounts sa on sa.user_id = p.id
    where p.id = auth.uid() and p.role = 'accountant'
      and coalesce(sa.campus, p.campus) in ('junior', 'senior')
      and coalesce(sa.campus, p.campus) = student_campus
  );
$$;
revoke all on function public.accountant_can_access_campus(text) from public, anon;
grant execute on function public.accountant_can_access_campus(text) to authenticated;

create or replace function public.teacher_owns_student(check_student_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.has_active_role('teacher') and exists (
    select 1
    from public.teacher_class_assignments assignment
    join public.profiles teacher on teacher.id = assignment.teacher_id
    join public.students learner on learner.id = check_student_id
    where assignment.teacher_id = auth.uid()
      and teacher.campus = learner.campus
      and assignment.campus = learner.campus
      and assignment.class_level = learner.class_level
      and (
        (learner.campus = 'senior' and coalesce(assignment.class_stream, '') = '')
        or coalesce(assignment.class_stream, '') = coalesce(learner.class_stream, '')
      )
  );
$$;
revoke all on function public.teacher_owns_student(uuid) from public, anon;
grant execute on function public.teacher_owns_student(uuid) to authenticated;

drop policy if exists "Teachers insert learners in assigned classes" on public.students;
create policy "Teachers insert learners in assigned classes" on public.students
for insert to authenticated with check (
  public.teacher_can_create_student(class_level, class_stream)
  and campus = case when class_level ~ '^(ECD|Grade)' then 'junior' else 'senior' end
);

alter function public.verify_student_admission(text,date) set search_path = public;
alter function public.verify_parent_admission(text,date) set search_path = public;

-- TRUNCATE bypasses RLS; application clients have no reason to hold it.
revoke truncate on all tables in schema public from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke truncate on tables from anon, authenticated;
commit;
