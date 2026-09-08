-- Fix RLS Policies for attendance, academic_records, behavior_notes, and sports_records
-- Replaces broad "Staff and admins..." policies with role-restricted policies using teacher_owns_student(student_id).

begin;

-- 1. ACADEMIC RECORDS
drop policy if exists "Staff and admins can select academic records" on public.academic_records;
drop policy if exists "Staff and admins can insert academic records" on public.academic_records;
drop policy if exists "Staff and admins can update academic records" on public.academic_records;
drop policy if exists "Admin principal select academic" on public.academic_records;
drop policy if exists "Teacher select assigned academic" on public.academic_records;
drop policy if exists "Admin principal insert academic" on public.academic_records;
drop policy if exists "Teacher insert assigned academic" on public.academic_records;
drop policy if exists "Admin principal update academic" on public.academic_records;
drop policy if exists "Teacher update assigned academic" on public.academic_records;

create policy "Admin principal select academic" on public.academic_records for select to authenticated
  using (public.is_admin_or_principal());
create policy "Teacher select assigned academic" on public.academic_records for select to authenticated
  using (public.teacher_owns_student(student_id));
create policy "Admin principal insert academic" on public.academic_records for insert to authenticated
  with check (public.is_admin_or_principal());
create policy "Teacher insert assigned academic" on public.academic_records for insert to authenticated
  with check (public.teacher_owns_student(student_id));
create policy "Admin principal update academic" on public.academic_records for update to authenticated
  using (public.is_admin_or_principal()) with check (public.is_admin_or_principal());
create policy "Teacher update assigned academic" on public.academic_records for update to authenticated
  using (public.teacher_owns_student(student_id)) with check (public.teacher_owns_student(student_id));

-- 2. ATTENDANCE
drop policy if exists "Staff and admins can select attendance" on public.attendance;
drop policy if exists "Staff and admins can insert attendance" on public.attendance;
drop policy if exists "Staff and admins can update attendance" on public.attendance;
drop policy if exists "Admin principal select attendance" on public.attendance;
drop policy if exists "Teacher select assigned attendance" on public.attendance;
drop policy if exists "Admin principal insert attendance" on public.attendance;
drop policy if exists "Teacher insert assigned attendance" on public.attendance;
drop policy if exists "Admin principal update attendance" on public.attendance;
drop policy if exists "Teacher update assigned attendance" on public.attendance;

create policy "Admin principal select attendance" on public.attendance for select to authenticated
  using (public.is_admin_or_principal());
create policy "Teacher select assigned attendance" on public.attendance for select to authenticated
  using (public.teacher_owns_student(student_id));
create policy "Admin principal insert attendance" on public.attendance for insert to authenticated
  with check (public.is_admin_or_principal());
create policy "Teacher insert assigned attendance" on public.attendance for insert to authenticated
  with check (public.teacher_owns_student(student_id));
create policy "Admin principal update attendance" on public.attendance for update to authenticated
  using (public.is_admin_or_principal()) with check (public.is_admin_or_principal());
create policy "Teacher update assigned attendance" on public.attendance for update to authenticated
  using (public.teacher_owns_student(student_id)) with check (public.teacher_owns_student(student_id));

-- 3. BEHAVIOR NOTES
drop policy if exists "Staff and admins can select behavior notes" on public.behavior_notes;
drop policy if exists "Staff and admins can insert behavior notes" on public.behavior_notes;
drop policy if exists "Staff and admins can update behavior notes" on public.behavior_notes;
drop policy if exists "Admin principal select behavior" on public.behavior_notes;
drop policy if exists "Teacher select assigned behavior" on public.behavior_notes;
drop policy if exists "Admin principal insert behavior" on public.behavior_notes;
drop policy if exists "Teacher insert assigned behavior" on public.behavior_notes;
drop policy if exists "Admin principal update behavior" on public.behavior_notes;
drop policy if exists "Teacher update assigned behavior" on public.behavior_notes;

create policy "Admin principal select behavior" on public.behavior_notes for select to authenticated
  using (public.is_admin_or_principal());
create policy "Teacher select assigned behavior" on public.behavior_notes for select to authenticated
  using (public.teacher_owns_student(student_id));
create policy "Admin principal insert behavior" on public.behavior_notes for insert to authenticated
  with check (public.is_admin_or_principal());
create policy "Teacher insert assigned behavior" on public.behavior_notes for insert to authenticated
  with check (public.teacher_owns_student(student_id));
create policy "Admin principal update behavior" on public.behavior_notes for update to authenticated
  using (public.is_admin_or_principal()) with check (public.is_admin_or_principal());
create policy "Teacher update assigned behavior" on public.behavior_notes for update to authenticated
  using (public.teacher_owns_student(student_id)) with check (public.teacher_owns_student(student_id));

-- 4. SPORTS RECORDS
drop policy if exists "Staff and admins can select sports records" on public.sports_records;
drop policy if exists "Staff and admins can insert sports records" on public.sports_records;
drop policy if exists "Staff and admins can update sports records" on public.sports_records;
drop policy if exists "Admin principal select sports" on public.sports_records;
drop policy if exists "Teacher select assigned sports" on public.sports_records;
drop policy if exists "Admin principal insert sports" on public.sports_records;
drop policy if exists "Teacher insert assigned sports" on public.sports_records;
drop policy if exists "Admin principal update sports" on public.sports_records;
drop policy if exists "Teacher update assigned sports" on public.sports_records;

create policy "Admin principal select sports" on public.sports_records for select to authenticated
  using (public.is_admin_or_principal());
create policy "Teacher select assigned sports" on public.sports_records for select to authenticated
  using (public.teacher_owns_student(student_id));
create policy "Admin principal insert sports" on public.sports_records for insert to authenticated
  with check (public.is_admin_or_principal());
create policy "Teacher insert assigned sports" on public.sports_records for insert to authenticated
  with check (public.teacher_owns_student(student_id));
create policy "Admin principal update sports" on public.sports_records for update to authenticated
  using (public.is_admin_or_principal()) with check (public.is_admin_or_principal());
create policy "Teacher update assigned sports" on public.sports_records for update to authenticated
  using (public.teacher_owns_student(student_id)) with check (public.teacher_owns_student(student_id));

commit;
