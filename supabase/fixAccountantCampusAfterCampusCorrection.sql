-- Run after fixCampusAssignment.sql if the accountant should manage Form 1-6.
update public.profiles
set campus = 'senior'
where role = 'accountant';

update public.staff_accounts
set campus = 'senior'
where role = 'accountant';

select p.full_name, p.role, p.campus as profile_campus, sa.campus as staff_campus
from public.profiles p
left join public.staff_accounts sa on sa.user_id = p.id
where p.role = 'accountant';
