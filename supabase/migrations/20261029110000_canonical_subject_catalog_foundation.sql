-- Establish stable subject identities and curriculum group scopes while
-- retaining the legacy text labels consumed by existing portal code.
begin;

create or replace function public.normalize_subject_label(p_label text)
returns text
language sql
immutable
parallel safe
set search_path = public
as $$
  select regexp_replace(lower(trim(coalesce(p_label, ''))), '[^a-z0-9]+', '', 'g');
$$;
revoke all on function public.normalize_subject_label(text) from public, anon;
grant execute on function public.normalize_subject_label(text) to authenticated, service_role;

create table if not exists public.subject_catalog (
  id uuid primary key default gen_random_uuid(),
  subject_code text not null unique check (subject_code ~ '^[a-z][a-z0-9_]{1,79}$'),
  display_name text not null check (length(trim(display_name)) between 2 and 120),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.curriculum_subject_groups (
  group_code text primary key check (group_code ~ '^[a-z][a-z0-9_]{1,79}$'),
  display_name text not null,
  sort_order integer not null unique
);

create table if not exists public.subject_catalog_aliases (
  alias_key text not null,
  alias_label text not null check (length(trim(alias_label)) between 2 and 120),
  subject_id uuid not null references public.subject_catalog(id) on delete restrict,
  group_code text not null references public.curriculum_subject_groups(group_code) on delete cascade,
  created_at timestamptz not null default now(),
  check (alias_key = public.normalize_subject_label(alias_label)),
  primary key (alias_key, group_code)
);

create table if not exists public.subject_catalog_group_memberships (
  subject_id uuid not null references public.subject_catalog(id) on delete cascade,
  group_code text not null references public.curriculum_subject_groups(group_code) on delete cascade,
  primary key (subject_id, group_code)
);

alter table public.teacher_class_subject_assignments
  add column if not exists subject_id uuid references public.subject_catalog(id) on delete restrict;
create index if not exists teacher_class_subject_assignments_subject_id_idx
  on public.teacher_class_subject_assignments(subject_id)
  where subject_id is not null;

insert into public.subject_catalog(subject_code, display_name) values
  ('english_language', 'English Language'),
  ('chishona', 'Chishona'),
  ('heritage_studies', 'Heritage Studies')
on conflict (subject_code) do update set display_name = excluded.display_name;

insert into public.curriculum_subject_groups(group_code, display_name, sort_order) values
  ('ecd_a_b', 'ECD A & B', 10),
  ('grade_1_2', 'Grade 1 & 2', 20),
  ('grade_3_7', 'Grade 3–7', 30),
  ('form_1_2_zgc', 'Form 1 & 2 (ZGC)', 40),
  ('form_3_4', 'Form 3 & 4', 50),
  ('lower_six_sciences', 'Lower Six · Sciences', 60),
  ('lower_six_commercials', 'Lower Six · Commercials', 70),
  ('lower_six_arts', 'Lower Six · Arts', 80),
  ('upper_six_sciences', 'Upper Six · Sciences', 90),
  ('upper_six_commercials', 'Upper Six · Commercials', 100),
  ('upper_six_arts', 'Upper Six · Arts', 110)
on conflict (group_code) do update
set display_name = excluded.display_name, sort_order = excluded.sort_order;

insert into public.subject_catalog_aliases(alias_key, alias_label, subject_id, group_code)
select public.normalize_subject_label(alias.alias_label), alias.alias_label, subject.id, alias.group_code
from (values
  ('english_language', 'English Language', 'form_1_2_zgc'), ('english_language', 'English', 'form_1_2_zgc'),
  ('english_language', 'English Language', 'form_3_4'), ('english_language', 'English', 'form_3_4'),
  ('chishona', 'Chishona', 'form_1_2_zgc'), ('chishona', 'Shona', 'form_1_2_zgc'),
  ('chishona', 'Chishona', 'form_3_4'), ('chishona', 'Shona', 'form_3_4'),
  ('chishona', 'Chishona', 'lower_six_sciences'), ('chishona', 'Shona', 'lower_six_sciences'),
  ('chishona', 'Chishona', 'lower_six_commercials'), ('chishona', 'Shona', 'lower_six_commercials'),
  ('chishona', 'Chishona', 'lower_six_arts'), ('chishona', 'Shona', 'lower_six_arts'),
  ('chishona', 'Chishona', 'upper_six_sciences'), ('chishona', 'Shona', 'upper_six_sciences'),
  ('chishona', 'Chishona', 'upper_six_commercials'), ('chishona', 'Shona', 'upper_six_commercials'),
  ('chishona', 'Chishona', 'upper_six_arts'), ('chishona', 'Shona', 'upper_six_arts'),
  ('heritage_studies', 'Heritage Studies', 'form_1_2_zgc'), ('heritage_studies', 'Heritage', 'form_1_2_zgc'),
  ('heritage_studies', 'Heritage Studies', 'form_3_4'), ('heritage_studies', 'Heritage', 'form_3_4'),
  ('heritage_studies', 'Heritage Studies', 'lower_six_sciences'), ('heritage_studies', 'Heritage', 'lower_six_sciences'),
  ('heritage_studies', 'Heritage Studies', 'lower_six_commercials'), ('heritage_studies', 'Heritage', 'lower_six_commercials'),
  ('heritage_studies', 'Heritage Studies', 'lower_six_arts'), ('heritage_studies', 'Heritage', 'lower_six_arts'),
  ('heritage_studies', 'Heritage Studies', 'upper_six_sciences'), ('heritage_studies', 'Heritage', 'upper_six_sciences'),
  ('heritage_studies', 'Heritage Studies', 'upper_six_commercials'), ('heritage_studies', 'Heritage', 'upper_six_commercials'),
  ('heritage_studies', 'Heritage Studies', 'upper_six_arts'), ('heritage_studies', 'Heritage', 'upper_six_arts')
) as alias(subject_code, alias_label, group_code)
join public.subject_catalog subject using (subject_code)
on conflict (alias_key, group_code) do update
set alias_label = excluded.alias_label, subject_id = excluded.subject_id;

insert into public.subject_catalog_group_memberships(subject_id, group_code)
select subject.id, mapping.group_code
from (values
  ('english_language', 'form_1_2_zgc'), ('english_language', 'form_3_4'),
  ('chishona', 'form_1_2_zgc'), ('chishona', 'form_3_4'),
  ('chishona', 'lower_six_sciences'), ('chishona', 'lower_six_commercials'), ('chishona', 'lower_six_arts'),
  ('chishona', 'upper_six_sciences'), ('chishona', 'upper_six_commercials'), ('chishona', 'upper_six_arts'),
  ('heritage_studies', 'form_1_2_zgc'), ('heritage_studies', 'form_3_4'),
  ('heritage_studies', 'lower_six_sciences'), ('heritage_studies', 'lower_six_commercials'), ('heritage_studies', 'lower_six_arts'),
  ('heritage_studies', 'upper_six_sciences'), ('heritage_studies', 'upper_six_commercials'), ('heritage_studies', 'upper_six_arts')
) as mapping(subject_code, group_code)
join public.subject_catalog subject using (subject_code)
on conflict (subject_id, group_code) do nothing;

-- Backfill only the three aliases confirmed in the stage-one audit. The
-- original label stays intact for existing reports and current portal code.
update public.teacher_class_subject_assignments allocation
set subject_id = alias.subject_id
from public.subject_catalog_aliases alias
where public.normalize_subject_label(allocation.subject) = alias.alias_key
  and alias.group_code = case
    when allocation.class_level in ('Form 1', 'Form 2') then 'form_1_2_zgc'
    when allocation.class_level in ('Form 3', 'Form 4') then 'form_3_4'
    when allocation.class_level = 'Lower Six' then 'lower_six_' || lower(coalesce(nullif(allocation.class_stream, ''), ''))
    when allocation.class_level = 'Upper Six' then 'upper_six_' || lower(coalesce(nullif(allocation.class_stream, ''), ''))
    else null
  end
  and allocation.subject_id is distinct from alias.subject_id;

alter table public.subject_catalog enable row level security;
alter table public.subject_catalog_aliases enable row level security;
alter table public.curriculum_subject_groups enable row level security;
alter table public.subject_catalog_group_memberships enable row level security;

revoke all on public.subject_catalog, public.subject_catalog_aliases,
  public.curriculum_subject_groups, public.subject_catalog_group_memberships from public, anon;
grant select on public.subject_catalog, public.subject_catalog_aliases,
  public.curriculum_subject_groups, public.subject_catalog_group_memberships to authenticated, service_role;
grant insert, update, delete on public.subject_catalog, public.subject_catalog_aliases,
  public.curriculum_subject_groups, public.subject_catalog_group_memberships to authenticated, service_role;

drop policy if exists "Authenticated users read subject catalog" on public.subject_catalog;
create policy "Authenticated users read subject catalog" on public.subject_catalog
  for select to authenticated using (true);
drop policy if exists "Admins manage subject catalog" on public.subject_catalog;
create policy "Admins manage subject catalog" on public.subject_catalog
  for all to authenticated using (public.has_active_role('admin') and public.portal_mfa_satisfied())
  with check (public.has_active_role('admin') and public.portal_mfa_satisfied());

drop policy if exists "Authenticated users read subject aliases" on public.subject_catalog_aliases;
create policy "Authenticated users read subject aliases" on public.subject_catalog_aliases
  for select to authenticated using (true);
drop policy if exists "Admins manage subject aliases" on public.subject_catalog_aliases;
create policy "Admins manage subject aliases" on public.subject_catalog_aliases
  for all to authenticated using (public.has_active_role('admin') and public.portal_mfa_satisfied())
  with check (public.has_active_role('admin') and public.portal_mfa_satisfied());

drop policy if exists "Authenticated users read curriculum subject groups" on public.curriculum_subject_groups;
create policy "Authenticated users read curriculum subject groups" on public.curriculum_subject_groups
  for select to authenticated using (true);
drop policy if exists "Admins manage curriculum subject groups" on public.curriculum_subject_groups;
create policy "Admins manage curriculum subject groups" on public.curriculum_subject_groups
  for all to authenticated using (public.has_active_role('admin') and public.portal_mfa_satisfied())
  with check (public.has_active_role('admin') and public.portal_mfa_satisfied());

drop policy if exists "Authenticated users read subject group membership" on public.subject_catalog_group_memberships;
create policy "Authenticated users read subject group membership" on public.subject_catalog_group_memberships
  for select to authenticated using (true);
drop policy if exists "Admins manage subject group membership" on public.subject_catalog_group_memberships;
create policy "Admins manage subject group membership" on public.subject_catalog_group_memberships
  for all to authenticated using (public.has_active_role('admin') and public.portal_mfa_satisfied())
  with check (public.has_active_role('admin') and public.portal_mfa_satisfied());

commit;
