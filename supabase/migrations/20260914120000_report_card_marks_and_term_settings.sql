-- Report-card assessment inputs and school-wide term publication settings.
-- Apply in the Supabase SQL Editor after reviewing it; this migration does not
-- create users or alter any authentication credentials.

alter table public.academic_records
  add column if not exists term_mark numeric,
  add column if not exists exam_mark numeric;

alter table public.academic_records
  drop constraint if exists academic_records_term_mark_range,
  drop constraint if exists academic_records_exam_mark_range;

alter table public.academic_records
  add constraint academic_records_term_mark_range check (term_mark is null or term_mark between 0 and 100),
  add constraint academic_records_exam_mark_range check (exam_mark is null or exam_mark between 0 and 100);

-- Formula and passing line are report-card-specific. They do not alter the
-- existing GradeCalculator A-E bands or other portal grade-status indicators.
create or replace function public.report_card_final_mark(p_term_mark numeric, p_exam_mark numeric)
returns numeric language sql immutable as $$
  select case
    when p_term_mark is null or p_exam_mark is null then null
    else round((p_term_mark * 0.30) + (p_exam_mark * 0.70), 2)
  end;
$$;

create or replace function public.report_card_is_pass(p_mark numeric)
returns boolean language sql immutable as $$ select p_mark >= 50; $$;

revoke all on function public.report_card_final_mark(numeric, numeric) from public;
revoke all on function public.report_card_is_pass(numeric) from public;
grant execute on function public.report_card_final_mark(numeric, numeric) to authenticated;
grant execute on function public.report_card_is_pass(numeric) to authenticated;

create table if not exists public.term_settings (
  id uuid primary key default gen_random_uuid(),
  academic_year integer not null,
  term integer not null check (term between 1 and 3),
  next_term_begins_on date,
  next_term_fees numeric check (next_term_fees is null or next_term_fees >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (academic_year, term)
);

alter table public.term_settings enable row level security;
drop policy if exists "Authenticated users read term settings" on public.term_settings;
drop policy if exists "Admins manage term settings" on public.term_settings;
create policy "Authenticated users read term settings" on public.term_settings
  for select to authenticated using (true);
create policy "Admins manage term settings" on public.term_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Previous draft stored these school-wide values per learner. Remove them if
-- that draft has already been applied; report comments remain per learner.
alter table if exists public.report_card_comments
  drop column if exists next_term_begins_on,
  drop column if exists next_term_fees;
