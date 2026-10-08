-- Parent coursework policies previously referenced each other through the
-- assessment/mark relationship. Security-definer helpers evaluate the linked
-- learner relationship without re-entering RLS.
create or replace function public.parent_can_view_coursework_assessment(requested_assessment_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.coursework_marks mark
    join public.parent_student link on link.student_id = mark.student_id
    where mark.assessment_id = requested_assessment_id
      and link.parent_id = auth.uid()
      and link.verified_at is not null
  );
$$;

create or replace function public.parent_can_view_coursework_student(requested_student_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.parent_student link
    where link.student_id = requested_student_id
      and link.parent_id = auth.uid()
      and link.verified_at is not null
  );
$$;

grant execute on function public.parent_can_view_coursework_assessment(uuid) to authenticated;
grant execute on function public.parent_can_view_coursework_student(uuid) to authenticated;

drop policy if exists "Parents view linked coursework" on public.coursework_assessments;
create policy "Parents view linked coursework" on public.coursework_assessments for select to authenticated
  using (public.parent_can_view_coursework_assessment(id));

drop policy if exists "Parents view linked coursework marks" on public.coursework_marks;
create policy "Parents view linked coursework marks" on public.coursework_marks for select to authenticated
  using (public.parent_can_view_coursework_student(student_id));
