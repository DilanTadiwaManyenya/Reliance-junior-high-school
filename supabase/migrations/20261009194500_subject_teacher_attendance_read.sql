-- Subject teachers may view attendance for learners in a subject/form they
-- are allocated. Attendance remains read-only for these teachers.

drop policy if exists "Teacher select assigned attendance" on public.attendance;
create policy "Teacher select assigned attendance" on public.attendance
  for select to authenticated
  using (
    public.teacher_owns_student(student_id)
    or public.teacher_has_subject_student_access(student_id)
  );
