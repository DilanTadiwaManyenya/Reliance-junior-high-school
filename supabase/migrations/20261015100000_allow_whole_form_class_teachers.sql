-- An empty Senior class-teacher stream represents the whole form.
-- Keep Junior assignments exact and enforce the teacher and assignment campus.
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
revoke all on function public.teacher_owns_student(uuid) from public;
grant execute on function public.teacher_owns_student(uuid) to authenticated;
