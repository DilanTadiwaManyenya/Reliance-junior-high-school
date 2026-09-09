-- Teacher onboarding and curriculum allocation.  Placeholder accounts are
-- explicitly marked so they cannot access a dashboard until updated.

alter table public.profiles
  add column if not exists must_update_credentials boolean not null default false;

create table if not exists public.teacher_subject_assignments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null,
  form_level text not null,
  created_at timestamptz not null default now(),
  unique (teacher_id, subject, form_level)
);

alter table public.teacher_subject_assignments enable row level security;

drop policy if exists "Admins manage teacher subject assignments" on public.teacher_subject_assignments;
create policy "Admins manage teacher subject assignments"
  on public.teacher_subject_assignments for all to authenticated
  using (public.is_admin_or_principal()) with check (public.is_admin_or_principal());

drop policy if exists "Teachers view their subject assignments" on public.teacher_subject_assignments;
create policy "Teachers view their subject assignments"
  on public.teacher_subject_assignments for select to authenticated
  using (teacher_id = auth.uid());

-- Permit a principal as well as an administrator to manage staff records.
drop policy if exists "Admins manage staff accounts" on public.staff_accounts;
create policy "Admins and principals manage staff accounts" on public.staff_accounts for all to authenticated
  using (public.is_admin_or_principal()) with check (public.is_admin_or_principal());
