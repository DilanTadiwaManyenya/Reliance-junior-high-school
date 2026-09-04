-- Reliance Learning Centre: Form 1 Green + Form 1 White + Mr Chayabanda
-- Run in Supabase SQL Editor after the normal portal migrations.
--
-- FIRST create Mr Chayabanda from the portal's Staff screen (or the existing
-- create_staff_account Edge Function) using phone +263772000001. This script
-- securely assigns that existing auth account to both classes; it does not
-- create an auth user or store a password in SQL.

begin;

-- 1. Allow the student register fields required by this intake.
alter table public.students
  add column if not exists sex text check (sex in ('M', 'F')),
  add column if not exists birth_cert_no text,
  add column if not exists address text;

-- 2. A teacher can be assigned to more than one class.
create table if not exists public.teacher_class_assignments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  class_level text not null,
  class_stream text not null,
  campus text not null default 'senior' check (campus in ('junior', 'senior')),
  created_at timestamptz not null default now(),
  unique (teacher_id, class_level, class_stream)
);

alter table public.teacher_class_assignments enable row level security;
drop policy if exists "Admins manage teacher class assignments" on public.teacher_class_assignments;
drop policy if exists "Teachers view their class assignments" on public.teacher_class_assignments;
create policy "Admins manage teacher class assignments" on public.teacher_class_assignments for all to authenticated
  using (public.is_admin_or_principal()) with check (public.is_admin_or_principal());
create policy "Teachers view their class assignments" on public.teacher_class_assignments for select to authenticated
  using (teacher_id = auth.uid());

-- 3. Make existing teacher RLS policies use every assigned class, not just one.
create or replace function public.teacher_owns_student(check_student_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.profiles teacher
    join public.teacher_class_assignments assignment on assignment.teacher_id = teacher.id
    join public.students student on student.id = check_student_id
    where teacher.id = auth.uid()
      and teacher.role = 'teacher'
      and assignment.class_level = student.class_level
      and assignment.class_stream is not distinct from student.class_stream
  );
$$;
revoke all on function public.teacher_owns_student(uuid) from public;
grant execute on function public.teacher_owns_student(uuid) to authenticated;

-- 4. Find the pre-created teacher account and assign both Form 1 streams.
create or replace function public.teacher_owns_student(check_student_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.profiles teacher
    join public.teacher_class_assignments assignment on assignment.teacher_id = teacher.id
    join public.students student on student.id = check_student_id
    where teacher.id = auth.uid()
      and teacher.role = 'teacher'
      and assignment.class_level = student.class_level
      and assignment.class_stream is not distinct from student.class_stream
  );
$$;
revoke all on function public.teacher_owns_student(uuid) from public;
grant execute on function public.teacher_owns_student(uuid) to authenticated;

-- 5. Verify setup.
select sa.name, sa.phone_number, sa.role, sa.class_assigned, sa.campus
from public.staff_accounts sa where sa.phone_number = '+263772000001';
select p.full_name, a.class_level, a.class_stream, a.campus
from public.teacher_class_assignments a join public.profiles p on p.id = a.teacher_id
where p.full_name = 'Mr. Chayabanda'
order by a.class_stream;

commit;
