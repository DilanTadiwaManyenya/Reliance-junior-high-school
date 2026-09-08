-- Create teacher_class_assignments join table and update teacher_owns_student RLS policy helper.

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

create policy "Admins manage teacher class assignments"
  on public.teacher_class_assignments for all to authenticated
  using (public.is_admin_or_principal()) with check (public.is_admin_or_principal());

create policy "Teachers view their class assignments"
  on public.teacher_class_assignments for select to authenticated
  using (teacher_id = auth.uid());

-- Function to check if a teacher owns a student via teacher_class_assignments
create or replace function public.teacher_owns_student(check_student_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.teacher_class_assignments a
    join public.students s on s.id = check_student_id
    join public.profiles p on p.id = a.teacher_id
    where a.teacher_id = auth.uid()
      and p.role = 'teacher'
      and a.class_level = s.class_level
      and a.class_stream is not distinct from s.class_stream
  );
$$;

revoke all on function public.teacher_owns_student(uuid) from public;
grant execute on function public.teacher_owns_student(uuid) to authenticated;
