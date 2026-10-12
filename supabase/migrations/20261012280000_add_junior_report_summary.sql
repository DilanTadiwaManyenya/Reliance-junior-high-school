-- Return only the requesting learner's report summary. The ranking is based
-- on saved Junior component marks in the same grade and term, never on a
-- display-only calculation in the browser.
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
    select id, class_level, coalesce(class_stream, '') as class_stream, campus
    from public.students
    where id = requested_student_id
      and campus = 'junior'
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
    select learner.id
    from public.students learner
    join target on target.class_level = learner.class_level
      and target.class_stream = coalesce(learner.class_stream, '')
    where learner.campus = 'junior' and learner.status = 'active'
  ), marks as (
    select learner.id as student_id,
      sum(mark.score)::numeric as total_score,
      sum(mark.possible_mark)::numeric as total_possible,
      (sum(mark.score) / nullif(sum(mark.possible_mark), 0) * 100)::numeric as percentage
    from class_learners learner
    join public.junior_component_marks mark on mark.student_id = learner.id
      and mark.term::text = requested_term::text and mark.year = requested_year
    group by learner.id
  ), ranked as (
    select marks.*, rank() over (order by percentage desc) :: integer as class_position
    from marks
  )
  select
    (select count(*)::integer from class_learners),
    (select class_position from ranked where student_id = target.id),
    (select count(*)::integer from ranked),
    (select total_score from ranked where student_id = target.id),
    (select total_possible from ranked where student_id = target.id),
    (select percentage from ranked where student_id = target.id)
  from target;
$$;

revoke all on function public.junior_report_summary(uuid, integer, integer) from public;
grant execute on function public.junior_report_summary(uuid, integer, integer) to authenticated;
