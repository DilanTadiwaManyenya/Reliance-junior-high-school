-- A parent relationship belongs to the learner's campus. Keep parents able to
-- read their own verified links, while limiting campus administrators to links
-- for learners at the campus they manage.
drop policy if exists "Admins can select parent student links" on public.parent_student;
drop policy if exists "Admins can insert parent student links" on public.parent_student;
drop policy if exists "Admins can update parent student links" on public.parent_student;
drop policy if exists "Admins can delete parent student links" on public.parent_student;
drop policy if exists "Campus managers read parent student links" on public.parent_student;
drop policy if exists "Campus admins manage parent student links" on public.parent_student;

create policy "Campus managers read parent student links" on public.parent_student
  for select to authenticated
  using (public.can_read_student_record(student_id));

create policy "Campus admins manage parent student links" on public.parent_student
  for all to authenticated
  using (public.can_manage_student_record(student_id))
  with check (public.can_manage_student_record(student_id));
