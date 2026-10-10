-- Admission numbers identify a learner across all portals. New numbers are
-- allocated on INSERT; once stored, no ordinary learner update may replace one.
create or replace function public.prevent_admission_number_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.admission_number is distinct from old.admission_number then
    raise exception 'Admission numbers are assigned by the school and cannot be changed after enrolment.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_admission_number_change on public.students;
create trigger trg_prevent_admission_number_change
before update on public.students
for each row
execute function public.prevent_admission_number_change();
