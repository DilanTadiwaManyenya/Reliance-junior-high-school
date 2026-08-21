-- Normalize only known legacy spelling/casing. Review the final SELECT for
-- genuinely invalid historic values; it intentionally does not guess a stream.
update public.students
set class_level = regexp_replace(initcap(lower(trim(class_level))), '^Grade ([1-7])$', 'Grade \1')
where lower(trim(class_level)) ~ '^grade [1-7]$';

update public.students
set class_level = regexp_replace(initcap(lower(trim(class_level))), '^Form ([1-6])$', 'Form \1')
where lower(trim(class_level)) ~ '^form [1-6]$';

update public.profiles
set class_level = regexp_replace(initcap(lower(trim(class_level))), '^Grade ([1-7])$', 'Grade \1')
where role = 'teacher' and lower(trim(class_level)) ~ '^grade [1-7]$';

update public.profiles
set class_level = regexp_replace(initcap(lower(trim(class_level))), '^Form ([1-6])$', 'Form \1')
where role = 'teacher' and lower(trim(class_level)) ~ '^form [1-6]$';

update public.students
set class_stream = case lower(trim(class_stream))
  when 'blue' then 'Blue' when 'green' then 'Green' when 'white' then 'White'
  when 'commercials' then 'Commercials' when 'arts' then 'Arts' when 'sciences' then 'Sciences'
  else class_stream end
where class_stream is not null;

update public.profiles
set class_stream = case lower(trim(class_stream))
  when 'blue' then 'Blue' when 'green' then 'Green' when 'white' then 'White'
  when 'commercials' then 'Commercials' when 'arts' then 'Arts' when 'sciences' then 'Sciences'
  else class_stream end
where role = 'teacher' and class_stream is not null;

-- Run this after the updates. Any returned rows need an explicit correction.
select 'student' as record_type, id, full_name, class_level, class_stream from public.students
where (class_level in ('Form 5', 'Form 6') and class_stream not in ('Commercials', 'Arts', 'Sciences'))
   or (class_level not in ('Form 5', 'Form 6') and class_stream not in ('Blue', 'Green', 'White'))
union all
select 'teacher', id, full_name, class_level, class_stream from public.profiles
where role = 'teacher' and ((class_level in ('Form 5', 'Form 6') and class_stream not in ('Commercials', 'Arts', 'Sciences'))
   or (class_level not in ('Form 5', 'Form 6') and class_stream not in ('Blue', 'Green', 'White')));
