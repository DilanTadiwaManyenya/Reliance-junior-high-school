-- 2026 senior-school subject allocation, transcribed from the approved
-- allocation sheet. Form 5/Form 6 on the sheet mean Lower Six/Upper Six.
-- Every row below is a whole-form allocation (all active streams in that
-- form). Stream-specific allocations are retained separately.
--
-- Mr Muronda is intentionally excluded: no matching teacher account exists.
-- The affected cells remain visibly unassigned: Form 3 English, Form 4
-- History, and Upper Six History.

with expected (teacher_name, class_level, subject) as (
  values
    ('Mr Kufamuni', 'Form 1', 'Mathematics'), ('Mr Munyembe', 'Form 1', 'English'), ('Mr Makusha', 'Form 1', 'Combined Science'), ('Ms Chakwesha', 'Form 1', 'Shona'), ('Mr Mahachi', 'Form 1', 'Accounting'), ('Mr Chayabanda', 'Form 1', 'Geography'), ('Mr Chayabanda', 'Form 1', 'BES'), ('Mr Feya', 'Form 1', 'History'), ('Mr Ngwarayi', 'Form 1', 'Heritage'),
    ('Mr Nyamutswa', 'Form 2', 'Mathematics'), ('Mr Munyembe', 'Form 2', 'English'), ('Mr Makusha', 'Form 2', 'Combined Science'), ('Ms Mukote', 'Form 2', 'Shona'), ('Mr Svudu', 'Form 2', 'Accounting'), ('Mr Mudzimurema', 'Form 2', 'Geography'), ('Mr Size', 'Form 2', 'BES'), ('Mr Ngwarayi', 'Form 2', 'History'), ('Mr Feya', 'Form 2', 'Heritage'),
    ('Mr Gopito', 'Form 3', 'Mathematics'), ('Mr Kufamuni', 'Form 3', 'Combined Science'), ('Ms Chakwesha', 'Form 3', 'Shona'), ('Mr Mahachi', 'Form 3', 'Accounting'), ('Mr Chayabanda', 'Form 3', 'Geography'), ('Mr Svudu', 'Form 3', 'BES'), ('Mr Feya', 'Form 3', 'Heritage'), ('Mr Gopito', 'Form 3', 'Biology'), ('Mr Makusha', 'Form 3', 'Physics'), ('Mr Kufamuni', 'Form 3', 'Chemistry'),
    ('Mr Chigova', 'Form 4', 'Mathematics'), ('Mrs Kodzomoyo', 'Form 4', 'English'), ('Mr Tembo', 'Form 4', 'Combined Science'), ('Ms Mukote', 'Form 4', 'Shona'), ('Mr Mahachi', 'Form 4', 'Accounting'), ('Mr Mudzimurema', 'Form 4', 'Geography'), ('Mr Size', 'Form 4', 'BES'), ('Mr Mabvuramiti', 'Form 4', 'Heritage'),
    ('Mr Chigova', 'Lower Six', 'Mathematics'), ('Ms Chakwesha', 'Lower Six', 'Shona'), ('Mr Nyamutswa', 'Lower Six', 'Accounting'), ('Mrs Kodzomoyo', 'Lower Six', 'History'), ('Mr Mabvuramiti', 'Lower Six', 'Heritage'), ('Mr Tembo', 'Lower Six', 'Economics'), ('Mr Gopito', 'Lower Six', 'Statistics'), ('Mr Mabvuramiti', 'Lower Six', 'FRS'), ('Mr Svudu', 'Lower Six', 'Business Studies'), ('Mrs Kodzomoyo', 'Lower Six', 'English Literature'), ('Mrs Kodzomoyo', 'Lower Six', 'Communication Skills'),
    ('Mr Chigova', 'Upper Six', 'Mathematics'), ('Ms Chakwesha', 'Upper Six', 'Shona'), ('Mr Nyamutswa', 'Upper Six', 'Accounting'), ('Mr Mabvuramiti', 'Upper Six', 'Heritage'), ('Mr Tembo', 'Upper Six', 'Economics'), ('Mr Gopito', 'Upper Six', 'Statistics'), ('Mr Mabvuramiti', 'Upper Six', 'FRS'), ('Mr Svudu', 'Upper Six', 'Business Studies'), ('Mrs Kodzomoyo', 'Upper Six', 'English Literature'), ('Mrs Kodzomoyo', 'Upper Six', 'Communication Skills')
),
resolved as (
  select profile.id as teacher_id, expected.class_level, expected.subject
  from expected
  join public.profiles profile on profile.full_name = expected.teacher_name
  where profile.role = 'teacher' and profile.campus = 'senior'
)
delete from public.teacher_class_subject_assignments
where campus = 'senior'
  and class_stream = ''
  and class_level in ('Form 1', 'Form 2', 'Form 3', 'Form 4', 'Lower Six', 'Upper Six');

