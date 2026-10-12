-- Keep coursework within its campus for campus-scoped administrators while
-- preserving the allocated teacher workflow and parent read access.

create or replace function public.can_read_coursework_mark(target_mark_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.coursework_marks mark
    join public.coursework_assessments assessment on assessment.id = mark.assessment_id
    join public.students learner on learner.id = mark.student_id
    where mark.id = target_mark_id
      and learner.campus = assessment.campus
      and public.can_read_school_campus(assessment.campus)
  );
$$;

create or replace function public.can_manage_coursework_mark(target_mark_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.coursework_marks mark
    join public.coursework_assessments assessment on assessment.id = mark.assessment_id
    join public.students learner on learner.id = mark.student_id
    where mark.id = target_mark_id
      and learner.campus = assessment.campus
      and public.can_manage_school_campus(assessment.campus)
  );
$$;

create or replace function public.teacher_can_manage_coursework_mark(
  requested_assessment_id uuid,
  requested_student_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.coursework_assessments assessment
    join public.students learner on learner.id = requested_student_id
    where assessment.id = requested_assessment_id
      and learner.campus = assessment.campus
      and learner.class_level = assessment.class_level
      and (
        coalesce(assessment.class_stream, '') = ''
        or coalesce(learner.class_stream, '') = coalesce(assessment.class_stream, '')
      )
      and public.teacher_has_coursework_allocation(
        assessment.teacher_id,
        assessment.class_level,
        assessment.class_stream,
        assessment.subject
      )
  );
$$;

revoke all on function public.can_read_coursework_mark(uuid) from public;
revoke all on function public.can_manage_coursework_mark(uuid) from public;
revoke all on function public.teacher_can_manage_coursework_mark(uuid, uuid) from public;
grant execute on function public.can_read_coursework_mark(uuid) to authenticated;
grant execute on function public.can_manage_coursework_mark(uuid) to authenticated;
grant execute on function public.teacher_can_manage_coursework_mark(uuid, uuid) to authenticated;

-- Assessments: teacher ownership stays allocation-based; campus administrators
-- have their normal campus-limited management access.
drop policy if exists "Teachers manage allocated coursework" on public.coursework_assessments;
create policy "Teachers manage allocated coursework" on public.coursework_assessments
  for all to authenticated
  using (public.teacher_has_coursework_allocation(teacher_id, class_level, class_stream, subject))
  with check (public.teacher_has_coursework_allocation(teacher_id, class_level, class_stream, subject));

create policy "Campus managers read coursework assessments" on public.coursework_assessments
  for select to authenticated
  using (public.can_read_school_campus(campus));

create policy "Campus admins manage coursework assessments" on public.coursework_assessments
  for all to authenticated
  using (public.can_manage_school_campus(campus))
  with check (public.can_manage_school_campus(campus));

-- Marks: an allocated teacher can mark only learners covered by the
-- assessment. Campus administrators can manage marks only in their campus.
drop policy if exists "Teachers manage coursework marks" on public.coursework_marks;
create policy "Teachers manage allocated coursework marks" on public.coursework_marks
  for all to authenticated
  using (public.teacher_can_manage_coursework_mark(assessment_id, student_id))
  with check (public.teacher_can_manage_coursework_mark(assessment_id, student_id));

create policy "Campus managers read coursework marks" on public.coursework_marks
  for select to authenticated
  using (public.can_read_coursework_mark(id));

create policy "Campus admins manage coursework marks" on public.coursework_marks
  for all to authenticated
  using (public.can_manage_coursework_mark(id))
  with check (
    exists (
      select 1
      from public.coursework_assessments assessment
      join public.students learner on learner.id = coursework_marks.student_id
      where assessment.id = coursework_marks.assessment_id
        and learner.campus = assessment.campus
        and public.can_manage_school_campus(assessment.campus)
    )
  );

-- The learner-list RPC is security definer, so it must enforce the same
-- campus boundary itself rather than relying on the broad is_admin helper.
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
      public.can_read_school_campus(assessment.campus)
      or public.teacher_has_coursework_allocation(
        assessment.teacher_id,
        assessment.class_level,
        assessment.class_stream,
        assessment.subject
      )
    )
  order by learner.class_stream, learner.full_name;
$$;

revoke all on function public.coursework_learners(uuid) from public;
grant execute on function public.coursework_learners(uuid) to authenticated;
