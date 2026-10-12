-- Report-card comments are learner records. Campus managers may only see the
-- reports for learners in their campus; accountants retain campus-limited
-- read access and parents retain verified-child access.

drop policy if exists "School staff manage report cards" on public.report_card_comments;

create policy "Campus managers read report cards" on public.report_card_comments
  for select to authenticated
  using (public.can_read_student_record(student_id));

create policy "Accountants read report cards in campus" on public.report_card_comments
  for select to authenticated
  using (
    exists (
      select 1
      from public.students learner
      where learner.id = report_card_comments.student_id
        and public.accountant_can_access_campus(learner.campus)
    )
  );

create policy "Campus admins manage report cards" on public.report_card_comments
  for all to authenticated
  using (public.can_manage_student_record(student_id))
  with check (public.can_manage_student_record(student_id));

-- Term settings are school-wide configuration, not campus configuration.
drop policy if exists "Admins manage term settings" on public.term_settings;
create policy "Main Admin manages term settings" on public.term_settings
  for all to authenticated
  using (public.is_main_school_admin())
  with check (public.is_main_school_admin());
