-- The Junior principal stamp must carry the date the class teacher was
-- assigned the report structure, never the current date.
drop function if exists public.junior_report_class_teacher(uuid);

create or replace function public.junior_report_class_teacher(requested_student_id uuid)
returns table (
  teacher_name text,
  signature_initials text,
  assigned_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select teacher.full_name, teacher.signature_initials, assignment.created_at
  from public.students learner
  join public.teacher_class_assignments assignment
    on assignment.class_level = learner.class_level
   and coalesce(assignment.class_stream, '') = coalesce(learner.class_stream, '')
   and assignment.campus = 'junior'
  join public.profiles teacher on teacher.id = assignment.teacher_id
  where learner.id = requested_student_id
    and learner.campus = 'junior'
    and (
      public.can_read_student_record(learner.id)
      or public.accountant_can_access_campus(learner.campus)
      or exists (
        select 1 from public.parent_student parent_link
        where parent_link.student_id = learner.id
          and parent_link.parent_id = auth.uid()
          and parent_link.verified_at is not null
      )
    )
  order by assignment.created_at desc
  limit 1;
$$;

revoke all on function public.junior_report_class_teacher(uuid) from public;
grant execute on function public.junior_report_class_teacher(uuid) to authenticated;
