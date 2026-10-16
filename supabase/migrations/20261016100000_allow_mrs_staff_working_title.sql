-- Match the titles accepted by staff creation, management, and the portal.
alter table public.profiles
  drop constraint if exists profiles_working_title_check;
alter table public.profiles
  add constraint profiles_working_title_check
  check (working_title is null or working_title in ('Mr', 'Ms', 'Mrs'));
