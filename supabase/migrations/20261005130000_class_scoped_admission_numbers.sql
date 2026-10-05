-- Class-scoped admission numbers: 26f100 = 2026, Form 1, learner 00;
-- 26g100 = 2026, Grade 1, learner 00. Each class/year starts from 00.
begin;

create or replace function public.admission_class_code(student_campus text, student_class_level text)
returns text language sql immutable as $$
  select case
    when student_class_level ~ '^Form [1-6]$'
      then 'f' || regexp_replace(student_class_level, '\D', '', 'g')
    when student_class_level ~ '^Grade [1-7]$'
      then 'g' || regexp_replace(student_class_level, '\D', '', 'g')
    when student_class_level = 'ECD A' then 'eA'
    when student_class_level = 'ECD B' then 'eB'
    -- Preserve uniqueness for legacy/non-standard class labels until staff
    -- normalise them through the class manager.
    else 'u' || lower(regexp_replace(coalesce(student_campus, 'unknown') || coalesce(student_class_level, 'unassigned'), '[^A-Za-z0-9]', '', 'g'))
  end;
$$;

create temporary table class_admission_renumbering on commit drop as
select id, admission_number as old_number,
  right(enrolled_year::text, 2) || public.admission_class_code(campus, class_level) ||
  lpad((row_number() over (partition by enrolled_year, campus, class_level order by admission_number, id) - 1)::text, 2, '0') as new_number
from public.students;

update public.students student set admission_number = '__class_renumber__' || student.id::text;

do $$
begin
  if to_regclass('public.student_accounts') is not null then
    update public.student_accounts account set admission_number = '__class_renumber__' || map.id::text
    from class_admission_renumbering map where account.admission_number = map.old_number;
  end if;
  if to_regclass('public.parent_accounts') is not null then
    update public.parent_accounts account set child_admission_number = '__class_renumber__' || map.id::text
    from class_admission_renumbering map where account.child_admission_number = map.old_number;
  end if;
end $$;

update public.students student set admission_number = map.new_number from class_admission_renumbering map where student.id = map.id;

do $$
begin
  if to_regclass('public.student_accounts') is not null then
    update public.student_accounts account set admission_number = map.new_number
    from class_admission_renumbering map where account.admission_number = '__class_renumber__' || map.id::text;
  end if;
  if to_regclass('public.parent_accounts') is not null then
    update public.parent_accounts account set child_admission_number = map.new_number
    from class_admission_renumbering map where account.child_admission_number = '__class_renumber__' || map.id::text;
  end if;
end $$;

create or replace function public.next_admission_number(requested_year integer, requested_campus text, requested_class_level text)
returns text language plpgsql security definer set search_path = public as $$
declare class_code text := public.admission_class_code(requested_campus, requested_class_level); next_sequence integer;
begin
  perform pg_advisory_xact_lock(hashtext(requested_year::text || ':' || requested_campus || ':' || requested_class_level));
  select coalesce(max(right(admission_number, 2)::integer), -1) + 1 into next_sequence
  from public.students
  where enrolled_year = requested_year and campus = requested_campus and class_level = requested_class_level
    and admission_number ~ ('^' || right(requested_year::text, 2) || class_code || '[0-9]{2}$');
  if next_sequence > 99 then raise exception 'Admission sequence is full for % % %', requested_year, requested_campus, requested_class_level; end if;
  return right(requested_year::text, 2) || class_code || lpad(next_sequence::text, 2, '0');
end;
$$;

create or replace function public.assign_yearly_admission_number()
returns trigger language plpgsql security definer set search_path = public as $$
begin new.admission_number := public.next_admission_number(new.enrolled_year, new.campus, new.class_level); return new; end;
$$;

revoke all on function public.next_admission_number(integer, text, text) from public;
grant execute on function public.next_admission_number(integer, text, text) to authenticated;
commit;
