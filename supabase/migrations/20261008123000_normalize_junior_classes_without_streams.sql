-- Junior School is grade-based. Streams belong only to Senior School.
-- Normalize records created before that rule was enforced.

update public.school_classes
set class_stream = null,
    updated_at = now()
where campus = 'junior'
  and class_stream is not null;

update public.students
set class_stream = null
where campus = 'junior'
  and class_stream is not null;

-- This table keeps class_stream NOT NULL for historical compatibility, so an
-- empty value represents the streamless Junior class.
update public.teacher_class_assignments
set campus = 'junior',
    class_stream = ''
where class_level ~ '^(ECD|Grade)';

update public.profiles
set campus = 'junior',
    class_stream = null
where role = 'teacher'
  and class_level ~ '^(ECD|Grade)';

-- Existing class rows are deliberately retained. If a grade already has more
-- than one class row, an administrator can review those records in Class
-- Management rather than this migration deleting school data automatically.