with expected (teacher_name, class_level, subject) as (
  values
    ('Mr Kufamuni', 'Form 1', 'Mathematics'), ('Mr Munyembe', 'Form 1', 'English'), ('Mr Makusha', 'Form 1', 'Combined Science'), ('Ms Chakwesha', 'Form 1', 'Shona'), ('Mr Mahachi', 'Form 1', 'Accounting'), ('Mr Chayabanda', 'Form 1', 'Geography'), ('Mr Chayabanda', 'Form 1', 'BES'), ('Mr Feya', 'Form 1', 'History'), ('Mr Ngwarayi', 'Form 1', 'Heritage'),
    ('Mr Nyamutswa', 'Form 2', 'Mathematics'), ('Mr Munyembe', 'Form 2', 'English'), ('Mr Makusha', 'Form 2', 'Combined Science'), ('Ms Mukote', 'Form 2', 'Shona'), ('Mr Svudu', 'Form 2', 'Accounting'), ('Mr Mudzimurema', 'Form 2', 'Geography'), ('Mr Size', 'Form 2', 'BES'), ('Mr Ngwarayi', 'Form 2', 'History'), ('Mr Feya', 'Form 2', 'Heritage'),
    ('Mr Gopito', 'Form 3', 'Mathematics'), ('Mr Kufamuni', 'Form 3', 'Combined Science'), ('Ms Chakwesha', 'Form 3', 'Shona'), ('Mr Mahachi', 'Form 3', 'Accounting'), ('Mr Chayabanda', 'Form 3', 'Geography'), ('Mr Svudu', 'Form 3', 'BES'), ('Mr Feya', 'Form 3', 'Heritage'), ('Mr Gopito', 'Form 3', 'Biology'), ('Mr Makusha', 'Form 3', 'Physics'), ('Mr Kufamuni', 'Form 3', 'Chemistry'),
    ('Mr Chigova', 'Form 4', 'Mathematics'), ('Mrs Kodzomoyo', 'Form 4', 'English'), ('Mr Tembo', 'Form 4', 'Combined Science'), ('Ms Mukote', 'Form 4', 'Shona'), ('Mr Mahachi', 'Form 4', 'Accounting'), ('Mr Mudzimurema', 'Form 4', 'Geography'), ('Mr Size', 'Form 4', 'BES'), ('Mr Mabvuramiti', 'Form 4', 'Heritage'),
    ('Mr Chigova', 'Lower Six', 'Mathematics'), ('Ms Chakwesha', 'Lower Six', 'Shona'), ('Mr Nyamutswa', 'Lower Six', 'Accounting'), ('Mrs Kodzomoyo', 'Lower Six', 'History'), ('Mr Mabvuramiti', 'Lower Six', 'Heritage'), ('Mr Tembo', 'Lower Six', 'Economics'), ('Mr Gopito', 'Lower Six', 'Statistics'), ('Mr Mabvuramiti', 'Lower Six', 'FRS'), ('Mr Svudu', 'Lower Six', 'Business Studies'), ('Mrs Kodzomoyo', 'Lower Six', 'English Literature'), ('Mrs Kodzomoyo', 'Lower Six', 'Communication Skills'),
    ('Mr Chigova', 'Upper Six', 'Mathematics'), ('Ms Chakwesha', 'Upper Six', 'Shona'), ('Mr Nyamutswa', 'Upper Six', 'Accounting'), ('Mr Mabvuramiti', 'Upper Six', 'Heritage'), ('Mr Tembo', 'Upper Six', 'Economics'), ('Mr Gopito', 'Upper Six', 'Statistics'), ('Mr Mabvuramiti', 'Upper Six', 'FRS'), ('Mr Svudu', 'Upper Six', 'Business Studies'), ('Mrs Kodzomoyo', 'Upper Six', 'English Literature'), ('Mrs Kodzomoyo', 'Upper Six', 'Communication Skills')
)
insert into public.teacher_class_subject_assignments (teacher_id, class_level, class_stream, subject, campus)
select profile.id, expected.class_level, '', expected.subject, 'senior'
from expected
join public.profiles profile on profile.full_name = expected.teacher_name
where profile.role = 'teacher' and profile.campus = 'senior';
