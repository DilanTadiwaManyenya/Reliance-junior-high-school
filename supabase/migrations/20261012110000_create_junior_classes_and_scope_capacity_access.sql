-- Register every confirmed Junior class as a whole-grade workspace. Junior
-- classes do not use streams and start with the school-approved capacity of 50.
insert into public.school_classes (class_level, class_stream, campus, capacity, active)
select class_level, null, 'junior', 50, true
from (
  values
    ('ECD A'), ('ECD B'), ('Grade 1'), ('Grade 2'), ('Grade 3'),
    ('Grade 4'), ('Grade 5'), ('Grade 6'), ('Grade 7')
) as confirmed_classes(class_level)
where not exists (
  select 1 from public.school_classes existing
  where existing.campus = 'junior'
    and existing.class_level = confirmed_classes.class_level
    and coalesce(existing.class_stream, '') = ''
);

-- The confirmed Junior grade workspaces are active and start at 50. Individual
-- capacities remain editable by their campus administrator afterwards.
update public.school_classes
set capacity = 50, active = true, updated_at = now()
where campus = 'junior'
  and class_level in ('ECD A', 'ECD B', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7')
  and coalesce(class_stream, '') = '';

-- Main Admin may manage either campus. A campus administrator may manage only
-- the matching campus, including capacity settings.
create or replace function public.can_manage_school_class(target_campus text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() and exists (
    select 1 from public.profiles profile
    where profile.id = auth.uid()
      and profile.campus in ('all', target_campus)
  );
$$;

revoke all on function public.can_manage_school_class(text) from public;
grant execute on function public.can_manage_school_class(text) to authenticated;

drop policy if exists "Admins manage school classes" on public.school_classes;
create policy "Campus admins manage school classes" on public.school_classes
  for all to authenticated
  using (public.can_manage_school_class(campus))
  with check (public.can_manage_school_class(campus));
