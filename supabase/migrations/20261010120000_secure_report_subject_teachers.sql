-- Resolve report facilitators from the precise allocation table, not the
-- legacy form-only table. This remains unavailable to teacher workspaces.
create or replace function public.report_subject_teachers_for_student(requested_student_id uuid)
returns table (
  subject text,
  teacher_name text,
  signature_initials text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  if not (
    public.has_active_role('admin')
    or public.has_active_role('principal')
    or public.has_active_role('accountant')
    or exists (
      select 1 from public.parent_student link
      where link.parent_id = auth.uid()
        and link.student_id = requested_student_id
        and link.verified_at is not null
    )
    or exists (
      select 1 from public.students learner
      where learner.id = requested_student_id
        and learner.auth_user_id = auth.uid()
    )
  ) then
    raise exception 'You are not allowed to view this learner report.';
  end if;

  return query
  select distinct on (lower(allocation.subject))
    allocation.subject,
    teacher.full_name as teacher_name,
    teacher.signature_initials
  from public.students learner
  join public.teacher_class_subject_assignments allocation
    on allocation.class_level = learner.class_level
    and (allocation.class_stream = '' or allocation.class_stream = learner.class_stream)
  join public.profiles teacher on teacher.id = allocation.teacher_id
  where learner.id = requested_student_id
  order by lower(allocation.subject),
    case when allocation.class_stream = learner.class_stream then 0 else 1 end,
    allocation.created_at desc;
end;
$$;

revoke all on function public.report_subject_teachers_for_student(uuid) from public;
grant execute on function public.report_subject_teachers_for_student(uuid) to authenticated;
