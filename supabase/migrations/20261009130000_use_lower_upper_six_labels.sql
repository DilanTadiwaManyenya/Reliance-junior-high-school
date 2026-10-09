-- The confirmed school terminology is Lower Six and Upper Six, not Form 5
-- and Form 6. This is a registry correction only: it deliberately does not
-- move learners or alter their historic class labels.

with official_sixth_form_streams (class_level, class_stream) as (
  values
    ('Lower Six', 'Commercials'), ('Lower Six', 'Arts'),
    ('Upper Six', 'Commercials'), ('Upper Six', 'Arts')
)
insert into public.school_classes (class_level, class_stream, campus, active)
select class_level, class_stream, 'senior', true
from official_sixth_form_streams
on conflict do nothing;

with official_sixth_form_streams (class_level, class_stream) as (
  values
    ('Lower Six', 'Commercials'), ('Lower Six', 'Arts'),
    ('Upper Six', 'Commercials'), ('Upper Six', 'Arts')
)
update public.school_classes school_class
set campus = 'senior', active = true, updated_at = now()
from official_sixth_form_streams official
where school_class.class_level = official.class_level
  and coalesce(school_class.class_stream, '') = official.class_stream;

-- Retire Form 5/Form 6 registry rows only when they are completely unused.
-- If a future import has attached a dependency, the row remains visible for
-- an administrator to correct through the audited correction workflow.
update public.school_classes school_class
set active = false, updated_at = now()
where school_class.campus = 'senior'
  and school_class.class_level in ('Form 5', 'Form 6')
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
