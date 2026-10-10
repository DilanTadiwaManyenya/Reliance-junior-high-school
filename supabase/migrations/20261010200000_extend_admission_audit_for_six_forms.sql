-- Lower and Upper Six share the established senior codes f5 and f6.
-- This changes the read-only audit classification only; learner records remain
-- untouched because their existing numbers already match the allocation rule.
create or replace function public.audit_admission_numbers()
returns table (
  student_id uuid,
  full_name text,
  admission_number text,
  campus text,
  class_level text,
  enrolled_year integer,
  expected_prefix text,
  format_status text,
  student_account_status text,
  parent_account_status text
)
language plpgsql
security definer
set search_path = public
as $$
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
$$;

revoke all on function public.audit_admission_numbers() from public;
grant execute on function public.audit_admission_numbers() to authenticated;
