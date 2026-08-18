-- Reliance Learning Centre announcements and student portal addition.
-- Run this entire file manually in the Supabase SQL Editor.

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('parent', 'staff', 'admin', 'student'));
alter table public.students add column if not exists auth_user_id uuid references public.profiles(id) unique;

create table public.announcements (
  id uuid primary key default gen_random_uuid(), title text not null, body text not null,
  category text not null default 'general' check (category in ('general', 'academic', 'attendance', 'event', 'urgent')),
  audience text not null default 'all' check (audience in ('all', 'parents', 'staff', 'students')),
  created_by uuid not null references public.profiles(id), created_at timestamptz not null default now()
);
create table public.announcement_reads (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz not null default now(), unique (announcement_id, user_id)
);

alter table public.announcements enable row level security;
alter table public.announcement_reads enable row level security;

-- Authenticated users see only announcements intended for their portal role.
create policy "Users can select announcements for their audience" on public.announcements for select to authenticated using (
  audience = 'all' or (audience = 'parents' and exists (select 1 from public.profiles where id = auth.uid() and role = 'parent'))
  or (audience = 'staff' and public.is_staff_or_admin())
  or (audience = 'students' and exists (select 1 from public.profiles where id = auth.uid() and role = 'student'))
);
-- Staff and administrators alone can publish announcements.
create policy "Staff and admins can insert announcements" on public.announcements for insert to authenticated with check (public.is_staff_or_admin() and created_by = auth.uid());
-- Users can see only their own read receipts.
create policy "Users can select their own announcement reads" on public.announcement_reads for select to authenticated using (user_id = auth.uid());
-- Users can create only their own read receipts.
create policy "Users can insert their own announcement reads" on public.announcement_reads for insert to authenticated with check (user_id = auth.uid());

-- Students can see their one directly linked learner row, but cannot change it.
create policy "Students can select their own learner record" on public.students for select to authenticated using (
  auth_user_id = auth.uid() and exists (select 1 from public.profiles where id = auth.uid() and role = 'student')
);
-- Students can read records belonging only to that directly linked learner row.
create policy "Students can select their own academic records" on public.academic_records for select to authenticated using (exists (select 1 from public.students where id = academic_records.student_id and auth_user_id = auth.uid()));
create policy "Students can select their own attendance" on public.attendance for select to authenticated using (exists (select 1 from public.students where id = attendance.student_id and auth_user_id = auth.uid()));
create policy "Students can select their own behavior notes" on public.behavior_notes for select to authenticated using (exists (select 1 from public.students where id = behavior_notes.student_id and auth_user_id = auth.uid()));
create policy "Students can select their own sports records" on public.sports_records for select to authenticated using (exists (select 1 from public.students where id = sports_records.student_id and auth_user_id = auth.uid()));
