-- Passwords created or reset by an administrator are temporary.  The account
-- owner must choose a replacement before accessing the portal.
alter table public.profiles
  add column if not exists must_change_password boolean not null default false;

-- Carry forward the older teacher-onboarding flag so existing temporary
-- accounts get the same protection after this migration is applied.
update public.profiles
  set must_change_password = true
  where must_update_credentials = true;
