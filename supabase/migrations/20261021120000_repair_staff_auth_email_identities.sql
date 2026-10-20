-- Some staff logins were created by direct inserts into auth.users and missed
-- the email identity row required by Supabase Auth's Admin API.
begin;

insert into auth.identities (
  provider_id,
  user_id,
  identity_data,
  provider,
  created_at,
  updated_at
)
select
  u.id::text,
  u.id,
  jsonb_build_object('sub', u.id::text),
  'email',
  coalesce(u.created_at, now()),
  coalesce(u.updated_at, now())
from public.staff_accounts as staff
join auth.users as u on u.id = staff.user_id
where u.email is not null
  and not exists (
    select 1
    from auth.identities as identity
    where identity.user_id = u.id
      and identity.provider = 'email'
  )
on conflict do nothing;

do $$
begin
  if exists (
    select 1
    from public.staff_accounts as staff
    join auth.users as u on u.id = staff.user_id
    where u.email is not null
      and not exists (
        select 1
        from auth.identities as identity
        where identity.user_id = u.id
          and identity.provider = 'email'
      )
  ) then
    raise exception 'One or more staff login accounts are still missing an email identity';
  end if;
end;
$$;

commit;
