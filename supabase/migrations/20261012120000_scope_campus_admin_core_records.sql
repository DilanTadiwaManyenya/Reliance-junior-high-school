-- Campus-aware admin access. Main Admin (campus = all) remains school-wide;
-- Junior and Senior Admins can read or manage only their own campus.
create or replace function public.can_read_school_campus(target_campus text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (public.has_active_role('admin') or public.has_active_role('principal'))
    and exists (
      select 1
      from public.profiles profile
      where profile.id = auth.uid()
        and profile.campus in ('all', target_campus)
    );
$$;

create or replace function public.can_manage_school_campus(target_campus text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_active_role('admin')
    and exists (
      select 1
      from public.profiles profile
      where profile.id = auth.uid()
        and profile.campus in ('all', target_campus)
    );
$$;

revoke all on function public.can_read_school_campus(text) from public;
revoke all on function public.can_manage_school_campus(text) from public;
grant execute on function public.can_read_school_campus(text) to authenticated;
grant execute on function public.can_manage_school_campus(text) to authenticated;

-- Learners: remove broad staff/admin policies before adding campus-scoped ones.
drop policy if exists "Staff and admins can select students" on public.students;
drop policy if exists "Admins can insert students" on public.students;
drop policy if exists "Staff and admins can update students" on public.students;
drop policy if exists "Admin principal select students" on public.students;
drop policy if exists "Admin principal insert students" on public.students;
drop policy if exists "Admin principal update students" on public.students;
drop policy if exists "Admins manage students" on public.students;

create policy "Campus managers read students" on public.students
  for select to authenticated
  using (public.can_read_school_campus(campus));
create policy "Campus admins insert students" on public.students
  for insert to authenticated
  with check (public.can_manage_school_campus(campus));
create policy "Campus admins update students" on public.students
  for update to authenticated
  using (public.can_manage_school_campus(campus))
  with check (public.can_manage_school_campus(campus));
create policy "Campus admins delete students" on public.students
  for delete to authenticated
  using (public.can_manage_school_campus(campus));

-- Staff directory: Campus Admins can inspect only staff from their campus.
drop policy if exists "Admin principal read staff profiles" on public.profiles;
create policy "Campus managers read staff profiles" on public.profiles
  for select to authenticated
  using (
    role in ('admin', 'principal', 'teacher', 'accountant')
    and public.can_read_school_campus(campus)
  );

-- Class-teacher allocations are campus-bound.
drop policy if exists "Admins manage teacher class assignments" on public.teacher_class_assignments;
drop policy if exists "Principal reads teacher class assignments" on public.teacher_class_assignments;
create policy "Campus managers read teacher class assignments" on public.teacher_class_assignments
  for select to authenticated
  using (public.can_read_school_campus(campus));
create policy "Campus admins manage teacher class assignments" on public.teacher_class_assignments
  for all to authenticated
  using (public.can_manage_school_campus(campus))
  with check (public.can_manage_school_campus(campus));

-- Senior subject allocations are campus-bound as well; Junior remains
-- class-based and receives no subject allocation records.
drop policy if exists "Admins manage teacher class subject assignments" on public.teacher_class_subject_assignments;
create policy "Campus managers read teacher class subject assignments" on public.teacher_class_subject_assignments
  for select to authenticated
  using (public.can_read_school_campus(campus));
create policy "Campus admins manage teacher class subject assignments" on public.teacher_class_subject_assignments
  for all to authenticated
  using (public.can_manage_school_campus(campus))
  with check (public.can_manage_school_campus(campus));
