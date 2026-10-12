-- Resolve learner-record campus access through the learner, so an Admin can
-- never read or change a record belonging to the other campus.
create or replace function public.can_read_student_record(target_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.students student
    where student.id = target_student_id
      and public.can_read_school_campus(student.campus)
  );
$$;

create or replace function public.can_manage_student_record(target_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.students student
    where student.id = target_student_id
      and public.can_manage_school_campus(student.campus)
  );
$$;

revoke all on function public.can_read_student_record(uuid) from public;
revoke all on function public.can_manage_student_record(uuid) from public;
grant execute on function public.can_read_student_record(uuid) to authenticated;
grant execute on function public.can_manage_student_record(uuid) to authenticated;

-- Academic records.
drop policy if exists "Admin principal select academic" on public.academic_records;
drop policy if exists "Admin principal read academic" on public.academic_records;
drop policy if exists "Admin principal insert academic" on public.academic_records;
drop policy if exists "Admin principal update academic" on public.academic_records;
drop policy if exists "Admins manage academic records" on public.academic_records;
create policy "Campus managers read academic" on public.academic_records
  for select to authenticated using (public.can_read_student_record(student_id));
create policy "Campus admins manage academic" on public.academic_records
  for all to authenticated
  using (public.can_manage_student_record(student_id))
  with check (public.can_manage_student_record(student_id));

-- Attendance.
drop policy if exists "Admin principal select attendance" on public.attendance;
drop policy if exists "Admin principal read attendance" on public.attendance;
drop policy if exists "Admin principal insert attendance" on public.attendance;
drop policy if exists "Admin principal update attendance" on public.attendance;
drop policy if exists "Admins manage attendance" on public.attendance;
create policy "Campus managers read attendance" on public.attendance
  for select to authenticated using (public.can_read_student_record(student_id));
create policy "Campus admins manage attendance" on public.attendance
  for all to authenticated
  using (public.can_manage_student_record(student_id))
  with check (public.can_manage_student_record(student_id));

-- Behaviour records.
drop policy if exists "Admin principal select behavior" on public.behavior_notes;
drop policy if exists "Admin principal read behavior" on public.behavior_notes;
drop policy if exists "Admin principal insert behavior" on public.behavior_notes;
drop policy if exists "Admin principal update behavior" on public.behavior_notes;
drop policy if exists "Admins manage behavior notes" on public.behavior_notes;
create policy "Campus managers read behavior" on public.behavior_notes
  for select to authenticated using (public.can_read_student_record(student_id));
create policy "Campus admins manage behavior" on public.behavior_notes
  for all to authenticated
  using (public.can_manage_student_record(student_id))
  with check (public.can_manage_student_record(student_id));

-- Sport records.
drop policy if exists "Admin principal select sports" on public.sports_records;
drop policy if exists "Admin principal read sports" on public.sports_records;
drop policy if exists "Admin principal insert sports" on public.sports_records;
drop policy if exists "Admin principal update sports" on public.sports_records;
drop policy if exists "Admins manage sports records" on public.sports_records;
create policy "Campus managers read sports" on public.sports_records
  for select to authenticated using (public.can_read_student_record(student_id));
create policy "Campus admins manage sports" on public.sports_records
  for all to authenticated
  using (public.can_manage_student_record(student_id))
  with check (public.can_manage_student_record(student_id));
