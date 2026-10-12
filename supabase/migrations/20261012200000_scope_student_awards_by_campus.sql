-- Awards appear in learner profiles and the academic report card. Keep them
-- inside the learner's campus boundary just like academics, attendance,
-- behaviour, and sport records.
--
-- Parent access and accountant read access are deliberately left in place:
-- they are already linked to a verified learner or the learner's campus.
drop policy if exists "Admins manage learner awards" on public.student_awards;
drop policy if exists "Admin principal read learner awards" on public.student_awards;
drop policy if exists "Admin principal manage learner awards" on public.student_awards;
drop policy if exists "Campus managers read awards" on public.student_awards;
drop policy if exists "Campus admins manage awards" on public.student_awards;

create policy "Campus managers read awards" on public.student_awards
  for select to authenticated
  using (public.can_read_student_record(student_id));

create policy "Campus admins manage awards" on public.student_awards
  for all to authenticated
  using (public.can_manage_student_record(student_id))
  with check (public.can_manage_student_record(student_id));
