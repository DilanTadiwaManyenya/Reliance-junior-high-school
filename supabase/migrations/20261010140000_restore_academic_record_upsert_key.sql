-- The teacher markbook upsert is keyed by learner, subject, term and year.
-- Do not merge historic marks automatically if a duplicate is found.
do $$
begin
  if exists (
    select 1
    from public.academic_records
    where term is not null and year is not null
    group by student_id, subject, term, year
    having count(*) > 1
  ) then
    raise exception 'Duplicate academic records exist for the same learner, subject, term and year. Resolve them before restoring the markbook save key.';
  end if;
end;
$$;

create unique index if not exists academic_records_grade_entry_unique
  on public.academic_records (student_id, subject, term, year);
