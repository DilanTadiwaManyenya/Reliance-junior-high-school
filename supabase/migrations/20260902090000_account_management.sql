-- Account-management records for the Reliance portal.
-- Apply after the existing portal migrations.

create table if not exists public.staff_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'principal', 'teacher', 'accountant')),
  phone_number text not null unique,
  name text not null,
  class_assigned text,
  campus text check (campus in ('junior', 'senior')),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id)
);

create table if not exists public.student_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  admission_number text not null unique,
  phone_number text not null unique,
  verified boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.parent_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  phone_number text not null unique,
  child_admission_number text not null,
  verified boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.staff_accounts enable row level security;
alter table public.student_accounts enable row level security;
alter table public.parent_accounts enable row level security;

create policy "Admins manage staff accounts" on public.staff_accounts for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "Students view own account" on public.student_accounts for select to authenticated
  using (user_id = auth.uid());
create policy "Admins view student accounts" on public.student_accounts for select to authenticated
  using (public.is_admin());
create policy "Parents view own account" on public.parent_accounts for select to authenticated
  using (user_id = auth.uid());
create policy "Admins view parent accounts" on public.parent_accounts for select to authenticated
  using (public.is_admin());

-- Edge Functions use the service role; browser roles cannot enumerate student data.
create or replace function public.verify_student_admission(admission_number text, dob date)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.students where students.admission_number = verify_student_admission.admission_number and students.date_of_birth = verify_student_admission.dob and students.auth_user_id is null);
$$;
create or replace function public.verify_parent_admission(admission_number text, dob date)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.students where students.admission_number = verify_parent_admission.admission_number and students.date_of_birth = verify_parent_admission.dob);
$$;
revoke all on function public.verify_student_admission(text, date) from public, anon, authenticated;
revoke all on function public.verify_parent_admission(text, date) from public, anon, authenticated;
