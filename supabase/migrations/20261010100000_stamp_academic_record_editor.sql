-- Keep the audit source for a subject mark on the server. The teacher markbook
-- never displays this value, but later school reports can safely trace each
-- subject result to the authenticated staff account that last saved it.
create or replace function public.stamp_academic_record_editor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    new.recorded_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists stamp_academic_record_editor on public.academic_records;
create trigger stamp_academic_record_editor
before insert or update on public.academic_records
for each row execute function public.stamp_academic_record_editor();
