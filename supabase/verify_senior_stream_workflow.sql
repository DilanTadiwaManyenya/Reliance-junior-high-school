-- Stage 7 (read-only): release verification for the senior stream workflow.
-- Run in the Supabase SQL Editor after the Stage 3-5 migrations.

-- 1. Every official stream must be active and have a capacity.
with official_streams (class_level, class_stream) as (
  values
    ('Form 1', 'Red'), ('Form 1', 'Blue'), ('Form 1', 'White'), ('Form 1', 'Green'),
    ('Form 2', 'Red'), ('Form 2', 'Blue'), ('Form 2', 'White'), ('Form 2', 'Green'),
    ('Form 3', 'Red'), ('Form 3', 'Blue'), ('Form 3', 'White'), ('Form 3', 'Green'), ('Form 3', 'Purple'),
    ('Form 4', 'Red'), ('Form 4', 'Blue'), ('Form 4', 'White'), ('Form 4', 'Green'), ('Form 4', 'Purple'),
    ('Form 5', 'Commercials'), ('Form 5', 'Arts'),
    ('Form 6', 'Commercials'), ('Form 6', 'Arts')
)
select official.class_level, official.class_stream,
  case
    when school_class.id is null then 'missing'
    when not school_class.active then 'inactive'
    when school_class.capacity is null then 'capacity missing'
    else 'ready'
  end as verification_status,
  school_class.capacity,
  count(learner.id) filter (where learner.status = 'active') as active_learners
from official_streams official
left join public.school_classes school_class
  on school_class.class_level = official.class_level
 and coalesce(school_class.class_stream, '') = official.class_stream
left join public.students learner
  on learner.class_level = official.class_level
 and coalesce(learner.class_stream, '') = official.class_stream
group by official.class_level, official.class_stream, school_class.id, school_class.active, school_class.capacity
order by official.class_level, official.class_stream;

-- 2. Capacity warning candidates. These are the exact rows that should show
-- "New stream recommended" in Class Management.
select school_class.class_level, school_class.class_stream, school_class.capacity,
  count(learner.id) filter (where learner.status = 'active') as active_learners,
  case when count(learner.id) filter (where learner.status = 'active') >= school_class.capacity then 'new stream recommended'
       when count(learner.id) filter (where learner.status = 'active') >= school_class.capacity * 0.9 then 'nearly full'
       else 'within capacity' end as capacity_status
from public.school_classes school_class
left join public.students learner
  on learner.class_level = school_class.class_level
 and coalesce(learner.class_stream, '') = coalesce(school_class.class_stream, '')
where school_class.active
  and school_class.capacity is not null
group by school_class.id, school_class.class_level, school_class.class_stream, school_class.capacity
order by capacity_status desc, school_class.class_level, school_class.class_stream;

-- 3. Whole-form allocations and the active stream classes they legitimately
-- cover. A blank allocation stream must expand to every active stream here.
select allocation.id as allocation_id, allocation.subject, allocation.class_level,
  coalesce(class_row.class_stream, '') as covered_stream
from public.teacher_class_subject_assignments allocation
join public.school_classes class_row
  on class_row.active
 and class_row.campus = allocation.campus
 and class_row.class_level = allocation.class_level
 and (allocation.class_stream = '' or allocation.class_stream = coalesce(class_row.class_stream, ''))
order by allocation.subject, allocation.class_level, covered_stream;

-- 4. Recent corrections are auditable. The source class should be inactive;
-- the target class should be active and hold the moved records.
select correction.created_at, correction.source_class_level, correction.source_class_stream,
  correction.target_class_level, correction.target_class_stream,
  correction.learners_moved, correction.class_assignments_moved,
  correction.subject_assignments_moved, correction.coursework_assessments_moved,
  profile.full_name as corrected_by
from public.school_class_corrections correction
join public.profiles profile on profile.id = correction.corrected_by
order by correction.created_at desc;

-- 5. Remaining active registry entries outside the confirmed structure need a
-- deliberate decision in Class Management, rather than a silent data change.
with official_streams (class_level, class_stream) as (
  values
    ('Form 1', 'Red'), ('Form 1', 'Blue'), ('Form 1', 'White'), ('Form 1', 'Green'),
    ('Form 2', 'Red'), ('Form 2', 'Blue'), ('Form 2', 'White'), ('Form 2', 'Green'),
    ('Form 3', 'Red'), ('Form 3', 'Blue'), ('Form 3', 'White'), ('Form 3', 'Green'), ('Form 3', 'Purple'),
    ('Form 4', 'Red'), ('Form 4', 'Blue'), ('Form 4', 'White'), ('Form 4', 'Green'), ('Form 4', 'Purple'),
    ('Form 5', 'Commercials'), ('Form 5', 'Arts'),
    ('Form 6', 'Commercials'), ('Form 6', 'Arts')
)
select school_class.class_level, coalesce(school_class.class_stream, '') as class_stream,
  count(learner.id) as learner_records
from public.school_classes school_class
left join official_streams official
  on official.class_level = school_class.class_level
 and official.class_stream = coalesce(school_class.class_stream, '')
left join public.students learner
  on learner.class_level = school_class.class_level
 and coalesce(learner.class_stream, '') = coalesce(school_class.class_stream, '')
where school_class.campus = 'senior'
  and school_class.active
  and official.class_level is null
group by school_class.class_level, school_class.class_stream
order by school_class.class_level, class_stream;
