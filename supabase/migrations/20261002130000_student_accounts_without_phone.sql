-- A learner's admission number is the student portal identifier. Phone contact
-- details are optional and are not needed to create a student account.
alter table public.student_accounts
  alter column phone_number drop not null;
