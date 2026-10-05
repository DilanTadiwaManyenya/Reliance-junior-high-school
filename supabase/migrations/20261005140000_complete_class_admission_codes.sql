-- Cover every configured school level. The two-digit year prefix rolls over
-- automatically: 2026 -> 26, 2027 -> 27, and so on.
create or replace function public.admission_class_code(student_campus text, student_class_level text)
returns text language sql immutable as $$
  select case
    when student_campus = 'senior' and student_class_level ~ '^Form [1-4]$'
      then 'f' || regexp_replace(student_class_level, '\D', '', 'g')
    when student_campus = 'senior' and student_class_level in ('Form 5', 'Lower Six') then 'f5'
    when student_campus = 'senior' and student_class_level in ('Form 6', 'Upper Six') then 'f6'
    when student_campus = 'junior' and student_class_level ~ '^Grade [1-7]$'
      then 'g' || regexp_replace(student_class_level, '\D', '', 'g')
    when student_class_level = 'ECD A' then 'eA'
    when student_class_level = 'ECD B' then 'eB'
    else 'x0'
  end;
$$;
