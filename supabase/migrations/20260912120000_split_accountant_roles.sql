-- 20260912120000_split_accountant_roles.sql
-- Split the Accountant role across campuses

update public.profiles 
set campus = 'senior' 
where role = 'accountant' and phone = '+263772270091';

update public.staff_accounts 
set campus = 'senior' 
where role = 'accountant' and phone_number = '+263772270091';

do 
declare
  new_user_id uuid := gen_random_uuid();
  account_email text := 'portal-263719270092@portal.reliance.local';
  account_phone text := '+263719270092';
  account_name text := 'Accountant01';
begin
  if not exists (select 1 from auth.users where email = account_email or phone = account_phone) then
    
    insert into auth.users (
      id, instance_id, email, phone, encrypted_password, email_confirmed_at, 
      raw_user_meta_data, created_at, updated_at, role, aud
    ) values (
      new_user_id, '00000000-0000-0000-0000-000000000000', 
      account_email,
      account_phone,
      crypt('reliance2026', gen_salt('bf')), 
      now(), 
      jsonb_build_object(
        'full_name', account_name,
        'phone', account_phone,
        'role', 'accountant'
      ),
      now(), now(), 'authenticated', 'authenticated'
    );
    
    update public.profiles 
    set campus = 'junior', must_update_credentials = true
    where id = new_user_id;
    
    insert into public.staff_accounts (
      user_id, role, phone_number, name, campus, created_by
    ) values (
      new_user_id, 'accountant', account_phone, account_name, 'junior', new_user_id
    );
    
  end if;
end;
;