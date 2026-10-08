-- Keep Junior teachers on Junior only when they have an ECD/Grade allocation.
-- Every other teacher belongs to Senior School, including teachers awaiting a
-- class allocation, so the Staff directory filters remain reliable.

update public.teacher_class_assignments
set campus = case
  when class_level ~ '^(ECD|Grade)' then 'junior'
  else 'senior'
end;

update public.profiles profile
set campus = case
  when exists (
    select 1
    from public.teacher_class_assignments assignment
    where assignment.teacher_id = profile.id
      and assignment.class_level ~ '^(ECD|Grade)'
  ) then 'junior'
  else 'senior'
end
where profile.role = 'teacher';

update public.staff_accounts account
set campus = profile.campus
from public.profiles profile
where account.user_id = profile.id
  and profile.role = 'teacher';
