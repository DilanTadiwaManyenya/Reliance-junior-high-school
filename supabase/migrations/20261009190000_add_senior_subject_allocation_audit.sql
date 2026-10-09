-- Stage 3: make whole-form subject coverage auditable. A blank stream on an
-- assignment means the teacher covers every active stream in that form.

create or replace view public.senior_subject_allocation_audit
with (security_invoker = true) as
select
  assignment.id as assignment_id,
  assignment.class_level,
  assignment.subject,
  assignment.class_stream as assigned_stream,
  case when assignment.class_stream = '' then true else false end as covers_whole_form,
  teacher.full_name as teacher_name,
  count(class_item.id)::integer as active_stream_count,
  coalesce(
    array_agg(class_item.class_stream order by class_item.class_stream)
      filter (where class_item.id is not null),
    '{}'::text[]
  ) as covered_streams
from public.teacher_class_subject_assignments as assignment
join public.profiles as teacher on teacher.id = assignment.teacher_id
left join public.school_classes as class_item
  on class_item.campus = assignment.campus
  and class_item.class_level = assignment.class_level
  and class_item.is_active = true
  and (assignment.class_stream = '' or assignment.class_stream = class_item.class_stream)
where assignment.campus = 'senior'
group by
  assignment.id,
  assignment.class_level,
  assignment.subject,
  assignment.class_stream,
  teacher.full_name;

comment on view public.senior_subject_allocation_audit is
  'Senior subject allocation audit. Empty assigned_stream means the assignment covers every active stream in the form.';
