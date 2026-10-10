-- Keep a verified identity separate from the short portal name shown to users.
-- Existing staff are intentionally left blank until an administrator confirms
-- their legal name; the system must not infer it from Mr/Ms + surname.
alter table public.profiles
  add column if not exists legal_full_name text,
  add column if not exists working_title text,
  add column if not exists signature_initials text;

alter table public.profiles
  add constraint profiles_working_title_check
  check (working_title is null or working_title in ('Mr', 'Ms'));

create or replace function public.staff_signature_initials(source_name text)
returns text
language sql
immutable
set search_path = public
as $$
  select nullif(string_agg(upper(left(part, 1)), '' order by position), '')
  from regexp_split_to_table(
    regexp_replace(trim(coalesce(source_name, '')), '\s+', ' ', 'g'),
    '\s+'
  ) with ordinality as words(part, position)
  where part <> '';
$$;

create or replace function public.sync_staff_signature_initials()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.legal_full_name is null or btrim(new.legal_full_name) = '' then
    new.legal_full_name := null;
    new.signature_initials := null;
  else
    new.legal_full_name := regexp_replace(btrim(new.legal_full_name), '\s+', ' ', 'g');
    new.signature_initials := public.staff_signature_initials(new.legal_full_name);
  end if;
  return new;
end;
$$;

drop trigger if exists sync_staff_signature_initials on public.profiles;
create trigger sync_staff_signature_initials
before insert or update of legal_full_name on public.profiles
for each row execute function public.sync_staff_signature_initials();
