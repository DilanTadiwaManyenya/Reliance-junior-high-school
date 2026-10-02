-- A report card can render its curriculum even when RLS hides every result row.
-- Ensure the learner and each verified parent can read only that learner's marks.

alter table public.academic_records enable row level security;

drop policy if exists "Parents can read linked academic report results" on public.academic_records;
create policy "Parents can read linked academic report results"
  on public.academic_records for select to authenticated
  using (
    exists (
      select 1
      from public.parent_student ps
      where ps.student_id = academic_records.student_id
        and ps.parent_id = auth.uid()
        and ps.verified_at is not null
    )
  );

drop policy if exists "Learners can read their own academic report results" on public.academic_records;
create policy "Learners can read their own academic report results"
  on public.academic_records for select to authenticated
  using (
    exists (
      select 1
      from public.students s
      where s.id = academic_records.student_id
        and s.auth_user_id = auth.uid()
    )
  );
