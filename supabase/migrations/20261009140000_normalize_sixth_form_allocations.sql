-- Normalize historic teaching/work records to the confirmed Lower Six and
-- Upper Six terminology. Learner records are intentionally not changed.

-- Create target class-teacher assignments first, then remove the old labels.
-- This merges duplicates safely under the table's unique constraint.
insert into public.teacher_class_assignments (teacher_id, class_level, class_stream, campus)
select teacher_id,
  case class_level when 'Form 5' then 'Lower Six' else 'Upper Six' end,
  class_stream,
  campus
from public.teacher_class_assignments
where campus = 'senior' and class_level in ('Form 5', 'Form 6')
on conflict (teacher_id, class_level, class_stream) do nothing;

delete from public.teacher_class_assignments
where campus = 'senior' and class_level in ('Form 5', 'Form 6');

-- Subject allocations use the same safe insert-then-delete approach.
insert into public.teacher_class_subject_assignments (teacher_id, class_level, class_stream, subject, campus)
select teacher_id,
  case class_level when 'Form 5' then 'Lower Six' else 'Upper Six' end,
  class_stream,
  subject,
  campus
from public.teacher_class_subject_assignments
where campus = 'senior' and class_level in ('Form 5', 'Form 6')
on conflict (teacher_id, class_level, class_stream, subject) do nothing;

delete from public.teacher_class_subject_assignments
where campus = 'senior' and class_level in ('Form 5', 'Form 6');

update public.coursework_assessments
set class_level = case class_level when 'Form 5' then 'Lower Six' else 'Upper Six' end
where campus = 'senior' and class_level in ('Form 5', 'Form 6');

update public.profiles
set class_level = case class_level when 'Form 5' then 'Lower Six' else 'Upper Six' end
where role = 'teacher' and class_level in ('Form 5', 'Form 6');
