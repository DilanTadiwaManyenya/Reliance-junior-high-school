-- Parent accounts authenticate with a phone-derived internal Auth email.
alter table public.profiles add column phone text;
alter table public.profiles add constraint profiles_phone_key unique (phone);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), nullif(new.raw_user_meta_data ->> 'phone', ''), 'parent');
  return new;
end;
$$;
