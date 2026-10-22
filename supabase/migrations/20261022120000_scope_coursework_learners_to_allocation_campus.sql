-- Keep Senior and Junior coursework isolated when a class label or stream is reused.
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
   and coalesce(learner.class_stream, '') = coalesce(assessment.class_stream, '')
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
  order by learner.full_name;
$$;

revoke all on function public.coursework_learners(uuid) from public;
grant execute on function public.coursework_learners(uuid) to authenticated;
