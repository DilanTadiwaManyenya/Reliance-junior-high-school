-- Expose the existing, locked class-scoped allocator for enrolment screens.
-- The trigger remains the authority when a learner is actually inserted; this
-- function only previews the same next value so every portal displays the
-- correct Senior (f) or Junior (g) syntax before saving.
create or replace function public.preview_admission_number(
  requested_year integer,
  requested_campus text,
  requested_class_level text
)
returns text
language sql
security definer
set search_path = public
as $$
  select public.next_admission_number(requested_year, requested_campus, requested_class_level);
$$;

revoke all on function public.preview_admission_number(integer, text, text) from public;
grant execute on function public.preview_admission_number(integer, text, text) to authenticated;
