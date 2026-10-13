-- Junior class position is based on the report-book total earned by each
-- fully marked learner in the same grade. Junior has no streams.

create or replace function public.junior_report_summary(
  requested_student_id uuid,
  requested_term integer,
  requested_year integer
)
returns table (
  class_size integer,
  class_position integer,
  ranked_learners integer,
  total_score numeric,
  total_possible numeric,
  percentage numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with target as (
    select id, class_level, coalesce(class_stream, '') as class_stream, campus,
      case
        when class_level in ('Grade 1', 'Grade 2') then 16
        when class_level in ('Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7') then 20
        else 0
      end as required_components
    from public.students
    where id = requested_student_id and campus = 'junior'
      and (
        public.can_read_student_record(id)
        or public.accountant_can_access_campus(campus)
        or exists (
          select 1 from public.parent_student parent_link
          where parent_link.student_id = students.id
            and parent_link.parent_id = auth.uid()
            and parent_link.verified_at is not null
        )
      )
  ), class_learners as (
    select learner.id, learner.full_name
    from public.students learner
    join target on target.class_level = learner.class_level
      and target.class_stream = coalesce(learner.class_stream, '')
    where learner.campus = 'junior' and learner.status = 'active'
  ), marks as (
    select learner.id as student_id,
      learner.full_name,
      count(distinct (mark.subject, mark.component))::integer as component_count,
      sum(mark.score)::numeric as total_score,
      sum(mark.possible_mark)::numeric as total_possible,
      (sum(mark.score) / nullif(sum(mark.possible_mark), 0) * 100)::numeric as percentage
    from class_learners learner
    join public.junior_component_marks mark on mark.student_id = learner.id
      and mark.term::text = requested_term::text and mark.year = requested_year
    group by learner.id, learner.full_name
  ), ranked as (
    select marks.*, row_number() over (
      order by total_score desc, percentage desc, lower(full_name), student_id
    )::integer as class_position
    from marks join target on true
    where target.required_components > 0
      and marks.component_count = target.required_components
  )
  select
    (select count(*)::integer from class_learners),
    (select class_position from ranked where student_id = target.id),
    (select count(*)::integer from ranked),
    (select total_score from marks where student_id = target.id),
    (select total_possible from marks where student_id = target.id),
    (select percentage from marks where student_id = target.id)
  from target;
$$;

revoke all on function public.junior_report_summary(uuid, integer, integer) from public;
grant execute on function public.junior_report_summary(uuid, integer, integer) to authenticated;
