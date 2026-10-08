create table if not exists public.coursework_assessments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id),
  campus text not null check (campus in ('junior','senior')),
  class_level text not null,
  class_stream text,
  subject text not null,
  title text not null,
  assessment_type text not null check (assessment_type in ('weekly','monthly','exam')),
  total_marks numeric(7,2) not null check (total_marks > 0),
  assessment_date date not null default current_date,
  term text not null,
  academic_year integer not null,
  created_at timestamptz not null default now()
);
create table if not exists public.coursework_marks (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.coursework_assessments(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  score numeric(7,2) not null check (score >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assessment_id, student_id)
);
alter table public.coursework_assessments enable row level security;
alter table public.coursework_marks enable row level security;
create policy "Teachers manage their coursework" on public.coursework_assessments for all to authenticated
  using (teacher_id = auth.uid() or public.is_admin()) with check (teacher_id = auth.uid() or public.is_admin());
create policy "Parents view linked coursework" on public.coursework_assessments for select to authenticated using (
  exists (select 1 from public.coursework_marks cm join public.parent_student ps on ps.student_id = cm.student_id where cm.assessment_id = coursework_assessments.id and ps.parent_id = auth.uid() and ps.verified_at is not null)
);
create policy "Teachers manage coursework marks" on public.coursework_marks for all to authenticated using (
  public.is_admin() or exists (select 1 from public.coursework_assessments ca where ca.id = assessment_id and ca.teacher_id = auth.uid())
) with check (
  public.is_admin() or exists (select 1 from public.coursework_assessments ca where ca.id = assessment_id and ca.teacher_id = auth.uid())
);
create policy "Parents view linked coursework marks" on public.coursework_marks for select to authenticated using (
  exists (select 1 from public.parent_student ps where ps.student_id = coursework_marks.student_id and ps.parent_id = auth.uid() and ps.verified_at is not null)
);
