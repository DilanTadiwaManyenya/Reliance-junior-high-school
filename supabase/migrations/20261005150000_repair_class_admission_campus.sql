-- Derive admission prefixes from the class level so teacher-created rows do
-- not depend on a client-provided campus value.
create or replace function public.admission_class_code(student_campus text, student_class_level text)
returns text language sql immutable as $$
  select case
    when student_class_level ~ '^Form [1-4]$' then 'f' || regexp_replace(student_class_level, '\D', '', 'g')
    when student_class_level in ('Form 5', 'Lower Six') then 'f5'
    when student_class_level in ('Form 6', 'Upper Six') then 'f6'
    when student_class_level ~ '^Grade [1-7]$' then 'g' || regexp_replace(student_class_level, '\D', '', 'g')
    when student_class_level = 'ECD A' then 'eA'
    when student_class_level = 'ECD B' then 'eB'
    else 'x0'
  end;
$$;

create or replace function public.next_admission_number(requested_year integer, requested_campus text, requested_class_level text)
returns text language plpgsql security definer set search_path = public as $$
declare
  class_code text := public.admission_class_code(requested_campus, requested_class_level);
  effective_campus text := coalesce(requested_campus, case when requested_class_level like 'Form %' or requested_class_level in ('Lower Six', 'Upper Six') then 'senior' else 'junior' end);
  next_sequence integer;
begin
  perform pg_advisory_xact_lock(hashtext(requested_year::text || ':' || effective_campus || ':' || requested_class_level));
  select coalesce(max(right(admission_number, 2)::integer), -1) + 1 into next_sequence
  from public.students where enrolled_year = requested_year and campus = effective_campus and class_level = requested_class_level
    and admission_number ~ ('^' || right(requested_year::text, 2) || class_code || '[0-9]{2}$');
  if next_sequence > 99 then raise exception 'Admission sequence is full for % % %', requested_year, effective_campus, requested_class_level; end if;
  return right(requested_year::text, 2) || class_code || lpad(next_sequence::text, 2, '0');
end;
$$;

create or replace function public.assign_yearly_admission_number()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.campus := coalesce(new.campus, case when new.class_level like 'Form %' or new.class_level in ('Lower Six', 'Upper Six') then 'senior' else 'junior' end);
  new.admission_number := public.next_admission_number(new.enrolled_year, new.campus, new.class_level);
  return new;
end;
$$;

create temporary table malformed_admission_repair on commit drop as
select id, admission_number as old_number, public.next_admission_number(enrolled_year, campus, class_level) as new_number
from public.students where admission_number ~ '^[0-9]{2}x0[0-9]{2}$';

update public.students student set admission_number = map.new_number from malformed_admission_repair map where student.id = map.id;
update public.student_accounts account set admission_number = map.new_number from malformed_admission_repair map where account.admission_number = map.old_number;
update public.parent_accounts account set child_admission_number = map.new_number from malformed_admission_repair map where account.child_admission_number = map.old_number;
