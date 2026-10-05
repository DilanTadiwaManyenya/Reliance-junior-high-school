-- Administrator-managed classes and learner awards for the parent portal/report.
create table if not exists public.school_classes (
  id uuid primary key default gen_random_uuid(),
  class_level text not null,
  class_stream text,
  campus text not null check (campus in ('junior', 'senior')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists school_classes_unique_name
  on public.school_classes (class_level, coalesce(class_stream, ''));

alter table public.school_classes enable row level security;
drop policy if exists "Authenticated users read school classes" on public.school_classes;
drop policy if exists "Admins manage school classes" on public.school_classes;
create policy "Authenticated users read school classes" on public.school_classes
  for select to authenticated using (true);
create policy "Admins manage school classes" on public.school_classes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table if not exists public.student_awards (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  award_type text not null check (award_type in ('most_behaved', 'smartest', 'best_in_subject', 'overall_best_student', 'sports_person')),
  subject text,
  term text not null,
  academic_year integer not null,
  note text,
  recorded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  check ((award_type = 'best_in_subject' and nullif(trim(coalesce(subject, '')), '') is not null) or award_type <> 'best_in_subject')
);

create unique index if not exists student_awards_unique_term
  on public.student_awards (student_id, award_type, coalesce(subject, ''), term, academic_year);

alter table public.student_awards enable row level security;
drop policy if exists "Parents read linked learner awards" on public.student_awards;
drop policy if exists "Students read own awards" on public.student_awards;
drop policy if exists "Admins manage learner awards" on public.student_awards;
create policy "Parents read linked learner awards" on public.student_awards for select to authenticated using (
  exists (select 1 from public.parent_student ps where ps.student_id = student_awards.student_id and ps.parent_id = auth.uid() and ps.verified_at is not null)
);
create policy "Students read own awards" on public.student_awards for select to authenticated using (
  exists (select 1 from public.students s where s.id = student_awards.student_id and s.auth_user_id = auth.uid())
);
create policy "Admins manage learner awards" on public.student_awards for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Report fees were previously restricted to legacy Form 5/Form 6 labels,
-- while the application uses Lower Six/Upper Six and junior levels as well.
alter table public.report_term_fee_settings drop constraint if exists report_term_fee_settings_class_level_check;
