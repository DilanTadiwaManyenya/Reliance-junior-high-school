-- Keep the existing two-digit admission suffixes, then extend each
-- year/class prefix to three digits when a cohort exceeds 100 learners.
-- Streams share a class prefix, so a two-digit sequence capped every stream
-- combined at 100 learners per year.
begin;

create or replace function public.next_admission_number(
  requested_year integer,
  requested_campus text,
  requested_class_level text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  class_code text := public.admission_class_code(requested_campus, requested_class_level);
  admission_prefix text := right(requested_year::text, 2) || class_code;
  next_sequence integer;
begin
  -- Different display labels may emit the same prefix; lock that shared
  -- namespace so parallel enrolments cannot allocate the same number.
  perform pg_advisory_xact_lock(hashtext(requested_year::text || ':' || class_code));

  select coalesce(max(substring(admission_number from length(admission_prefix) + 1)::integer), -1) + 1
    into next_sequence
  from public.students
  where admission_number ~ ('^' || admission_prefix || '[0-9]{2,3}$');

  if next_sequence > 999 then
    raise exception 'Admission sequence is full for % %', requested_year, requested_class_level;
  end if;

  return admission_prefix || lpad(next_sequence::text, greatest(2, length(next_sequence::text)), '0');
end;
$$;

commit;
