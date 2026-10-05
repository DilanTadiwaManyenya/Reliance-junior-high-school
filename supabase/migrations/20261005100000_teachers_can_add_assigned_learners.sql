-- Allow teachers to enrol learners only into classes assigned to them.
-- The existing student policy grants inserts to administrators/principals only,
-- which caused legitimate teacher enrolments to be rejected by RLS.

create or replace function public.teacher_can_create_student(
  requested_class_level text,
  requested_class_stream text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.teacher_class_assignments a on a.teacher_id = p.id
    where p.id = auth.uid()
      and p.role = 'teacher'
      and a.class_level = requested_class_level
      and a.class_stream is not distinct from requested_class_stream
  );
$$;

revoke all on function public.teacher_can_create_student(text, text) from public;
grant execute on function public.teacher_can_create_student(text, text) to authenticated;

drop policy if exists "Teachers insert learners in assigned classes" on public.students;
create policy "Teachers insert learners in assigned classes"
  on public.students for insert to authenticated
  with check (public.teacher_can_create_student(class_level, class_stream));
