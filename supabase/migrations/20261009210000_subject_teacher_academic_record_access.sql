-- Subject teachers may work only with learners and records that match one of
-- their subject/form allocations. Class teachers retain their existing class
-- responsibility through teacher_owns_student.

create or replace function public.teacher_has_subject_student_access(
  requested_student_id uuid,
  requested_subject text default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_active_role('teacher')
    and exists (
      select 1
      from public.teacher_class_subject_assignments allocation
      join public.students learner on learner.id = requested_student_id
      where allocation.teacher_id = auth.uid()
        and allocation.class_level = learner.class_level
        and (
          coalesce(allocation.class_stream, '') = ''
          or coalesce(allocation.class_stream, '') = coalesce(learner.class_stream, '')
        )
        and (
          requested_subject is null
          or lower(allocation.subject) = lower(requested_subject)
        )
    );
$$;

revoke all on function public.teacher_has_subject_student_access(uuid, text) from public;
grant execute on function public.teacher_has_subject_student_access(uuid, text) to authenticated;

drop policy if exists "Teacher select assigned students" on public.students;
create policy "Teacher select assigned students" on public.students
  for select to authenticated
  using (
    public.teacher_owns_student(id)
    or public.teacher_has_subject_student_access(id)
  );

drop policy if exists "Teacher select assigned academic" on public.academic_records;
create policy "Teacher select assigned academic" on public.academic_records
  for select to authenticated
  using (
    public.teacher_owns_student(student_id)
    or public.teacher_has_subject_student_access(student_id, subject)
  );

drop policy if exists "Teacher insert assigned academic" on public.academic_records;
create policy "Teacher insert assigned academic" on public.academic_records
  for insert to authenticated
  with check (
    public.teacher_owns_student(student_id)
    or public.teacher_has_subject_student_access(student_id, subject)
  );

drop policy if exists "Teacher update assigned academic" on public.academic_records;
create policy "Teacher update assigned academic" on public.academic_records
  for update to authenticated
  using (
    public.teacher_owns_student(student_id)
    or public.teacher_has_subject_student_access(student_id, subject)
  )
  with check (
    public.teacher_owns_student(student_id)
    or public.teacher_has_subject_student_access(student_id, subject)
  );
