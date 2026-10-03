-- Repair profiles created before the active-role trigger was reliable.  A
-- successful Auth login must always have one matching portal profile and role.
-- Staff-account records are the source of truth for staff roles.
update public.profiles p
set role = sa.role,
    active_role = sa.role
from public.staff_accounts sa
where sa.user_id = p.id
  and sa.role in ('admin', 'principal', 'teacher', 'accountant')
  and (p.role is distinct from sa.role or p.active_role is distinct from sa.role);

-- Older deployments used `staff`; map it to the current teacher role so the
-- active-role constraint and teacher portal permissions remain consistent.
update public.profiles
set role = 'teacher', active_role = 'teacher'
where role = 'staff';

-- Backfill any Auth users created while a historical profile trigger failed.
insert into public.profiles (id, full_name, phone, role, active_role)
select
  u.id,
  coalesce(nullif(u.raw_user_meta_data ->> 'full_name', ''), 'Account holder'),
  nullif(u.raw_user_meta_data ->> 'phone', ''),
  case when u.raw_user_meta_data ->> 'role' in ('admin', 'principal', 'teacher', 'accountant', 'student')
    then u.raw_user_meta_data ->> 'role' else 'parent' end,
  case when u.raw_user_meta_data ->> 'role' in ('admin', 'principal', 'teacher', 'accountant', 'student')
    then u.raw_user_meta_data ->> 'role' else 'parent' end
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

insert into public.user_roles (user_id, role)
select id, role
from public.profiles
where role in ('parent', 'admin', 'principal', 'teacher', 'accountant', 'student')
on conflict (user_id, role) do nothing;
