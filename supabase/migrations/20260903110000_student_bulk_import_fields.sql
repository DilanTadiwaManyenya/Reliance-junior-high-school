-- Enrollment metadata used by the Form 1 intake tools.
alter table public.students
  add column if not exists sex text check (sex in ('M', 'F')),
  add column if not exists birth_cert_no text,
  add column if not exists address text;

-- The existing campus trigger classifies Form 1 as junior.  The 2026 Form 1
-- intake is administered by the senior campus, so preserve an explicit value.
create or replace function public.derive_student_campus()
returns trigger language plpgsql as $$
begin
  if new.class_level in ('ECD A', 'ECD B', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7') then
    new.campus := 'junior';
  elsif new.campus is null then
    new.campus := 'senior';
  end if;
  return new;
end;
$$;
