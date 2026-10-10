-- Use an escape string so the regular expression receives one backslash.
create or replace function public.staff_signature_initials(source_name text)
returns text
language sql
immutable
set search_path = public
as $$
  select nullif(string_agg(upper(left(part, 1)), '' order by position), '')
  from regexp_split_to_table(
    regexp_replace(trim(coalesce(source_name, '')), E'\\s+', ' ', 'g'),
    E'\\s+'
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
    new.legal_full_name := regexp_replace(btrim(new.legal_full_name), E'\\s+', ' ', 'g');
    new.signature_initials := public.staff_signature_initials(new.legal_full_name);
  end if;
  return new;
end;
$$;
