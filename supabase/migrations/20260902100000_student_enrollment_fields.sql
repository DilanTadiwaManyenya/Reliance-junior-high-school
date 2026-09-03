-- Student self-registration captures the class selected at account creation.
alter table public.student_accounts
  add column if not exists class_level text,
  add column if not exists class_stream text,
  add column if not exists enrolled_year integer not null default 2026;
