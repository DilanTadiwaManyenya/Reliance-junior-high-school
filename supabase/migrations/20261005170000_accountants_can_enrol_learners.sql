-- Accountants may enrol new learners only in the campus they are assigned to.
-- They receive no update permission, so activation/deactivation stays admin-only.
drop policy if exists "Accountants enrol learners in their campus" on public.students;
create policy "Accountants enrol learners in their campus"
on public.students for insert to authenticated
with check (public.accountant_can_access_campus(campus));
