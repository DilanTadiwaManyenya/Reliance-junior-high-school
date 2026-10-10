-- A blank stream means a teacher owns the subject for the whole form. Audit
-- existing allocations first: do not guess which teacher should retain a
-- conflicting historic allocation.
do $$
begin
  if exists (
    select 1
    from public.teacher_class_subject_assignments first_assignment
    join public.teacher_class_subject_assignments second_assignment
      on second_assignment.id > first_assignment.id
      and second_assignment.campus = first_assignment.campus
      and second_assignment.class_level = first_assignment.class_level
      and lower(second_assignment.subject) = lower(first_assignment.subject)
      and second_assignment.teacher_id <> first_assignment.teacher_id
      and (
        second_assignment.class_stream = ''
        or first_assignment.class_stream = ''
        or second_assignment.class_stream = first_assignment.class_stream
      )
  ) then
    raise exception 'Subject allocation conflicts exist. Resolve them in Staff Management before enabling the database guard.';
  end if;
end;
$$;

create or replace function public.prevent_conflicting_subject_ownership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.teacher_class_subject_assignments existing
    where existing.id <> new.id
      and existing.campus = new.campus
      and existing.class_level = new.class_level
      and lower(existing.subject) = lower(new.subject)
      and existing.teacher_id <> new.teacher_id
      and (
        existing.class_stream = ''
        or new.class_stream = ''
        or existing.class_stream = new.class_stream
      )
  ) then
    raise exception 'This subject is already owned by another teacher for the selected class or stream.';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_conflicting_subject_ownership on public.teacher_class_subject_assignments;
create trigger prevent_conflicting_subject_ownership
before insert or update of teacher_id, class_level, class_stream, subject, campus
on public.teacher_class_subject_assignments
for each row execute function public.prevent_conflicting_subject_ownership();
