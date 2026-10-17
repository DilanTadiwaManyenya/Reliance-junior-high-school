-- Stage 3: deploy setup UI and Edge guards before enabling the rollout switch.
begin;
create table if not exists public.portal_security_settings (
 id integer primary key check(id=1), require_admin_mfa boolean not null default false
);
insert into public.portal_security_settings(id,require_admin_mfa) values(1,false) on conflict(id) do nothing;
alter table public.portal_security_settings enable row level security;
revoke all on public.portal_security_settings from public,anon,authenticated;
grant select on public.portal_security_settings to authenticated;
grant all on public.portal_security_settings to service_role;
drop policy if exists "Users read portal security requirements" on public.portal_security_settings;
create policy "Users read portal security requirements" on public.portal_security_settings for select to authenticated using(true);

create or replace function public.portal_mfa_satisfied()
returns boolean language sql stable security definer set search_path=public as $$
 select case when exists(select 1 from public.profiles p where p.id=auth.uid() and (p.role='admin' or p.active_role='admin'))
   or exists(select 1 from public.user_roles r where r.user_id=auth.uid() and r.role='admin')
 then not coalesce((select require_admin_mfa from public.portal_security_settings where id=1),true)
   or coalesce(auth.jwt()->>'aal'='aal2',false)
 else true end;
$$;
revoke all on function public.portal_mfa_satisfied() from public,anon;
grant execute on function public.portal_mfa_satisfied() to authenticated,service_role;

create or replace function public.has_active_role(expected_role text)
returns boolean language sql stable security definer set search_path=public as $$
 select public.portal_mfa_satisfied() and exists(
  select 1 from public.profiles p join public.user_roles r on r.user_id=p.id and r.role=p.active_role
  where p.id=auth.uid() and p.active_role=expected_role
 );
$$;
create or replace function public.is_staff_or_admin()
returns boolean language sql stable security definer set search_path=public as $$
 select public.portal_mfa_satisfied() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('staff','admin'));
$$;

-- Restrictive policies apply in addition to existing campus/ownership rules.
-- Self-profile and role membership reads remain available for MFA setup.
do $policies$ declare t record; begin
 for t in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind in ('r','p') and c.relrowsecurity
 and c.relname not in ('profiles','user_roles','portal_security_settings') loop
  execute format('drop policy if exists "Admin sessions require MFA" on public.%I',t.relname);
  execute format('create policy "Admin sessions require MFA" on public.%I as restrictive for all to authenticated using(public.portal_mfa_satisfied()) with check(public.portal_mfa_satisfied())',t.relname);
 end loop;
