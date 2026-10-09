-- Stage 3: register the confirmed senior-school class structure.
--
-- This is deliberately additive and non-destructive. It never changes a
-- learner, teacher allocation, subject allocation, assessment, or mark. A
-- non-official registry entry is retired only when it has no dependency at
-- all; records needing a correction remain active for the Stage 5 mapping
-- workflow.

with official_streams (class_level, class_stream) as (
  values
    ('Form 1', 'Red'), ('Form 1', 'Blue'), ('Form 1', 'White'), ('Form 1', 'Green'),
    ('Form 2', 'Red'), ('Form 2', 'Blue'), ('Form 2', 'White'), ('Form 2', 'Green'),
    ('Form 3', 'Red'), ('Form 3', 'Blue'), ('Form 3', 'White'), ('Form 3', 'Green'), ('Form 3', 'Purple'),
    ('Form 4', 'Red'), ('Form 4', 'Blue'), ('Form 4', 'White'), ('Form 4', 'Green'), ('Form 4', 'Purple'),
    ('Form 5', 'Commercials'), ('Form 5', 'Arts'),
    ('Form 6', 'Commercials'), ('Form 6', 'Arts')
)
insert into public.school_classes (class_level, class_stream, campus, active)
select class_level, class_stream, 'senior', true
from official_streams
on conflict do nothing;

-- Restore an official class if it was previously marked inactive. This does
-- not alter its learners or allocations.
with official_streams (class_level, class_stream) as (
  values
    ('Form 1', 'Red'), ('Form 1', 'Blue'), ('Form 1', 'White'), ('Form 1', 'Green'),
    ('Form 2', 'Red'), ('Form 2', 'Blue'), ('Form 2', 'White'), ('Form 2', 'Green'),
    ('Form 3', 'Red'), ('Form 3', 'Blue'), ('Form 3', 'White'), ('Form 3', 'Green'), ('Form 3', 'Purple'),
    ('Form 4', 'Red'), ('Form 4', 'Blue'), ('Form 4', 'White'), ('Form 4', 'Green'), ('Form 4', 'Purple'),
    ('Form 5', 'Commercials'), ('Form 5', 'Arts'),
    ('Form 6', 'Commercials'), ('Form 6', 'Arts')
)
update public.school_classes school_class
set campus = 'senior',
    active = true,
    updated_at = now()
from official_streams official
where school_class.class_level = official.class_level
  and coalesce(school_class.class_stream, '') = official.class_stream;

-- Retire only orphaned, non-official senior registry rows. If even one
-- dependent record exists, leave it active so an administrator can review it
-- and choose an explicit mapping later. Nothing is deleted.
with official_streams (class_level, class_stream) as (
  values
    ('Form 1', 'Red'), ('Form 1', 'Blue'), ('Form 1', 'White'), ('Form 1', 'Green'),
    ('Form 2', 'Red'), ('Form 2', 'Blue'), ('Form 2', 'White'), ('Form 2', 'Green'),
    ('Form 3', 'Red'), ('Form 3', 'Blue'), ('Form 3', 'White'), ('Form 3', 'Green'), ('Form 3', 'Purple'),
    ('Form 4', 'Red'), ('Form 4', 'Blue'), ('Form 4', 'White'), ('Form 4', 'Green'), ('Form 4', 'Purple'),
    ('Form 5', 'Commercials'), ('Form 5', 'Arts'),
    ('Form 6', 'Commercials'), ('Form 6', 'Arts')
)
update public.school_classes school_class
set active = false,
    updated_at = now()
where school_class.campus = 'senior'
  and not exists (
    select 1
    from official_streams official
    where official.class_level = school_class.class_level
      and official.class_stream = coalesce(school_class.class_stream, '')
  )
  and not exists (
    select 1 from public.students learner
    where learner.class_level = school_class.class_level
      and coalesce(learner.class_stream, '') = coalesce(school_class.class_stream, '')
  )
  and not exists (
    select 1 from public.teacher_class_assignments assignment
    where assignment.class_level = school_class.class_level
      and coalesce(assignment.class_stream, '') = coalesce(school_class.class_stream, '')
  )
  and not exists (
    select 1 from public.teacher_class_subject_assignments assignment
    where assignment.class_level = school_class.class_level
      and coalesce(assignment.class_stream, '') = coalesce(school_class.class_stream, '')
  )
  and not exists (
    select 1 from public.coursework_assessments assessment
    where assessment.class_level = school_class.class_level
      and coalesce(assessment.class_stream, '') = coalesce(school_class.class_stream, '')
  );
