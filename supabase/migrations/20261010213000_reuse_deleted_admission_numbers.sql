-- Keep an admission number reserved while its learner row exists, including
-- inactive learners. When a learner is permanently deleted, their class/year
-- sequence becomes the next available number again.
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
$$;
