-- Direct SQL provisioning left nullable Auth string fields unset.
-- GoTrue expects empty strings when no confirmation/recovery/change is pending.
-- Preserve existing token values, passwords, identities, roles and account IDs.
begin;
update auth.users u
set confirmation_token = coalesce(u.confirmation_token, ''),
    recovery_token = coalesce(u.recovery_token, ''),
    email_change_token_new = coalesce(u.email_change_token_new, ''),
    email_change = coalesce(u.email_change, ''),
    phone_change = coalesce(u.phone_change, ''),
    phone_change_token = coalesce(u.phone_change_token, ''),
    email_change_token_current = coalesce(u.email_change_token_current, ''),
    reauthentication_token = coalesce(u.reauthentication_token, '')
where exists (select 1 from public.staff_accounts s where s.user_id = u.id)
  and (u.confirmation_token is null or u.recovery_token is null
    or u.email_change_token_new is null or u.email_change is null
    or u.phone_change is null or u.phone_change_token is null
    or u.email_change_token_current is null or u.reauthentication_token is null);
commit;
