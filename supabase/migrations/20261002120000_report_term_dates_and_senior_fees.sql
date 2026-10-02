-- Report footer settings are configured per report term and senior-school form.
create table if not exists public.report_term_fee_settings (
  id uuid primary key default gen_random_uuid(),
  academic_year integer not null,
  term integer not null check (term between 1 and 3),
  class_level text not null check (class_level in ('Form 1', 'Form 2', 'Form 3', 'Form 4', 'Form 5', 'Form 6')),
  amount numeric not null check (amount >= 0),
  updated_at timestamptz not null default now(),
  unique (academic_year, term, class_level)
);

alter table public.report_term_fee_settings enable row level security;
drop policy if exists "Authenticated users read report term fees" on public.report_term_fee_settings;
drop policy if exists "Admins manage report term fees" on public.report_term_fee_settings;
create policy "Authenticated users read report term fees" on public.report_term_fee_settings for select to authenticated using (true);
create policy "Admins manage report term fees" on public.report_term_fee_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
