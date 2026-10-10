-- Marks saved by an assigned subject teacher must be visible immediately to
-- authorised report viewers (admins, accountants and verified parents).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'academic_records'
  ) then
    alter publication supabase_realtime add table public.academic_records;
  end if;
end;
$$;

drop policy if exists "Accountants select academic records" on public.academic_records;
create policy "Accountants select academic records" on public.academic_records
  for select to authenticated using (public.has_active_role('accountant'));
