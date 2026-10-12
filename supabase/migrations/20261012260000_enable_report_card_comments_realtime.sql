-- Keep the official report-book notes in sync for authorised staff and parents.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'report_card_comments'
  ) then
    alter publication supabase_realtime add table public.report_card_comments;
  end if;
end $$;
