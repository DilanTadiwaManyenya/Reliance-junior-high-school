-- Full role model: admin, principal, teacher (one class), accountant, parent, student.
-- Apply after the earlier portal migrations.

-- Review this migration separately if you want to inspect the legacy conversion:
-- update public.profiles set role = 'teacher' where role = 'staff';
alter table public.profiles drop constraint if exists profiles_role_check;
update public.profiles set role = 'teacher' where role = 'staff';
alter table public.profiles add constraint profiles_role_check
  check (role in ('parent', 'admin', 'principal', 'teacher', 'accountant', 'student'));
alter table public.profiles add column if not exists class_level text;
alter table public.profiles add column if not exists class_stream text;

create or replace function public.is_admin_or_principal()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'principal'));
$$;
create or replace function public.is_accountant()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'accountant');
$$;
create or replace function public.is_school_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'principal', 'teacher', 'accountant'));
$$;
create or replace function public.teacher_owns_student(check_student_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles teacher
    join public.students student on student.id = check_student_id
    where teacher.id = auth.uid() and teacher.role = 'teacher'
      and teacher.class_level = student.class_level
      and teacher.class_stream is not distinct from student.class_stream
  );
$$;

revoke all on function public.is_admin_or_principal() from public;
revoke all on function public.is_accountant() from public;
revoke all on function public.is_school_staff() from public;
revoke all on function public.teacher_owns_student(uuid) from public;
grant execute on function public.is_admin_or_principal() to authenticated;
grant execute on function public.is_accountant() to authenticated;
grant execute on function public.is_school_staff() to authenticated;
grant execute on function public.teacher_owns_student(uuid) to authenticated;

-- Remove only old broad staff policies; parent and student policies are untouched.
do $$
declare policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename in ('students', 'academic_records', 'attendance', 'behavior_notes', 'sports_records', 'fee_balances')
      and (qual ilike '%is_staff_or_admin%' or with_check ilike '%is_staff_or_admin%')
  loop
    execute format('drop policy if exists %I on %I.%I', policy_row.policyname, policy_row.schemaname, policy_row.tablename);
  end loop;

  -- Existing restrictive fee/inactive gates retain their shape, but only admin/principal
  -- bypass them. Teachers remain constrained to their assigned class.
  for policy_row in
    select schemaname, tablename, policyname, qual, with_check from pg_policies
    where schemaname = 'public'
      and tablename in ('students', 'academic_records', 'attendance', 'behavior_notes', 'sports_records')
      and permissive = 'RESTRICTIVE'
      and (qual ilike '%is_staff_or_admin%' or with_check ilike '%is_staff_or_admin%')
  loop
    execute format('alter policy %I on %I.%I using (%s) with check (%s)', policy_row.policyname, policy_row.schemaname, policy_row.tablename,
      replace(coalesce(policy_row.qual, 'true'), 'is_staff_or_admin()', 'is_admin_or_principal()'),
      replace(coalesce(policy_row.with_check, 'true'), 'is_staff_or_admin()', 'is_admin_or_principal()'));
  end loop;
end $$;

create policy "Admin principal select students" on public.students for select to authenticated using (public.is_admin_or_principal());
create policy "Accountant select students" on public.students for select to authenticated using (public.is_accountant());
create policy "Teacher select assigned students" on public.students for select to authenticated using (public.teacher_owns_student(id));
create policy "Admin principal insert students" on public.students for insert to authenticated with check (public.is_admin_or_principal());
create policy "Admin principal update students" on public.students for update to authenticated using (public.is_admin_or_principal()) with check (public.is_admin_or_principal());

