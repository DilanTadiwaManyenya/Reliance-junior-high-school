-- Junior report viewers should receive saved Paper, Project and ECD-rating
-- changes immediately, just like the established senior academic-record flow.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'junior_component_marks'
  ) then
    alter publication supabase_realtime add table public.junior_component_marks;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'junior_developmental_ratings'
  ) then
    alter publication supabase_realtime add table public.junior_developmental_ratings;
  end if;
end;
$$;
