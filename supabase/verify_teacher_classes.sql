-- Verification query to check teacher_class_assignments and RLS policies in live database

-- 1. Check teacher_class_assignments table exists and inspect assigned classes for Mr. Chayabanda (or any teacher)
select p.full_name, p.role, a.class_level, a.class_stream, a.campus
from public.teacher_class_assignments a
join public.profiles p on p.id = a.teacher_id
order by p.full_name, a.class_level, a.class_stream;

-- 2. Verify RLS policies on teacher_class_assignments, students, academic_records, attendance, sports_records
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public' 
  and tablename in ('teacher_class_assignments', 'students', 'academic_records', 'attendance', 'sports_records', 'behavior_notes')
order by tablename, policyname;
