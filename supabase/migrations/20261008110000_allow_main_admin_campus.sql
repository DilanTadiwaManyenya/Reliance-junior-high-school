alter table public.staff_accounts drop constraint if exists staff_accounts_campus_check;
alter table public.staff_accounts add constraint staff_accounts_campus_check check (campus in ('junior', 'senior', 'all'));
