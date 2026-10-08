-- Designate the explicitly approved account as the protected cross-campus
-- Main Admin. The phone comparison accepts the two formats used in the portal.
do $$
declare
  target_id uuid;
  matched_count integer;
begin
  select count(*)
    into matched_count
  from public.profiles
  where regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') in ('0787601136', '263787601136');

  if matched_count <> 1 then
    raise exception 'Expected exactly one profile for Main Admin phone 0787601136; found %.', matched_count;
  end if;

  select id into target_id
  from public.profiles
  where regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') in ('0787601136', '263787601136');

  update public.profiles
  set role = 'admin',
      active_role = 'admin',
      campus = 'all',
      is_protected = true,
      portal_access_enabled = true
  where id = target_id;

  insert into public.user_roles (user_id, role)
  values (target_id, 'admin')
  on conflict (user_id, role) do nothing;

  update public.staff_accounts
  set role = 'admin', campus = 'all'
  where user_id = target_id;
end $$;
