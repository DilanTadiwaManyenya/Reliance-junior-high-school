-- Make every existing learner class manageable without changing learner records.
insert into public.school_classes (class_level, class_stream, campus)
select distinct
  s.class_level,
  nullif(s.class_stream, ''),
  coalesce(s.campus, case when s.class_level ~ '^(ECD|Grade|Form 1|Form 2)' then 'junior' else 'senior' end)
from public.students s
where nullif(trim(s.class_level), '') is not null
on conflict do nothing;
