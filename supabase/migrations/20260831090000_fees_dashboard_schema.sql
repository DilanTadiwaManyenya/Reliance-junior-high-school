-- ════════════════════════════════════════════════════════════════════
-- MIGRATION: Fees Dashboard Schema Enhancements
-- Adds campus field to profiles, parent_name/phone denormalized on
-- students for fast fee dashboard queries, and ECD class support.
-- ════════════════════════════════════════════════════════════════════

-- ── 1. Add campus to profiles (staff) ─────────────────────────────
alter table public.profiles
  add column if not exists campus text
    check (campus in ('junior', 'senior', 'all'));

-- Default admins/principals to 'all'
update public.profiles
  set campus = 'all'
  where role in ('admin', 'principal') and campus is null;

-- ── 2. Add campus to students table ───────────────────────────────
alter table public.students
  add column if not exists campus text
    check (campus in ('junior', 'senior'));

-- ── 3. Denormalize parent info onto students ───────────────────────
-- This avoids a join on every fees page load. Updated by trigger or
-- manually when parents table changes.
alter table public.students
  add column if not exists parent_name  text,
  add column if not exists parent_phone text;

-- ── 4. Update class_level constraint to allow ECD A/B ─────────────
-- Remove old check if it exists and add updated one
alter table public.students
  drop constraint if exists students_class_level_check;

alter table public.students
  add constraint students_class_level_check
    check (class_level in (
      'ECD A', 'ECD B',
      'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4',
      'Grade 5', 'Grade 6', 'Grade 7',
      'Form 1', 'Form 2', 'Form 3', 'Form 4', 'Form 5', 'Form 6'
    ));

-- ── 5. Add notes to fee_balances ──────────────────────────────────
alter table public.fee_balances
  add column if not exists notes text,
  add column if not exists payment_date date;

-- ── 6. Auto-derive campus from class_level ─────────────────────────
create or replace function public.derive_student_campus()
returns trigger language plpgsql as $$
begin
  if new.class_level in (
    'ECD A', 'ECD B',
    'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4',
    'Grade 5', 'Grade 6', 'Grade 7',
    'Form 1', 'Form 2'
  ) then
    new.campus := 'junior';
  else
    new.campus := 'senior';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_student_campus on public.students;
create trigger trg_student_campus
  before insert or update of class_level on public.students
  for each row execute function public.derive_student_campus();

-- Backfill existing students
update public.students set class_level = class_level where true;

-- ── 7. RLS: accountants filtered by campus ────────────────────────
-- Accountants with campus='junior' only see junior students
create or replace function public.accountant_campus_match(student_campus text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'accountant'
      and (campus = 'all' or campus = student_campus or campus is null)
  );
$$;

revoke all on function public.accountant_campus_match(text) from public;
grant execute on function public.accountant_campus_match(text) to authenticated;

-- Update fee_balances accountant policy to be campus-aware
drop policy if exists "Accountant manage fees" on public.fee_balances;
create policy "Accountant manage fees" on public.fee_balances
  for all to authenticated
  using (
    public.is_accountant() and (
      select public.accountant_campus_match(s.campus)
      from public.students s where s.id = student_id
    )
  )
  with check (
    public.is_accountant() and (
      select public.accountant_campus_match(s.campus)
      from public.students s where s.id = student_id
    )
  );
