-- TEST ONLY: pre-change schema-only function definitions for reproducing regressions.
-- Never apply this baseline to a live database.
CREATE OR REPLACE FUNCTION public.has_active_role(expected_role text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.profiles p
    join public.user_roles ur on ur.user_id = p.id and ur.role = p.active_role
    where p.id = auth.uid() and p.active_role = expected_role
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.has_active_role('admin');
$function$;

CREATE OR REPLACE FUNCTION public.can_read_school_campus(target_campus text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select (public.has_active_role('admin') or public.has_active_role('principal'))
    and exists (
      select 1
      from public.profiles profile
      where profile.id = auth.uid()
        and profile.campus in ('all', target_campus)
    );
$function$;

CREATE OR REPLACE FUNCTION public.can_manage_school_campus(target_campus text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.has_active_role('admin')
    and exists (
      select 1
      from public.profiles profile
      where profile.id = auth.uid()
        and profile.campus in ('all', target_campus)
    );
$function$;

CREATE OR REPLACE FUNCTION public.can_read_student_record(target_student_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.students student
    where student.id = target_student_id
      and public.can_read_school_campus(student.campus)
  );
$function$;

CREATE OR REPLACE FUNCTION public.accountant_can_access_campus(student_campus text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.has_active_role('accountant') and exists (
    select 1 from public.profiles p
    left join public.staff_accounts sa on sa.user_id = p.id
    where p.id = auth.uid() and p.role = 'accountant'
      and coalesce(sa.campus, p.campus) in ('junior', 'senior')
      and coalesce(sa.campus, p.campus) = student_campus
  );
$function$;

CREATE OR REPLACE FUNCTION public.correct_school_class(p_source_class_id uuid, p_target_class_id uuid)
 RETURNS school_class_corrections
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  source_class public.school_classes%rowtype;
  target_class public.school_classes%rowtype;
  result public.school_class_corrections%rowtype;
  learner_count integer := 0;
  class_assignment_count integer := 0;
  subject_assignment_count integer := 0;
  coursework_count integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Only an administrator can correct a class stream';
  end if;

  select * into source_class from public.school_classes where id = p_source_class_id for update;
  select * into target_class from public.school_classes where id = p_target_class_id for update;

  if source_class.id is null or target_class.id is null then
    raise exception 'The source or target class no longer exists';
  end if;
  if source_class.id = target_class.id then
    raise exception 'Choose a different target class';
  end if;
  if source_class.campus <> target_class.campus then
    raise exception 'A class can only be corrected within the same campus';
  end if;
  if not target_class.active then
    raise exception 'Activate the target class before moving records to it';
  end if;

  -- Create target allocations first, ignoring duplicates that already exist,
  -- then remove the old allocations. This satisfies unique constraints when
  -- a correction merges two streams that share a teacher.
  insert into public.teacher_class_assignments (teacher_id, class_level, class_stream, campus)
  select teacher_id, target_class.class_level, coalesce(target_class.class_stream, ''), target_class.campus
  from public.teacher_class_assignments
  where class_level = source_class.class_level
    and class_stream = coalesce(source_class.class_stream, '')
    and campus = source_class.campus
  on conflict (teacher_id, class_level, class_stream) do nothing;
  get diagnostics class_assignment_count = row_count;

  insert into public.teacher_class_subject_assignments (teacher_id, class_level, class_stream, subject, campus)
  select teacher_id, target_class.class_level, coalesce(target_class.class_stream, ''), subject, target_class.campus
  from public.teacher_class_subject_assignments
  where class_level = source_class.class_level
    and class_stream = coalesce(source_class.class_stream, '')
    and campus = source_class.campus
  on conflict (teacher_id, class_level, class_stream, subject) do nothing;
  get diagnostics subject_assignment_count = row_count;

  delete from public.teacher_class_assignments
  where class_level = source_class.class_level
    and class_stream = coalesce(source_class.class_stream, '')
    and campus = source_class.campus;

  delete from public.teacher_class_subject_assignments
  where class_level = source_class.class_level
    and class_stream = coalesce(source_class.class_stream, '')
    and campus = source_class.campus;

  update public.students
  set class_level = target_class.class_level,
      class_stream = target_class.class_stream,
      campus = target_class.campus
  where class_level = source_class.class_level
    and coalesce(class_stream, '') = coalesce(source_class.class_stream, '')
    and campus = source_class.campus;
  get diagnostics learner_count = row_count;

  update public.coursework_assessments
  set class_level = target_class.class_level,
      class_stream = target_class.class_stream,
      campus = target_class.campus
  where class_level = source_class.class_level
    and coalesce(class_stream, '') = coalesce(source_class.class_stream, '')
    and campus = source_class.campus;
  get diagnostics coursework_count = row_count;

  update public.school_classes
  set active = false,
      updated_at = now()
  where id = source_class.id;

  insert into public.school_class_corrections (
    source_class_id, target_class_id, source_class_level, source_class_stream,
    target_class_level, target_class_stream, learners_moved,
    class_assignments_moved, subject_assignments_moved,
    coursework_assessments_moved, corrected_by
  ) values (
    source_class.id, target_class.id, source_class.class_level, source_class.class_stream,
    target_class.class_level, target_class.class_stream, learner_count,
    class_assignment_count, subject_assignment_count, coursework_count, auth.uid()
  ) returning * into result;

  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION public.audit_admission_numbers()
 RETURNS TABLE(student_id uuid, full_name text, admission_number text, campus text, class_level text, enrolled_year integer, expected_prefix text, format_status text, student_account_status text, parent_account_status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_admin() then
    raise exception 'Only administrators can audit admission numbers.';
  end if;

  return query
  with expected as (
    select
      learner.*,
      case
        when learner.campus = 'senior' and learner.class_level ~ '^Form[[:space:]]+[1-4]$'
          then right(learner.enrolled_year::text, 2) || 'f' || regexp_replace(learner.class_level, '[^0-9]', '', 'g')
        when learner.campus = 'senior' and learner.class_level in ('Form 5', 'Lower Six')
          then right(learner.enrolled_year::text, 2) || 'f5'
        when learner.campus = 'senior' and learner.class_level in ('Form 6', 'Upper Six')
          then right(learner.enrolled_year::text, 2) || 'f6'
        when learner.campus = 'junior' and learner.class_level ~ '^Grade[[:space:]]+[1-7]$'
          then right(learner.enrolled_year::text, 2) || 'g' || regexp_replace(learner.class_level, '[^0-9]', '', 'g')
        when learner.campus = 'junior' and learner.class_level = 'ECD A'
          then right(learner.enrolled_year::text, 2) || 'eA'
        when learner.campus = 'junior' and learner.class_level = 'ECD B'
          then right(learner.enrolled_year::text, 2) || 'eB'
        else null
      end as required_prefix
    from public.students learner
  )
  select
    learner.id, learner.full_name, learner.admission_number, learner.campus,
    learner.class_level, learner.enrolled_year, learner.required_prefix,
    case
      when learner.required_prefix is null then 'Cannot determine expected prefix'
      when learner.admission_number ~ ('^' || learner.required_prefix || '[0-9]+$') then 'Valid'
      else 'Invalid syntax'
    end,
    case when exists (select 1 from public.student_accounts account where account.admission_number = learner.admission_number) then 'Linked' else 'Not linked' end,
    case when exists (select 1 from public.parent_accounts account where account.child_admission_number = learner.admission_number) then 'Linked' else 'Not linked' end
  from expected learner
  order by
    case when learner.required_prefix is not null and learner.admission_number ~ ('^' || learner.required_prefix || '[0-9]+$') then 1 else 0 end,
    learner.campus, learner.class_level, learner.full_name;
end;
$function$;

CREATE OR REPLACE FUNCTION public.report_subject_teachers_for_student(requested_student_id uuid)
 RETURNS TABLE(subject text, teacher_name text, signature_initials text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  if not (
    public.has_active_role('admin')
    or public.has_active_role('principal')
    or public.has_active_role('accountant')
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
    and (allocation.class_stream = '' or allocation.class_stream = learner.class_stream)
  join public.profiles teacher on teacher.id = allocation.teacher_id
  where learner.id = requested_student_id
  order by lower(allocation.subject),
    case when allocation.class_stream = learner.class_stream then 0 else 1 end,
    allocation.created_at desc;
end;
$function$;

CREATE OR REPLACE FUNCTION public.teacher_has_subject_student_access(requested_student_id uuid, requested_subject text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.has_active_role('teacher')
    and exists (
      select 1
      from public.teacher_class_subject_assignments allocation
      join public.students learner on learner.id = requested_student_id
      where allocation.teacher_id = auth.uid()
        and allocation.class_level = learner.class_level
        and (
          coalesce(allocation.class_stream, '') = ''
          or coalesce(allocation.class_stream, '') = coalesce(learner.class_stream, '')
        )
        and (
          requested_subject is null
          or lower(allocation.subject) = lower(requested_subject)
        )
    );
$function$;

CREATE OR REPLACE FUNCTION public.teacher_has_coursework_allocation(requested_teacher_id uuid, requested_class_level text, requested_class_stream text, requested_subject text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select auth.uid() = requested_teacher_id
    and (
      exists (
        select 1
        from public.teacher_class_subject_assignments allocation
        where allocation.teacher_id = requested_teacher_id
          and allocation.class_level = requested_class_level
          and lower(allocation.subject) = lower(requested_subject)
          and (
            coalesce(allocation.class_stream, '') = ''
            or coalesce(allocation.class_stream, '') = coalesce(requested_class_stream, '')
          )
      )
      or exists (
        select 1
        from public.profiles teacher
        join public.teacher_class_assignments assignment on assignment.teacher_id = teacher.id
        where teacher.id = requested_teacher_id
          and teacher.campus = 'junior'
          and assignment.class_level = requested_class_level
          and coalesce(assignment.class_stream, '') = coalesce(requested_class_stream, '')
      )
    );
$function$;

CREATE OR REPLACE FUNCTION public.next_admission_number(requested_year integer, requested_campus text, requested_class_level text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  class_code text := public.admission_class_code(requested_campus, requested_class_level);
  effective_campus text := coalesce(
    requested_campus,
    case when requested_class_level like 'Form %' or requested_class_level in ('Lower Six', 'Upper Six') then 'senior' else 'junior' end
  );
  next_sequence integer;
begin
  perform pg_advisory_xact_lock(hashtext(requested_year::text || ':' || effective_campus || ':' || requested_class_level));

  select sequence_number
  into next_sequence
  from generate_series(0, 99) as sequence_number
  where not exists (
    select 1
    from public.students learner
    where learner.enrolled_year = requested_year
      and learner.campus = effective_campus
      and learner.class_level = requested_class_level
      and learner.admission_number = right(requested_year::text, 2) || class_code || lpad(sequence_number::text, 2, '0')
  )
  order by sequence_number
  limit 1;

  if next_sequence is null then
    raise exception 'Admission sequence is full for % % %', requested_year, effective_campus, requested_class_level;
  end if;

  return right(requested_year::text, 2) || class_code || lpad(next_sequence::text, 2, '0');
end;
$function$;

CREATE OR REPLACE FUNCTION public.preview_admission_number(requested_year integer, requested_campus text, requested_class_level text)
 RETURNS text
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.next_admission_number(requested_year, requested_campus, requested_class_level);
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  initial_role text := coalesce(nullif(new.raw_user_meta_data ->> 'role', ''), 'parent');
begin
  if initial_role not in ('parent', 'admin', 'principal', 'teacher', 'accountant', 'student') then
    initial_role := 'parent';
  end if;

  insert into public.profiles (id, full_name, phone, role, active_role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    initial_role,
    initial_role
  );

  insert into public.user_roles (user_id, role)
  values (new.id, initial_role)
  on conflict (user_id, role) do nothing;
  return new;
end;
$function$;
