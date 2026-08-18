-- Reliance Learning Centre parent portal schema and access boundary.
-- Apply this migration using the Supabase CLI or the Supabase dashboard SQL editor.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null default 'parent' check (role in ('parent', 'staff', 'admin')),
  created_at timestamptz not null default now()
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  admission_number text not null unique,
  date_of_birth date not null,
  class_level text not null,
  class_stream text,
  enrolled_year integer not null,
  status text not null default 'active'
);

create table public.parent_student (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (parent_id, student_id)
);

create table public.academic_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  term text not null,
  subject text not null,
  score numeric not null,
  grade text not null,
  comment text,
  recorded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  date date not null,
  status text not null check (status in ('present', 'late', 'absent')),
  late_minutes integer,
  note text,
  recorded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  check ((status = 'late' and late_minutes is not null) or (status <> 'late' and late_minutes is null))
);

create table public.behavior_notes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  category text not null,
  description text not null,
  severity text not null check (severity in ('positive', 'minor', 'major')),
  recorded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.sports_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  activity text not null,
  term text not null,
  achievement text,
  note text,
  recorded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

-- These helpers read roles without granting users read access to anyone else's profile.
create function public.is_staff_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('staff', 'admin')
  );
$$;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- A profile is created by the trusted auth trigger, not directly by the browser.
-- This preserves the rule that users may only read or update their own profile.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), 'parent');
  return new;
end;
$$;

-- Do not leave SECURITY DEFINER helpers callable by anonymous/public roles.
-- Authenticated users need the role helpers because the RLS policies invoke them.
revoke all on function public.is_staff_or_admin() from public;
revoke all on function public.is_admin() from public;
grant execute on function public.is_staff_or_admin() to authenticated;
grant execute on function public.is_admin() to authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Parent sign-up verifies a relationship immediately after a successful match,
-- without granting direct INSERT on parent_student.
create function public.request_parent_student_link(
  requested_admission_number text,
  requested_date_of_birth date
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  matched_student_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'parent') then
    raise exception 'Only parent accounts can request student verification';
  end if;

  select id into matched_student_id
  from public.students
  where admission_number = requested_admission_number
    and date_of_birth = requested_date_of_birth;

  if matched_student_id is null then
    return false;
  end if;

  insert into public.parent_student (parent_id, student_id, verified_at)
  values (auth.uid(), matched_student_id, now())
  on conflict (parent_id, student_id) do update set verified_at = excluded.verified_at;

  return true;
end;
$$;

grant execute on function public.request_parent_student_link(text, date) to authenticated;
revoke all on function public.request_parent_student_link(text, date) from public;
grant execute on function public.request_parent_student_link(text, date) to authenticated;

alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.parent_student enable row level security;
alter table public.academic_records enable row level security;
alter table public.attendance enable row level security;
alter table public.behavior_notes enable row level security;
alter table public.sports_records enable row level security;

-- Profiles: users can only view and amend their own profile.
create policy "Users can select their own profile"
  on public.profiles for select to authenticated
  using (id = auth.uid());
create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Users may update their name only. Role changes must be performed by a trusted administrator process.
revoke update on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;

-- Students: parents can only see a student with an approved relationship; staff and admins manage students.
create policy "Parents can select verified linked students"
  on public.students for select to authenticated
  using (exists (
    select 1 from public.parent_student ps
    where ps.student_id = students.id
      and ps.parent_id = auth.uid()
      and ps.verified_at is not null
  ));
create policy "Staff and admins can select students"
  on public.students for select to authenticated using (public.is_staff_or_admin());
create policy "Admins can insert students"
  on public.students for insert to authenticated with check (public.is_admin());
create policy "Staff and admins can update students"
  on public.students for update to authenticated
  using (public.is_staff_or_admin()) with check (public.is_staff_or_admin());

-- Parent relationships: parents only see their own links. Admins alone create and manage verification links.
create policy "Parents can select their own parent student links"
  on public.parent_student for select to authenticated using (parent_id = auth.uid());
create policy "Admins can select parent student links"
  on public.parent_student for select to authenticated using (public.is_admin());
create policy "Admins can insert parent student links"
  on public.parent_student for insert to authenticated with check (public.is_admin());
create policy "Admins can update parent student links"
  on public.parent_student for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "Admins can delete parent student links"
  on public.parent_student for delete to authenticated using (public.is_admin());

-- Records: a parent can only read records belonging to a verified linked student.
-- There are intentionally no parent write policies for any record table.
create policy "Parents can select verified linked academic records"
  on public.academic_records for select to authenticated using (exists (
    select 1 from public.parent_student ps
    where ps.student_id = academic_records.student_id and ps.parent_id = auth.uid() and ps.verified_at is not null
  ));
create policy "Staff and admins can select academic records"
  on public.academic_records for select to authenticated
  using (public.is_staff_or_admin());
create policy "Staff and admins can insert academic records"
  on public.academic_records for insert to authenticated
  with check (public.is_staff_or_admin());
create policy "Staff and admins can update academic records"
  on public.academic_records for update to authenticated
  using (public.is_staff_or_admin()) with check (public.is_staff_or_admin());

create policy "Parents can select verified linked attendance"
  on public.attendance for select to authenticated using (exists (
    select 1 from public.parent_student ps
    where ps.student_id = attendance.student_id and ps.parent_id = auth.uid() and ps.verified_at is not null
  ));
create policy "Staff and admins can select attendance"
  on public.attendance for select to authenticated
  using (public.is_staff_or_admin());
create policy "Staff and admins can insert attendance"
  on public.attendance for insert to authenticated
  with check (public.is_staff_or_admin());
create policy "Staff and admins can update attendance"
  on public.attendance for update to authenticated
  using (public.is_staff_or_admin()) with check (public.is_staff_or_admin());

create policy "Parents can select verified linked behavior notes"
  on public.behavior_notes for select to authenticated using (exists (
    select 1 from public.parent_student ps
    where ps.student_id = behavior_notes.student_id and ps.parent_id = auth.uid() and ps.verified_at is not null
  ));
create policy "Staff and admins can select behavior notes"
  on public.behavior_notes for select to authenticated
  using (public.is_staff_or_admin());
create policy "Staff and admins can insert behavior notes"
  on public.behavior_notes for insert to authenticated
  with check (public.is_staff_or_admin());
create policy "Staff and admins can update behavior notes"
  on public.behavior_notes for update to authenticated
  using (public.is_staff_or_admin()) with check (public.is_staff_or_admin());

create policy "Parents can select verified linked sports records"
  on public.sports_records for select to authenticated using (exists (
    select 1 from public.parent_student ps
    where ps.student_id = sports_records.student_id and ps.parent_id = auth.uid() and ps.verified_at is not null
  ));
create policy "Staff and admins can select sports records"
  on public.sports_records for select to authenticated
  using (public.is_staff_or_admin());
create policy "Staff and admins can insert sports records"
  on public.sports_records for insert to authenticated
  with check (public.is_staff_or_admin());
create policy "Staff and admins can update sports records"
  on public.sports_records for update to authenticated
  using (public.is_staff_or_admin()) with check (public.is_staff_or_admin());
