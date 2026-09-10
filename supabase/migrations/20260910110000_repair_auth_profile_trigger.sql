-- New auth users must satisfy the active-role model introduced above.
-- The trigger runs in the auth transaction, so an invalid profile insert makes
-- Supabase report the generic "Database error creating new user" message.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  initial_role text := coalesce(nullif(new.raw_user_meta_data ->> 'role', ''), 'parent');
begin
  if initial_role not in ('parent', 'admin', 'principal', 'teacher', 'accountant', 'student') then
    initial_role := 'parent';
  end if;

  insert into public.profiles (id, full_name, phone, role, active_role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    initial_role,
    initial_role
  );

  insert into public.user_roles (user_id, role)
  values (new.id, initial_role)
  on conflict (user_id, role) do nothing;
  return new;
end;
$$;
