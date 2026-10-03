-- Learners remain school records; portal accounts are only for parents and staff.
alter table public.profiles add column if not exists portal_access_enabled boolean not null default true;

update public.profiles p
set portal_access_enabled = false
where p.role = 'student'
   or exists (select 1 from public.user_roles ur where ur.user_id = p.id and ur.role = 'student');

-- Remove learner-only reads. Parents retain access through verified parent_student links.
drop policy if exists "Students can select their own academic records" on public.academic_records;
drop policy if exists "Students can select their own attendance" on public.attendance;
drop policy if exists "Students can select their own behavior notes" on public.behavior_notes;
drop policy if exists "Students can select their own sports records" on public.sports_records;
drop policy if exists "Students read own report cards" on public.report_card_comments;
drop policy if exists "Students read own subject assignments" on public.teacher_subject_assignments;
drop policy if exists "Students read own awards" on public.student_awards;
drop policy if exists "Students view own account" on public.student_accounts;
