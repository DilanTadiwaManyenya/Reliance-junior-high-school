-- Read-only verification: all staff login accounts have an email identity.
select
  count(*) filter (where identity.id is null) as staff_accounts_missing_email_identity,
  count(*) as staff_accounts_with_email_login
from public.staff_accounts as staff
join auth.users as u on u.id = staff.user_id
left join auth.identities as identity
  on identity.user_id = u.id
  and identity.provider = 'email'
where u.email is not null;
