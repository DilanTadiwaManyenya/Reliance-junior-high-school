-- Read-only admission-number audit.
-- Canonical school syntax is YY + campus code + class number + learner sequence:
--   26f146 = 2026, Senior/Form 1, sequence 46
--   26g500 = 2026, Junior/Grade 5, sequence 00
-- This stage deliberately audits only; it does not renumber any learner.

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
        when learner.campus = 'senior' and learner.class_level ~ '^Form[[:space:]]+[0-9]+$'
          then right(learner.enrolled_year::text, 2) || 'f' || regexp_replace(learner.class_level, '[^0-9]', '', 'g')
        when learner.campus = 'junior' and learner.class_level ~ '^Grade[[:space:]]+[0-9]+$'
          then right(learner.enrolled_year::text, 2) || 'g' || regexp_replace(learner.class_level, '[^0-9]', '', 'g')
        else null
      end as required_prefix
    from public.students learner
  )
  select
    learner.id,
    learner.full_name,
    learner.admission_number,
    learner.campus,
    learner.class_level,
    learner.enrolled_year,
    learner.required_prefix,
    case
      when learner.required_prefix is null then 'Cannot determine expected prefix'
      when learner.admission_number ~ ('^' || learner.required_prefix || '[0-9]+$') then 'Valid'
      else 'Invalid syntax'
    end,
    case
      when exists (
        select 1 from public.student_accounts account
        where account.admission_number = learner.admission_number
      ) then 'Linked'
      else 'Not linked'
    end,
    case
      when exists (
        select 1 from public.parent_accounts account
        where account.child_admission_number = learner.admission_number
      ) then 'Linked'
      else 'Not linked'
    end
  from expected learner
  order by
    case when learner.required_prefix is not null and learner.admission_number ~ ('^' || learner.required_prefix || '[0-9]+$') then 1 else 0 end,
    learner.campus,
    learner.class_level,
    learner.full_name;
end;
$$;

revoke all on function public.audit_admission_numbers() from public;
grant execute on function public.audit_admission_numbers() to authenticated;
