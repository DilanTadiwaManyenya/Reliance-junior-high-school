-- Junior Admins may maintain only the ECD-to-Grade-7 grade scale.
-- Main Admin keeps school-wide access, including Senior scales.
create or replace function public.is_junior_school_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_active_role('admin')
    and exists (
      select 1 from public.profiles profile
      where profile.id = auth.uid() and profile.campus = 'junior'
    );
$$;

revoke all on function public.is_junior_school_admin() from public;
grant execute on function public.is_junior_school_admin() to authenticated;

drop policy if exists "Junior Admin manages primary grade bands" on public.grade_bands;
create policy "Junior Admin manages primary grade bands" on public.grade_bands
  for all to authenticated
  using (public.is_junior_school_admin() and band_group = 'primary')
  with check (public.is_junior_school_admin() and band_group = 'primary');
