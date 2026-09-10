-- Admin is the operational role. Principal is deliberately oversight-only.
-- This migration replaces every legacy policy that used the combined helper.

begin;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('parent', 'admin', 'principal', 'teacher', 'accountant', 'student'));

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;
create or replace function public.is_admin_or_principal_readonly()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'principal'));
$$;
-- Backward-compatible helper; it no longer grants Principal access.
create or replace function public.is_admin_or_principal()
returns boolean language sql stable security definer set search_path = public as $$ select public.is_admin(); $$;
revoke all on function public.is_admin() from public;
revoke all on function public.is_admin_or_principal_readonly() from public;
revoke all on function public.is_admin_or_principal() from public;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_admin_or_principal_readonly() to authenticated;
grant execute on function public.is_admin_or_principal() to authenticated;

do $$
declare policy_row record;
begin
  for policy_row in select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public' and (coalesce(qual, '') ilike '%is_admin_or_principal%' or coalesce(with_check, '') ilike '%is_admin_or_principal%')
  loop execute format('drop policy if exists %I on %I.%I', policy_row.policyname, policy_row.schemaname, policy_row.tablename);
  end loop;
end $$;

create policy "Admin principal read students" on public.students for select to authenticated using (public.is_admin_or_principal_readonly());
create policy "Admin principal read academic" on public.academic_records for select to authenticated using (public.is_admin_or_principal_readonly());
create policy "Admin principal read attendance" on public.attendance for select to authenticated using (public.is_admin_or_principal_readonly());
create policy "Admin principal read behavior" on public.behavior_notes for select to authenticated using (public.is_admin_or_principal_readonly());
create policy "Admin principal read sports" on public.sports_records for select to authenticated using (public.is_admin_or_principal_readonly());
create policy "Admin principal read fees" on public.fee_balances for select to authenticated using (public.is_admin_or_principal_readonly());
create policy "Admin principal read staff profiles" on public.profiles for select to authenticated using (public.is_admin_or_principal_readonly() and role in ('admin', 'principal', 'teacher', 'accountant'));

create policy "Admins manage students" on public.students for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage academic records" on public.academic_records for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage attendance" on public.attendance for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage behavior notes" on public.behavior_notes for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage sports records" on public.sports_records for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage fees" on public.fee_balances for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins manage teacher class assignments" on public.teacher_class_assignments;
create policy "Admins manage teacher class assignments" on public.teacher_class_assignments for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Principal reads teacher class assignments" on public.teacher_class_assignments for select to authenticated using (public.is_admin_or_principal_readonly());
drop policy if exists "Admins manage teacher subject assignments" on public.teacher_subject_assignments;
create policy "Admins manage teacher subject assignments" on public.teacher_subject_assignments for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Principal reads teacher subject assignments" on public.teacher_subject_assignments for select to authenticated using (public.is_admin_or_principal_readonly());
drop policy if exists "Admins manage staff accounts" on public.staff_accounts;
drop policy if exists "Admins and principals manage staff accounts" on public.staff_accounts;
create policy "Admins manage staff accounts" on public.staff_accounts for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Principal reads staff accounts" on public.staff_accounts for select to authenticated using (public.is_admin_or_principal_readonly());

drop policy if exists "School staff can insert announcements" on public.announcements;
drop policy if exists "Staff and admins can insert announcements" on public.announcements;
create policy "Operational staff can insert announcements" on public.announcements for insert to authenticated
  with check (public.is_school_staff() and not exists (select 1 from public.profiles where id = auth.uid() and role = 'principal') and created_by = auth.uid());

commit;

-- Live verification query:
-- select tablename, cmd, policyname, qual, with_check from pg_policies
-- where schemaname = 'public' and tablename in ('profiles','staff_accounts','students','fee_balances')
-- order by tablename, cmd, policyname;
