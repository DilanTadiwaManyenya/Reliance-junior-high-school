-- Complete the confirmed Junior class-teacher setup from the staff register.
-- Junior teachers work by class and do not receive Senior-style subject allocations.
insert into public.teacher_class_assignments (teacher_id, class_level, class_stream, campus)
select profile.id, assignment.class_level, '', 'junior'
from (
  values
    ('Ms Seremani', 'ECD A'),
    ('Ms Seremani', 'ECD B'),
    ('Ms Maruta', 'Grade 1'),
    ('Ms Usayi', 'Grade 2'),
    ('Ms Kahari', 'Grade 3'),
    ('Mr Jekapu', 'Grade 4'),
    ('Ms Chikonyora', 'Grade 5'),
    ('Ms Masara', 'Grade 6'),
    ('Mr Moyo', 'Grade 7')
) as assignment(teacher_name, class_level)
join public.profiles profile
  on profile.full_name = assignment.teacher_name
 and profile.role = 'teacher'
 and profile.campus = 'junior'
on conflict (teacher_id, class_level, class_stream)
do update set campus = excluded.campus;