end; $policies$;
drop policy if exists "Admin sessions require MFA" on storage.objects;
create policy "Admin sessions require MFA" on storage.objects as restrictive for all to authenticated
using(public.portal_mfa_satisfied()) with check(public.portal_mfa_satisfied());
CREATE OR REPLACE FUNCTION public.junior_report_summary(requested_student_id uuid, requested_term integer, requested_year integer)
 RETURNS TABLE(class_size integer, class_position integer, ranked_learners integer, total_score numeric, total_possible numeric, percentage numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with target as (
    select id, class_level, coalesce(class_stream, '') as class_stream, campus,
      case
        when class_level in ('Grade 1', 'Grade 2') then 16
        when class_level in ('Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7') then 20
        else 0
      end as required_components
    from public.students
    where public.portal_mfa_satisfied() and id = requested_student_id and campus = 'junior'
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
$function$;

CREATE OR REPLACE FUNCTION public.senior_report_summary(requested_student_id uuid, requested_term integer, requested_year integer)
 RETURNS TABLE(form_size integer, form_position integer, ranked_form_learners integer, stream_size integer, stream_position integer, ranked_stream_learners integer, subjects_recorded integer, subjects_passed integer, grade_points integer, average_mark numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with target as (
    select id, class_level, coalesce(class_stream, '') as class_stream, campus
    from public.students
    where public.portal_mfa_satisfied() and id = requested_student_id
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
$function$;

CREATE OR REPLACE FUNCTION public.junior_report_class_teacher(requested_student_id uuid)
 RETURNS TABLE(teacher_name text, signature_initials text, assigned_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select teacher.full_name, teacher.signature_initials, assignment.created_at
  from public.students learner
  join public.teacher_class_assignments assignment
    on assignment.class_level = learner.class_level
   and coalesce(assignment.class_stream, '') = coalesce(learner.class_stream, '')
   and assignment.campus = 'junior'
  join public.profiles teacher on teacher.id = assignment.teacher_id
  where public.portal_mfa_satisfied() and learner.id = requested_student_id
    and learner.campus = 'junior'
    and (
      public.can_read_student_record(learner.id)
      or public.accountant_can_access_campus(learner.campus)
      or exists (
        select 1 from public.parent_student parent_link
        where parent_link.student_id = learner.id
          and parent_link.parent_id = auth.uid()
          and parent_link.verified_at is not null
      )
    )
  order by assignment.created_at desc
  limit 1;
$function$;

CREATE OR REPLACE FUNCTION public.parent_can_view_coursework_assessment(requested_assessment_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.portal_mfa_satisfied() and exists (
    select 1
    from public.coursework_marks mark
    join public.parent_student link on link.student_id = mark.student_id
    where mark.assessment_id = requested_assessment_id
      and link.parent_id = auth.uid()
      and link.verified_at is not null
  );
$function$;

CREATE OR REPLACE FUNCTION public.parent_can_view_coursework_student(requested_student_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.portal_mfa_satisfied() and exists (
    select 1 from public.parent_student link
    where link.student_id = requested_student_id
      and link.parent_id = auth.uid()
      and link.verified_at is not null
  );
$function$;

CREATE OR REPLACE FUNCTION public.report_subject_teachers_for_student(requested_student_id uuid)
 RETURNS TABLE(subject text, teacher_name text, signature_initials text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.portal_mfa_satisfied() then raise exception 'Admin two-factor verification required'; end if;
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  if not (
    public.can_read_student_record(requested_student_id)
    or exists(select 1 from public.students s where s.id=requested_student_id and public.accountant_can_access_campus(s.campus))
    or exists (
      select 1 from public.parent_student link
      where link.parent_id = auth.uid()
        and link.student_id = requested_student_id
        and link.verified_at is not null
    )
    or exists (
      select 1 from public.students learner
      where learner.id = requested_student_id
        and learner.auth_user_id = auth.uid()
    )
  ) then
    raise exception 'You are not allowed to view this learner report.';
  end if;

  return query
  select distinct on (lower(allocation.subject))
    allocation.subject,
    teacher.full_name as teacher_name,
    teacher.signature_initials
  from public.students learner
  join public.teacher_class_subject_assignments allocation
    on allocation.class_level = learner.class_level
    and allocation.campus = learner.campus
    and (allocation.class_stream = '' or allocation.class_stream = learner.class_stream)
  join public.profiles teacher on teacher.id = allocation.teacher_id and teacher.campus = learner.campus
  where learner.id = requested_student_id
  order by lower(allocation.subject),
    case when allocation.class_stream = learner.class_stream then 0 else 1 end,
    allocation.created_at desc;
end;
$function$;
CREATE OR REPLACE FUNCTION public.request_parent_student_link(requested_admission_number text, requested_date_of_birth date)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  matched_student_id uuid;
begin
  if not public.portal_mfa_satisfied() then raise exception 'Admin two-factor verification required'; end if;
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'parent') then
    raise exception 'Only parent accounts can request student verification';
  end if;

  select id into matched_student_id
  from public.students
  where admission_number = requested_admission_number
    and date_of_birth = requested_date_of_birth;

  if matched_student_id is null then
    return false;
  end if;

  insert into public.parent_student (parent_id, student_id, verified_at)
  values (auth.uid(), matched_student_id, null)
  on conflict (parent_id, student_id) do nothing;

  return true;
end;
$function$;

notify pgrst,'reload schema';
commit;
