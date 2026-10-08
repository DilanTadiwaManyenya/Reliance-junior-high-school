-- Stage 2: a teaching allocation connects a teacher, class and subject.
-- Existing class-teacher and form-level subject records remain in place while
-- the portal transitions to this more precise allocation model.

create table if not exists public.teacher_class_subject_assignments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  class_level text not null,
  -- An empty stream means either a Junior class (which has no streams) or
  -- a subject taught across every stream at that level. It is intentionally
  -- not nullable so the uniqueness rule works consistently.
  class_stream text not null default '',
  subject text not null,
  campus text not null check (campus in ('junior', 'senior')),
  created_at timestamptz not null default now(),
  unique (teacher_id, class_level, class_stream, subject)
);

comment on column public.teacher_class_subject_assignments.class_stream is
  'Blank for Junior classes or a subject allocation that applies to all streams in the class level.';

alter table public.teacher_class_subject_assignments enable row level security;

drop policy if exists "Admins manage teacher class subject assignments" on public.teacher_class_subject_assignments;
create policy "Admins manage teacher class subject assignments"
  on public.teacher_class_subject_assignments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Teachers view their class subject assignments" on public.teacher_class_subject_assignments;
create policy "Teachers view their class subject assignments"
  on public.teacher_class_subject_assignments for select to authenticated
  using (teacher_id = auth.uid());

-- Preserve every existing subject allocation as a level-wide allocation.
-- We do not guess streams or alter a teacher's form-tutor/class assignment.
insert into public.teacher_class_subject_assignments
  (teacher_id, class_level, class_stream, subject, campus)
select
  subject_assignment.teacher_id,
  subject_assignment.form_level,
  '',
  subject_assignment.subject,
  case
    when subject_assignment.form_level ~ '^(ECD|Grade)' then 'junior'
    else 'senior'
  end
from public.teacher_subject_assignments subject_assignment
on conflict (teacher_id, class_level, class_stream, subject) do nothing;
