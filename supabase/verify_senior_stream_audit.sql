-- Stage 1 (read-only): senior-school stream audit.
--
-- Run this in the Supabase SQL Editor before applying the senior stream
-- correction migration. Every statement is SELECT-only: it cannot change
-- learners, classes, allocations, marks, or coursework.
--
-- Confirmed target structure:
--   Form 1: Red, Blue, White, Green
--   Form 2: Red, Blue, White, Green
--   Form 3: Red, Blue, White, Green, Purple
--   Form 4: Red, Blue, White, Green, Purple
--   Form 5: Commercials, Arts
--   Form 6: Commercials, Arts

with official_streams (class_level, class_stream) as (
  values
    ('Form 1', 'Red'), ('Form 1', 'Blue'), ('Form 1', 'White'), ('Form 1', 'Green'),
    ('Form 2', 'Red'), ('Form 2', 'Blue'), ('Form 2', 'White'), ('Form 2', 'Green'),
    ('Form 3', 'Red'), ('Form 3', 'Blue'), ('Form 3', 'White'), ('Form 3', 'Green'), ('Form 3', 'Purple'),
    ('Form 4', 'Red'), ('Form 4', 'Blue'), ('Form 4', 'White'), ('Form 4', 'Green'), ('Form 4', 'Purple'),
    ('Form 5', 'Commercials'), ('Form 5', 'Arts'),
    ('Form 6', 'Commercials'), ('Form 6', 'Arts')
)
select
  official.class_level,
  official.class_stream,
  case when school_class.id is null then 'missing from school_classes' else 'present' end as registry_status,
  coalesce(school_class.active, false) as active,
  count(student.id) filter (where student.status = 'active') as active_learners,
  count(student.id) filter (where student.status is distinct from 'active') as other_learners
from official_streams official
left join public.school_classes school_class
  on school_class.class_level = official.class_level
 and coalesce(school_class.class_stream, '') = official.class_stream
left join public.students student
  on student.class_level = official.class_level
 and coalesce(student.class_stream, '') = official.class_stream
group by official.class_level, official.class_stream, school_class.id, school_class.active
order by official.class_level, official.class_stream;

-- Existing senior registry entries not in the confirmed structure. These need
-- a deliberate keep, rename, merge, or retire decision in Stage 3; do not
-- delete them while they still have dependencies.
with official_streams (class_level, class_stream) as (
  values
    ('Form 1', 'Red'), ('Form 1', 'Blue'), ('Form 1', 'White'), ('Form 1', 'Green'),
    ('Form 2', 'Red'), ('Form 2', 'Blue'), ('Form 2', 'White'), ('Form 2', 'Green'),
    ('Form 3', 'Red'), ('Form 3', 'Blue'), ('Form 3', 'White'), ('Form 3', 'Green'), ('Form 3', 'Purple'),
    ('Form 4', 'Red'), ('Form 4', 'Blue'), ('Form 4', 'White'), ('Form 4', 'Green'), ('Form 4', 'Purple'),
    ('Form 5', 'Commercials'), ('Form 5', 'Arts'),
    ('Form 6', 'Commercials'), ('Form 6', 'Arts')
)
select
  school_class.class_level,
  coalesce(school_class.class_stream, '') as class_stream,
  school_class.active,
  count(student.id) filter (where student.status = 'active') as active_learners
from public.school_classes school_class
left join official_streams official
  on official.class_level = school_class.class_level
 and official.class_stream = coalesce(school_class.class_stream, '')
left join public.students student
  on student.class_level = school_class.class_level
 and coalesce(student.class_stream, '') = coalesce(school_class.class_stream, '')
where school_class.campus = 'senior'
  and official.class_level is null
group by school_class.id, school_class.class_level, school_class.class_stream, school_class.active
order by school_class.class_level, class_stream;

-- Learners outside the confirmed structure. This is the report used before
-- any correction/mapping is approved.
with official_streams (class_level, class_stream) as (
  values
    ('Form 1', 'Red'), ('Form 1', 'Blue'), ('Form 1', 'White'), ('Form 1', 'Green'),
    ('Form 2', 'Red'), ('Form 2', 'Blue'), ('Form 2', 'White'), ('Form 2', 'Green'),
    ('Form 3', 'Red'), ('Form 3', 'Blue'), ('Form 3', 'White'), ('Form 3', 'Green'), ('Form 3', 'Purple'),
    ('Form 4', 'Red'), ('Form 4', 'Blue'), ('Form 4', 'White'), ('Form 4', 'Green'), ('Form 4', 'Purple'),
    ('Form 5', 'Commercials'), ('Form 5', 'Arts'),
    ('Form 6', 'Commercials'), ('Form 6', 'Arts')
)
select
  student.id,
  student.full_name,
  student.admission_number,
  student.status,
  student.class_level,
  coalesce(student.class_stream, '') as class_stream
from public.students student
left join official_streams official
  on official.class_level = student.class_level
 and official.class_stream = coalesce(student.class_stream, '')
where student.campus = 'senior'
  and official.class_level is null
order by student.class_level, class_stream, student.full_name;

-- Dependencies grouped by class/stream. A blank subject-allocation stream is
-- intentionally reported as "All streams"; it is a whole-form allocation.
select
  'class teacher allocation' as dependency,
  assignment.class_level,
  coalesce(assignment.class_stream, '') as class_stream,
  count(*) as records
from public.teacher_class_assignments assignment
where assignment.campus = 'senior'
group by assignment.class_level, coalesce(assignment.class_stream, '')
union all
select
  'subject teacher allocation',
  assignment.class_level,
  case when assignment.class_stream = '' then 'All streams' else assignment.class_stream end,
  count(*)
from public.teacher_class_subject_assignments assignment
where assignment.campus = 'senior'
group by assignment.class_level, assignment.class_stream
union all
select
  'coursework assessment',
  assessment.class_level,
  coalesce(assessment.class_stream, ''),
  count(*)
from public.coursework_assessments assessment
where assessment.campus = 'senior'
group by assessment.class_level, coalesce(assessment.class_stream, '')
order by dependency, class_level, class_stream;
