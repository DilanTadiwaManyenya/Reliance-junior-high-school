-- Stage 5: correct a class/stream without splitting related school records.
-- The function is atomic: if any part fails, PostgreSQL rolls back everything.

create table if not exists public.school_class_corrections (
  id uuid primary key default gen_random_uuid(),
  source_class_id uuid not null references public.school_classes(id),
  target_class_id uuid not null references public.school_classes(id),
  source_class_level text not null,
  source_class_stream text,
  target_class_level text not null,
  target_class_stream text,
  learners_moved integer not null default 0,
  class_assignments_moved integer not null default 0,
  subject_assignments_moved integer not null default 0,
  coursework_assessments_moved integer not null default 0,
  corrected_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  check (source_class_id <> target_class_id)
);

alter table public.school_class_corrections enable row level security;
create policy "Admins read school class corrections" on public.school_class_corrections
  for select to authenticated using (public.is_admin());
create policy "Admins manage school class corrections" on public.school_class_corrections
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.correct_school_class(
  p_source_class_id uuid,
  p_target_class_id uuid
)
returns public.school_class_corrections
language plpgsql
security definer
set search_path = public
as $$
declare
  source_class public.school_classes%rowtype;
  target_class public.school_classes%rowtype;
  result public.school_class_corrections%rowtype;
  learner_count integer := 0;
  class_assignment_count integer := 0;
  subject_assignment_count integer := 0;
  coursework_count integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Only an administrator can correct a class stream';
  end if;

  select * into source_class from public.school_classes where id = p_source_class_id for update;
  select * into target_class from public.school_classes where id = p_target_class_id for update;

  if source_class.id is null or target_class.id is null then
    raise exception 'The source or target class no longer exists';
  end if;
  if source_class.id = target_class.id then
    raise exception 'Choose a different target class';
  end if;
  if source_class.campus <> target_class.campus then
    raise exception 'A class can only be corrected within the same campus';
  end if;
  if not target_class.active then
    raise exception 'Activate the target class before moving records to it';
  end if;

  -- Create target allocations first, ignoring duplicates that already exist,
  -- then remove the old allocations. This satisfies unique constraints when
  -- a correction merges two streams that share a teacher.
  insert into public.teacher_class_assignments (teacher_id, class_level, class_stream, campus)
  select teacher_id, target_class.class_level, coalesce(target_class.class_stream, ''), target_class.campus
  from public.teacher_class_assignments
  where class_level = source_class.class_level
    and class_stream = coalesce(source_class.class_stream, '')
    and campus = source_class.campus
  on conflict (teacher_id, class_level, class_stream) do nothing;
  get diagnostics class_assignment_count = row_count;

  insert into public.teacher_class_subject_assignments (teacher_id, class_level, class_stream, subject, campus)
  select teacher_id, target_class.class_level, coalesce(target_class.class_stream, ''), subject, target_class.campus
  from public.teacher_class_subject_assignments
  where class_level = source_class.class_level
    and class_stream = coalesce(source_class.class_stream, '')
    and campus = source_class.campus
  on conflict (teacher_id, class_level, class_stream, subject) do nothing;
  get diagnostics subject_assignment_count = row_count;

  delete from public.teacher_class_assignments
  where class_level = source_class.class_level
    and class_stream = coalesce(source_class.class_stream, '')
    and campus = source_class.campus;

  delete from public.teacher_class_subject_assignments
  where class_level = source_class.class_level
    and class_stream = coalesce(source_class.class_stream, '')
    and campus = source_class.campus;

  update public.students
  set class_level = target_class.class_level,
      class_stream = target_class.class_stream,
      campus = target_class.campus
  where class_level = source_class.class_level
    and coalesce(class_stream, '') = coalesce(source_class.class_stream, '')
    and campus = source_class.campus;
  get diagnostics learner_count = row_count;

  update public.coursework_assessments
  set class_level = target_class.class_level,
      class_stream = target_class.class_stream,
      campus = target_class.campus
  where class_level = source_class.class_level
    and coalesce(class_stream, '') = coalesce(source_class.class_stream, '')
    and campus = source_class.campus;
  get diagnostics coursework_count = row_count;

  update public.school_classes
  set active = false,
      updated_at = now()
  where id = source_class.id;

  insert into public.school_class_corrections (
    source_class_id, target_class_id, source_class_level, source_class_stream,
    target_class_level, target_class_stream, learners_moved,
    class_assignments_moved, subject_assignments_moved,
    coursework_assessments_moved, corrected_by
  ) values (
    source_class.id, target_class.id, source_class.class_level, source_class.class_stream,
    target_class.class_level, target_class.class_stream, learner_count,
    class_assignment_count, subject_assignment_count, coursework_count, auth.uid()
  ) returning * into result;

  return result;
end;
$$;

revoke all on function public.correct_school_class(uuid, uuid) from public;
grant execute on function public.correct_school_class(uuid, uuid) to authenticated;
