-- Protected primary account and append-only application activity log.
-- Do not mark an account protected here: use the reviewed one-time UPDATE below.

alter table public.profiles
  add column if not exists is_protected boolean not null default false;

-- This policy is deliberately additive.  It affects only rows explicitly marked
-- protected and requires the profile owner to perform any update to that row.
drop policy if exists "Protected profiles are self-update only" on public.profiles;
create policy "Protected profiles are self-update only"
  on public.profiles as restrictive for update to authenticated
  using (not is_protected or id = auth.uid())
  with check (not is_protected or id = auth.uid());

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  actor_role text,
  action_type text not null check (action_type in ('login', 'page_view', 'create', 'update', 'delete')),
  description text,
  target_table text,
  target_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_created_at_desc_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_actor_id_idx on public.audit_logs (actor_id);

alter table public.audit_logs enable row level security;

drop policy if exists "Users insert their own audit events" on public.audit_logs;
create policy "Users insert their own audit events"
  on public.audit_logs for insert to authenticated
  with check (actor_id = auth.uid());

drop policy if exists "Admins and principals read audit events" on public.audit_logs;

-- Kept local to audit access because older live projects may not yet have the
-- newer is_admin_or_principal_readonly() helper.
create or replace function public.can_view_audit_logs()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'principal')
  );
$$;
revoke all on function public.can_view_audit_logs() from public;
grant execute on function public.can_view_audit_logs() to authenticated;

create policy "Admins and principals read audit events"
  on public.audit_logs for select to authenticated
  using (public.can_view_audit_logs());

-- Do not permit application users to alter or erase audit history.
revoke update, delete on public.audit_logs from authenticated;

-- The browser may supply an activity description, but identity facts come from
-- the authenticated profile so a client cannot claim another role/name.
create or replace function public.set_audit_log_actor()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  supplied_metadata jsonb := coalesce(new.metadata, '{}'::jsonb);
begin
  if new.actor_id is distinct from auth.uid() then
    raise exception 'Audit actor must match the authenticated user';
  end if;
  select role into new.actor_role
    from public.profiles where id = auth.uid();
  select (supplied_metadata - 'actor_name') || jsonb_build_object('actor_name', full_name) into new.metadata
    from public.profiles where id = auth.uid();
  return new;
end;
$$;

drop trigger if exists audit_logs_set_actor on public.audit_logs;
create trigger audit_logs_set_actor
  before insert on public.audit_logs
  for each row execute function public.set_audit_log_actor();
