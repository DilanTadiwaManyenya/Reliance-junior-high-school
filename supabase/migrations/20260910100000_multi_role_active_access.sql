-- Multi-role memberships with a server-enforced active authorization context.
-- Keep profiles.role as the default/legacy role; RLS uses active_role instead.

begin;

create table if not exists public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('parent', 'admin', 'principal', 'teacher', 'accountant', 'student')),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

alter table public.user_roles enable row level security;
alter table public.profiles add column if not exists active_role text;
update public.profiles set active_role = role where active_role is null;
alter table public.profiles alter column active_role set not null;
alter table public.profiles drop constraint if exists profiles_active_role_check;
alter table public.profiles add constraint profiles_active_role_check
  check (active_role in ('parent', 'admin', 'principal', 'teacher', 'accountant', 'student'));

insert into public.user_roles (user_id, role)
select id, role from public.profiles
on conflict (user_id, role) do nothing;

create or replace function public.has_active_role(expected_role text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    join public.user_roles ur on ur.user_id = p.id and ur.role = p.active_role
    where p.id = auth.uid() and p.active_role = expected_role
  );
$$;

create or replace function public.set_active_role(requested_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.user_roles where user_id = auth.uid() and role = requested_role
  ) then
    raise exception 'That role is not assigned to this account';
  end if;
  update public.profiles set active_role = requested_role where id = auth.uid();
end;
$$;

revoke all on function public.has_active_role(text) from public;
revoke all on function public.set_active_role(text) from public;
grant execute on function public.has_active_role(text) to authenticated;
grant execute on function public.set_active_role(text) to authenticated;

drop policy if exists "Users read their assigned roles" on public.user_roles;
create policy "Users read their assigned roles" on public.user_roles
  for select to authenticated using (user_id = auth.uid());

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_active_role('admin');
$$;

create or replace function public.is_admin_or_principal_readonly()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_active_role('admin') or public.has_active_role('principal');
$$;

-- Retained only for old callers; it never grants Principal privileges.
create or replace function public.is_admin_or_principal()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin();
$$;

-- Teacher policies apply only when Teacher is the active role.
create or replace function public.teacher_owns_student(check_student_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_active_role('teacher') and exists (
    select 1
    from public.teacher_class_assignments a
    join public.students s on s.id = check_student_id
    where a.teacher_id = auth.uid()
      and a.class_level = s.class_level
      and a.class_stream is not distinct from s.class_stream
  );
$$;

revoke all on function public.teacher_owns_student(uuid) from public;
grant execute on function public.teacher_owns_student(uuid) to authenticated;

-- Some deployments do not use announcements. Where it exists, Principal
-- cannot publish while Principal is the active role.
do $$
begin
  if to_regclass('public.announcements') is not null then
    drop policy if exists "Operational staff can insert announcements" on public.announcements;
    create policy "Operational staff can insert announcements" on public.announcements
      for insert to authenticated
      with check (
        public.is_school_staff()
        and not public.has_active_role('principal')
        and created_by = auth.uid()
      );
  end if;
end;
$$;

commit;


