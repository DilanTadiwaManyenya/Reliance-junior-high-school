-- Grade-entry fields; legacy columns remain compatible with existing records.
alter table public.academic_records add column if not exists percentage numeric, add column if not exists points integer, add column if not exists year integer, add column if not exists teachers_comment text, add column if not exists updated_at timestamptz not null default now();
alter table public.sports_records add column if not exists sport text, add column if not exists participated boolean, add column if not exists performance_note text, add column if not exists year integer, add column if not exists updated_at timestamptz not null default now();
create unique index if not exists academic_records_grade_entry_unique on public.academic_records (student_id, subject, term, year);
create unique index if not exists sports_records_grade_entry_unique on public.sports_records (student_id, sport, term, year);
alter table public.academic_records add constraint academic_records_percentage_check check (percentage is null or percentage between 0 and 100);
create or replace function public.set_record_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists academic_records_updated_at on public.academic_records;
create trigger academic_records_updated_at before update on public.academic_records for each row execute function public.set_record_updated_at();
drop trigger if exists sports_records_updated_at on public.sports_records;
create trigger sports_records_updated_at before update on public.sports_records for each row execute function public.set_record_updated_at();