-- Each record table gets identical admin/principal full access and teacher class access.
create policy "Admin principal select academic" on public.academic_records for select to authenticated using (public.is_admin_or_principal());
create policy "Teacher select assigned academic" on public.academic_records for select to authenticated using (public.teacher_owns_student(student_id));
create policy "Admin principal insert academic" on public.academic_records for insert to authenticated with check (public.is_admin_or_principal());
create policy "Teacher insert assigned academic" on public.academic_records for insert to authenticated with check (public.teacher_owns_student(student_id));
create policy "Admin principal update academic" on public.academic_records for update to authenticated using (public.is_admin_or_principal()) with check (public.is_admin_or_principal());
create policy "Teacher update assigned academic" on public.academic_records for update to authenticated using (public.teacher_owns_student(student_id)) with check (public.teacher_owns_student(student_id));
create policy "Admin principal select attendance" on public.attendance for select to authenticated using (public.is_admin_or_principal());
create policy "Teacher select assigned attendance" on public.attendance for select to authenticated using (public.teacher_owns_student(student_id));
create policy "Admin principal insert attendance" on public.attendance for insert to authenticated with check (public.is_admin_or_principal());
create policy "Teacher insert assigned attendance" on public.attendance for insert to authenticated with check (public.teacher_owns_student(student_id));
create policy "Admin principal update attendance" on public.attendance for update to authenticated using (public.is_admin_or_principal()) with check (public.is_admin_or_principal());
create policy "Teacher update assigned attendance" on public.attendance for update to authenticated using (public.teacher_owns_student(student_id)) with check (public.teacher_owns_student(student_id));
create policy "Admin principal select behavior" on public.behavior_notes for select to authenticated using (public.is_admin_or_principal());
create policy "Teacher select assigned behavior" on public.behavior_notes for select to authenticated using (public.teacher_owns_student(student_id));
create policy "Admin principal insert behavior" on public.behavior_notes for insert to authenticated with check (public.is_admin_or_principal());
create policy "Teacher insert assigned behavior" on public.behavior_notes for insert to authenticated with check (public.teacher_owns_student(student_id));
create policy "Admin principal update behavior" on public.behavior_notes for update to authenticated using (public.is_admin_or_principal()) with check (public.is_admin_or_principal());
create policy "Teacher update assigned behavior" on public.behavior_notes for update to authenticated using (public.teacher_owns_student(student_id)) with check (public.teacher_owns_student(student_id));
create policy "Admin principal select sports" on public.sports_records for select to authenticated using (public.is_admin_or_principal());
create policy "Teacher select assigned sports" on public.sports_records for select to authenticated using (public.teacher_owns_student(student_id));
create policy "Admin principal insert sports" on public.sports_records for insert to authenticated with check (public.is_admin_or_principal());
create policy "Teacher insert assigned sports" on public.sports_records for insert to authenticated with check (public.teacher_owns_student(student_id));
create policy "Admin principal update sports" on public.sports_records for update to authenticated using (public.is_admin_or_principal()) with check (public.is_admin_or_principal());
create policy "Teacher update assigned sports" on public.sports_records for update to authenticated using (public.teacher_owns_student(student_id)) with check (public.teacher_owns_student(student_id));

alter table public.fee_balances enable row level security;
create policy "Admin principal manage fees" on public.fee_balances for all to authenticated using (public.is_admin_or_principal()) with check (public.is_admin_or_principal());
create policy "Accountant manage fees" on public.fee_balances for all to authenticated using (public.is_accountant()) with check (public.is_accountant());

create policy "Admin principal select staff profiles" on public.profiles for select to authenticated
  using (public.is_admin_or_principal() and role in ('admin', 'principal', 'teacher', 'accountant'));

drop policy if exists "Users can select announcements for their audience" on public.announcements;
drop policy if exists "Staff and admins can insert announcements" on public.announcements;
create policy "Users can select announcements for their audience" on public.announcements for select to authenticated using (
  audience = 'all' or (audience = 'parents' and exists (select 1 from public.profiles where id = auth.uid() and role = 'parent'))
  or (audience = 'staff' and public.is_school_staff())
  or (audience = 'students' and exists (select 1 from public.profiles where id = auth.uid() and role = 'student'))
);
create policy "School staff can insert announcements" on public.announcements for insert to authenticated with check (public.is_school_staff() and created_by = auth.uid());
