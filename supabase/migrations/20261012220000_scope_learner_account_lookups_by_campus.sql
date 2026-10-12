-- Legacy portal-account lookup rows use admission numbers rather than a
-- student foreign key. Campus administrators may inspect only account rows
-- belonging to learners at their campus. Main Admin keeps school-wide access,
-- including an unmatched account that may need repair.
drop policy if exists "Admins view student accounts" on public.student_accounts;
drop policy if exists "Campus managers read student accounts" on public.student_accounts;
create policy "Campus managers read student accounts" on public.student_accounts
  for select to authenticated
  using (
    public.is_main_school_admin()
    or exists (
      select 1
      from public.students student
      where student.admission_number = student_accounts.admission_number
        and public.can_read_school_campus(student.campus)
    )
  );

drop policy if exists "Admins view parent accounts" on public.parent_accounts;
drop policy if exists "Campus managers read parent accounts" on public.parent_accounts;
create policy "Campus managers read parent accounts" on public.parent_accounts
  for select to authenticated
  using (
    public.is_main_school_admin()
    or exists (
      select 1
      from public.students student
      where student.admission_number = parent_accounts.child_admission_number
        and public.can_read_school_campus(student.campus)
    )
  );
