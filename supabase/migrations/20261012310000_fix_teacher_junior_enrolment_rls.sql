-- Junior classes do not have streams.  teacher_class_assignments keeps an
-- empty string for that value, while students correctly store it as NULL.
-- Treat those two representations as the same when a teacher enrols a learner.

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
  select public.has_active_role('teacher')
    and exists (
      select 1
      from public.profiles p
      join public.teacher_class_assignments a on a.teacher_id = p.id
      where p.id = auth.uid()
        and p.role = 'teacher'
        and a.class_level = requested_class_level
        and coalesce(a.class_stream, '') = coalesce(requested_class_stream, '')
        and a.campus = case
          when requested_class_level ~ '^(ECD|Grade)' then 'junior'
          else 'senior'
        end
    );
$$;

revoke all on function public.teacher_can_create_student(text, text) from public;
grant execute on function public.teacher_can_create_student(text, text) to authenticated;
