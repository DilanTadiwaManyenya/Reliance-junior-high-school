-- Correct staff accounts created while the Auth trigger initially assigned the
-- parent role.  Their profile role is authoritative for the initial session.
insert into public.user_roles (user_id, role)
select id, role
from public.profiles
where role in ('admin', 'principal', 'teacher', 'accountant')
on conflict (user_id, role) do nothing;

update public.profiles
set active_role = role
where role in ('admin', 'principal', 'teacher', 'accountant')
  and active_role is distinct from role;
