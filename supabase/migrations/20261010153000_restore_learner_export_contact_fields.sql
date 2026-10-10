-- Some live projects pre-date the fees dashboard schema migration.
-- Keep the printable learner register compatible by restoring the optional
-- guardian contact columns without changing existing learner data.

alter table public.students
  add column if not exists parent_name text,
  add column if not exists parent_phone text;
