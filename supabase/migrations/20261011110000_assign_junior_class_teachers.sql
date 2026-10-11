-- Confirmed Junior class-teacher setup. Junior class teachers own every
-- curriculum subject for their assigned grade; no subject allocations are made.
insert into public.teacher_class_assignments (teacher_id, class_level, class_stream, campus)
select profile.id, assignment.class_level, '', 'junior'
from (
  values
    ('Ms Chikonyora', 'Grade 5'),
    ('Ms Masara', 'Grade 6')
) as assignment(teacher_name, class_level)
join public.profiles profile
  on profile.full_name = assignment.teacher_name
 and profile.role = 'teacher'
 and profile.campus = 'junior'
on conflict (teacher_id, class_level, class_stream)
do update set campus = excluded.campus;
