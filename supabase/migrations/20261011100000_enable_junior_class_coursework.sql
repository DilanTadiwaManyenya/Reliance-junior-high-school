-- Junior teachers own a whole assigned class and may work with every Junior
-- curriculum subject. Senior teachers remain constrained by subject allocation.
create or replace function public.teacher_owns_student(check_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_active_role('teacher') and exists (
    select 1
    from public.teacher_class_assignments assignment
    join public.students learner on learner.id = check_student_id
    where assignment.teacher_id = auth.uid()
      and assignment.class_level = learner.class_level
      and coalesce(assignment.class_stream, '') = coalesce(learner.class_stream, '')
  );
$$;

create or replace function public.teacher_has_coursework_allocation(
  requested_teacher_id uuid,
  requested_class_level text,
  requested_class_stream text,
  requested_subject text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() = requested_teacher_id
    and (
      exists (
        select 1
        from public.teacher_class_subject_assignments allocation
        where allocation.teacher_id = requested_teacher_id
          and allocation.class_level = requested_class_level
          and lower(allocation.subject) = lower(requested_subject)
          and (
            coalesce(allocation.class_stream, '') = ''
            or coalesce(allocation.class_stream, '') = coalesce(requested_class_stream, '')
          )
      )
      or exists (
        select 1
        from public.profiles teacher
        join public.teacher_class_assignments assignment on assignment.teacher_id = teacher.id
        where teacher.id = requested_teacher_id
          and teacher.campus = 'junior'
          and assignment.class_level = requested_class_level
          and coalesce(assignment.class_stream, '') = coalesce(requested_class_stream, '')
      )
    );
$$;

create or replace function public.coursework_learners(requested_assessment_id uuid)
returns table (
  id uuid,
  full_name text,
  admission_number text,
  class_level text,
  class_stream text,
  campus text
)
language sql
stable
security definer
set search_path = public
as $$
  select learner.id, learner.full_name, learner.admission_number,
         learner.class_level, learner.class_stream, learner.campus
  from public.coursework_assessments assessment
  join public.students learner
    on learner.status = 'active'
   and learner.campus = assessment.campus
   and learner.class_level = assessment.class_level
   and (
     coalesce(assessment.class_stream, '') = ''
     or coalesce(learner.class_stream, '') = coalesce(assessment.class_stream, '')
   )
  where assessment.id = requested_assessment_id
    and (
      public.is_admin()
      or public.teacher_has_coursework_allocation(
        assessment.teacher_id,
        assessment.class_level,
        assessment.class_stream,
        assessment.subject
      )
    )
  order by learner.class_stream, learner.full_name;
$$;

revoke all on function public.teacher_owns_student(uuid) from public;
grant execute on function public.teacher_owns_student(uuid) to authenticated;
revoke all on function public.teacher_has_coursework_allocation(uuid, text, text, text) from public;
grant execute on function public.teacher_has_coursework_allocation(uuid, text, text, text) to authenticated;
revoke all on function public.coursework_learners(uuid) from public;
grant execute on function public.coursework_learners(uuid) to authenticated;
