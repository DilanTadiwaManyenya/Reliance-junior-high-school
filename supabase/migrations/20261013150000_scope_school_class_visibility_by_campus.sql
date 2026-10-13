-- Class navigation must not expose another campus merely because the shared
-- top-bar selector is opened or its session value is changed. Main Admins
-- remain school-wide; each other staff account sees its own campus only.
drop policy if exists "Authenticated users read school classes" on public.school_classes;
drop policy if exists "Campus staff read school classes" on public.school_classes;

create policy "Campus staff read school classes" on public.school_classes
  for select to authenticated
  using (
    exists (
      select 1
      from public.profiles profile
      where profile.id = auth.uid()
        and profile.campus in ('all', school_classes.campus)
    )
  );
