-- The confirmed stream-creation threshold is 50 active learners.
-- Preserve administrator-customized capacities; only replace the original
-- system default of 35 and set 50 for future classes.

alter table public.school_classes
  alter column capacity set default 50;

update public.school_classes
set capacity = 50,
    updated_at = now()
where capacity = 35;
