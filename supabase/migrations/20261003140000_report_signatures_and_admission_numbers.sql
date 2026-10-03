-- Five digit, school-wide admission identifiers and teacher initials on report cards.
alter table public.academic_records
  add column if not exists teacher_initials text;

alter table public.academic_records
  drop constraint if exists academic_records_teacher_initials_format;

alter table public.academic_records
  add constraint academic_records_teacher_initials_format
  check (teacher_initials is null or teacher_initials ~ '^[A-Z]{1,4}$');

-- Existing records remain untouched. New learner admission numbers are generated
-- client-side as five digit values (for example 00126), after checking the
-- latest number in the active school register.
