-- Senior reports have two positions: one across the entire form and one in
-- the learner's own stream. Ranking gives priority to subjects passed, then
-- the total grade points, then the average recorded mark.

create or replace function public.senior_report_summary(
  requested_student_id uuid,
  requested_term integer,
  requested_year integer
)
returns table (
  form_size integer,
  form_position integer,
  ranked_form_learners integer,
  stream_size integer,
  stream_position integer,
  ranked_stream_learners integer,
  subjects_recorded integer,
  subjects_passed integer,
  grade_points integer,
  average_mark numeric
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
      and campus = 'senior'
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
  ), form_learners as (
    select learner.id, learner.full_name, coalesce(learner.class_stream, '') as class_stream
    from public.students learner
    join target on target.class_level = learner.class_level
    where learner.campus = 'senior' and learner.status = 'active'
  ), performance as (
    select learner.id as student_id,
      learner.full_name,
      learner.class_stream,
      count(record.id)::integer as subjects_recorded,
      count(record.id) filter (
        where (
          (learner.class_stream in ('Arts', 'Commercials', 'Sciences') and record.grade in ('A', 'B', 'C', 'D', 'E', 'O'))
          or (learner.class_stream not in ('Arts', 'Commercials', 'Sciences') and record.grade in ('A', 'B', 'C', 'D'))
        )
      )::integer as subjects_passed,
      coalesce(sum(case record.grade
        when 'A' then 5 when 'B' then 4 when 'C' then 3 when 'D' then 2 when 'E' then 1 else 0 end), 0)::integer as grade_points,
      avg(coalesce(record.exam_mark, record.term_mark, record.percentage, record.score))::numeric as average_mark
    from form_learners learner
    left join public.academic_records record on record.student_id = learner.id
      and record.term::text = requested_term::text
      and record.year = requested_year
    group by learner.id, learner.full_name, learner.class_stream
  ), ranked_form as (
    select performance.*, row_number() over (
      order by subjects_passed desc, grade_points desc, average_mark desc nulls last, lower(full_name), student_id
    )::integer as form_position
    from performance
    where subjects_recorded > 0
  ), ranked_stream as (
    select performance.*, row_number() over (
      partition by class_stream
      order by subjects_passed desc, grade_points desc, average_mark desc nulls last, lower(full_name), student_id
    )::integer as stream_position
    from performance
    where subjects_recorded > 0
  )
  select
    (select count(*)::integer from form_learners),
    (select form_position from ranked_form where student_id = target.id),
    (select count(*)::integer from ranked_form),
    (select count(*)::integer from form_learners where class_stream = target.class_stream),
    (select stream_position from ranked_stream where student_id = target.id),
    (select count(*)::integer from ranked_stream where class_stream = target.class_stream),
    (select subjects_recorded from performance where student_id = target.id),
    (select subjects_passed from performance where student_id = target.id),
    (select grade_points from performance where student_id = target.id),
    (select average_mark from performance where student_id = target.id)
  from target;
$$;

revoke all on function public.senior_report_summary(uuid, integer, integer) from public;
grant execute on function public.senior_report_summary(uuid, integer, integer) to authenticated;
