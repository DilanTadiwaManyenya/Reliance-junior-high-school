-- Grade bands, report term schedules and the fee structure affect the whole
-- school. They are intentionally reserved for the Main Admin (campus = all),
-- not either campus-scoped administrator.

create or replace function public.is_main_school_admin()
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
        and profile.campus = 'all'
    );
$$;

revoke all on function public.is_main_school_admin() from public;
grant execute on function public.is_main_school_admin() to authenticated;

drop policy if exists "Admins manage grade bands" on public.grade_bands;
create policy "Main Admin manages grade bands" on public.grade_bands
  for all to authenticated
  using (public.is_main_school_admin())
  with check (public.is_main_school_admin());

drop policy if exists "Admins manage report term fees" on public.report_term_fee_settings;
create policy "Main Admin manages report term fees" on public.report_term_fee_settings
  for all to authenticated
  using (public.is_main_school_admin())
  with check (public.is_main_school_admin());

drop policy if exists "Allow update access to admins" on public.fee_structure_mapping;
drop policy if exists "Main Admin manages fee structure" on public.fee_structure_mapping;
create policy "Main Admin manages fee structure" on public.fee_structure_mapping
  for all to authenticated
  using (public.is_main_school_admin())
  with check (public.is_main_school_admin());
