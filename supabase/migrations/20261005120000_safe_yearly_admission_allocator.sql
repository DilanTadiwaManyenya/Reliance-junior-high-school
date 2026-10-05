-- Generate the school-wide yearly sequence in Postgres, not from a teacher's
-- class-limited browser roster. The advisory lock makes concurrent enrolments safe.
create or replace function public.next_admission_number(requested_year integer)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare next_sequence integer;
begin
  perform pg_advisory_xact_lock(requested_year);
  select coalesce(max(nullif(left(admission_number, length(admission_number) - 4), '')::integer), 0) + 1
    into next_sequence
  from public.students
  where enrolled_year = requested_year
    and admission_number ~ ('^[0-9]{3,}' || requested_year::text || '$');
  return lpad(next_sequence::text, 3, '0') || requested_year::text;
end;
$$;

create or replace function public.assign_yearly_admission_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.admission_number := public.next_admission_number(new.enrolled_year);
  return new;
end;
$$;

drop trigger if exists trg_assign_yearly_admission_number on public.students;
create trigger trg_assign_yearly_admission_number
  before insert on public.students
  for each row execute function public.assign_yearly_admission_number();

revoke all on function public.next_admission_number(integer) from public;
grant execute on function public.next_admission_number(integer) to authenticated;
