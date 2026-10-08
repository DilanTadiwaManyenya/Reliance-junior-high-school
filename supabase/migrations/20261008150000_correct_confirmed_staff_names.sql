-- Stage 1: correct only the staff names explicitly confirmed by the school.
-- The updates are deliberately idempotent and preserve all existing account,
-- class-assignment and subject-assignment relationships.

update public.profiles
set full_name = 'Mr Mudzimurema'
where role = 'teacher'
  and full_name = 'Mr Mudzimirema';

update public.staff_accounts
set name = 'Mr Mudzimurema'
where role = 'teacher'
  and name = 'Mr Mudzimirema';

update public.profiles
set full_name = 'Mr Muronda'
where role = 'teacher'
  and full_name = 'Ms Muronda';

update public.staff_accounts
set name = 'Mr Muronda'
where role = 'teacher'
  and name = 'Ms Muronda';

-- No account is manufactured for Mr Ngwarayi here: an authenticated account
-- requires the staff member's approved contact/credential details. The seed
-- function now recognises him and carries the confirmed Form 2 History
-- allocation when an account is provisioned.
