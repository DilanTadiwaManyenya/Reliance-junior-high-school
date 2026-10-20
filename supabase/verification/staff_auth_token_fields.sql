-- Must return zero malformed staff Auth records.
select count(*) as staff_accounts_with_null_auth_strings
from auth.users u
where exists (select 1 from public.staff_accounts s where s.user_id=u.id)
  and (confirmation_token is null or recovery_token is null
    or email_change_token_new is null or email_change is null
    or phone_change is null or phone_change_token is null
    or email_change_token_current is null or reauthentication_token is null);
-- SQL integrity alone does not prove GoTrue can read an account.
-- Also verify GET /auth/v1/admin/users/{id} using a server-only service key.
-- Never expose that key in the frontend or commit it.
