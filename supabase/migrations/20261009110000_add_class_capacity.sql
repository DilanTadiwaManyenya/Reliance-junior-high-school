-- Stage 4: enrolment capacity is managed per class/stream. The default is a
-- starting point only; administrators can set the capacity that is right for
-- each stream in Class Management.

alter table public.school_classes
  add column if not exists capacity integer;

alter table public.school_classes
  drop constraint if exists school_classes_capacity_positive;

alter table public.school_classes
  add constraint school_classes_capacity_positive
  check (capacity is null or capacity > 0);

alter table public.school_classes
  alter column capacity set default 35;

-- Existing classes receive a configurable starting capacity. This never
-- creates a stream and does not change any learner's enrolment.
update public.school_classes
set capacity = 35,
    updated_at = now()
where capacity is null;
