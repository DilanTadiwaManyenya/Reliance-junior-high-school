-- Published report-card metadata, separate from subject-level academic records.
create table if not exists public.report_card_comments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  term integer not null check (term between 1 and 3),
  year integer not null,
  form_teacher_comment text,
  principal_comment text,
  next_term_begins_on date,
  next_term_fees numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, term, year)
);
alter table public.report_card_comments enable row level security;
create policy "Parents read linked report cards" on public.report_card_comments for select to authenticated using (
  exists (select 1 from public.parent_student ps where ps.student_id = report_card_comments.student_id and ps.parent_id = auth.uid() and ps.verified_at is not null)
);
create policy "Students read own report cards" on public.report_card_comments for select to authenticated using (
  exists (select 1 from public.students s where s.id = report_card_comments.student_id and s.auth_user_id = auth.uid())
);
create policy "School staff manage report cards" on public.report_card_comments for all to authenticated using (public.is_admin() or public.is_school_staff()) with check (public.is_admin() or public.is_school_staff());

-- Parents and students only receive curriculum assignments for the learner(s) they may already view.
create policy "Parents read linked subject assignments" on public.teacher_subject_assignments for select to authenticated using (
  exists (select 1 from public.parent_student ps join public.students s on s.id = ps.student_id where ps.parent_id = auth.uid() and ps.verified_at is not null and s.class_level = teacher_subject_assignments.form_level)
);
create policy "Students read own subject assignments" on public.teacher_subject_assignments for select to authenticated using (
  exists (select 1 from public.students s where s.auth_user_id = auth.uid() and s.class_level = teacher_subject_assignments.form_level)
);
