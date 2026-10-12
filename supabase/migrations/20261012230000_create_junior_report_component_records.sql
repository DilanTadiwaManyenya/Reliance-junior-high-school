-- Junior report books have component marks rather than one mark per subject.
-- Keep these records separate from senior academic_records so Grade 1-7 and
-- ECD report layouts can be accurate without changing the senior workflow.
create table if not exists public.junior_component_marks (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  subject text not null check (length(trim(subject)) > 0),
  component text not null check (length(trim(component)) > 0),
  score numeric(6,2) not null check (score >= 0),
  possible_mark numeric(6,2) not null default 100 check (possible_mark > 0 and score <= possible_mark),
  term text not null,
  year integer not null check (year between 2020 and 2100),
  comment text,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, subject, component, term, year)
);

create index if not exists junior_component_marks_student_term_year_idx
  on public.junior_component_marks (student_id, term, year);

create table if not exists public.junior_developmental_ratings (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  development_area text not null check (length(trim(development_area)) > 0),
  rating smallint not null check (rating between 1 and 5),
  term text not null,
  year integer not null check (year between 2020 and 2100),
  comment text,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, development_area, term, year)
);

create index if not exists junior_developmental_ratings_student_term_year_idx
  on public.junior_developmental_ratings (student_id, term, year);

create or replace function public.set_junior_report_record_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists junior_component_marks_updated_at on public.junior_component_marks;
create trigger junior_component_marks_updated_at
  before update on public.junior_component_marks
  for each row execute function public.set_junior_report_record_updated_at();

drop trigger if exists junior_developmental_ratings_updated_at on public.junior_developmental_ratings;
create trigger junior_developmental_ratings_updated_at
  before update on public.junior_developmental_ratings
  for each row execute function public.set_junior_report_record_updated_at();

alter table public.junior_component_marks enable row level security;
alter table public.junior_developmental_ratings enable row level security;

-- The same helper rules used by existing academic records apply here:
-- teachers work only with their assigned class, parents read verified learner
-- records, accountants read their campus, and administrators remain campus scoped.
create policy "Parents read linked junior component marks" on public.junior_component_marks
  for select to authenticated using (
    exists (
      select 1 from public.parent_student link
      where link.student_id = junior_component_marks.student_id
        and link.parent_id = auth.uid()
        and link.verified_at is not null
    )
  );
create policy "Teachers manage assigned junior component marks" on public.junior_component_marks
  for all to authenticated
  using (public.teacher_owns_student(student_id))
  with check (public.teacher_owns_student(student_id));
create policy "Accountants read campus junior component marks" on public.junior_component_marks
  for select to authenticated using (
    exists (
      select 1 from public.students learner
      where learner.id = junior_component_marks.student_id
        and public.accountant_can_access_campus(learner.campus)
    )
  );
create policy "Campus managers read junior component marks" on public.junior_component_marks
  for select to authenticated using (public.can_read_student_record(student_id));
create policy "Campus admins manage junior component marks" on public.junior_component_marks
  for all to authenticated
  using (public.can_manage_student_record(student_id))
  with check (public.can_manage_student_record(student_id));

create policy "Parents read linked junior developmental ratings" on public.junior_developmental_ratings
  for select to authenticated using (
    exists (
      select 1 from public.parent_student link
      where link.student_id = junior_developmental_ratings.student_id
        and link.parent_id = auth.uid()
        and link.verified_at is not null
    )
  );
create policy "Teachers manage assigned junior developmental ratings" on public.junior_developmental_ratings
  for all to authenticated
  using (public.teacher_owns_student(student_id))
  with check (public.teacher_owns_student(student_id));
create policy "Accountants read campus junior developmental ratings" on public.junior_developmental_ratings
  for select to authenticated using (
    exists (
      select 1 from public.students learner
      where learner.id = junior_developmental_ratings.student_id
        and public.accountant_can_access_campus(learner.campus)
    )
  );
create policy "Campus managers read junior developmental ratings" on public.junior_developmental_ratings
  for select to authenticated using (public.can_read_student_record(student_id));
create policy "Campus admins manage junior developmental ratings" on public.junior_developmental_ratings
  for all to authenticated
  using (public.can_manage_student_record(student_id))
  with check (public.can_manage_student_record(student_id));
