-- Stage 5: apply the final confirmed class-teacher corrections.
-- Form 4 Purple is intentionally left without a class teacher.

do $$
declare
  v_ngwarai_id uuid;
  v_kodzomoyo_id uuid;
begin
  select id into v_ngwarai_id
  from public.profiles
  where full_name = 'Mr Ngwarai' and role = 'teacher'
  limit 1;

  select id into v_kodzomoyo_id
  from public.profiles
  where full_name = 'Mrs Kodzomoyo' and role = 'teacher'
  limit 1;

  if v_ngwarai_id is null or v_kodzomoyo_id is null then
    raise exception 'A confirmed class teacher account is missing.';
  end if;

  delete from public.teacher_class_assignments
  where campus = 'senior'
    and (class_level, class_stream) in (
      ('Form 2', 'White'),
      ('Form 4', 'Purple'),
      ('Lower Six', 'Arts')
    );

  insert into public.teacher_class_assignments (
    teacher_id, class_level, class_stream, campus
  ) values
    (v_ngwarai_id, 'Form 2', 'White', 'senior'),
    (v_kodzomoyo_id, 'Lower Six', 'Arts', 'senior');
end $$;
