-- Stage 2: apply the remaining confirmed 2026 class-teacher and whole-form
-- subject allocations. A blank class_stream is intentional: it covers every
-- active stream in that form.

do $$
declare
  v_gopito_id uuid;
  v_mahachi_id uuid;
  v_svudu_id uuid;
  v_mabvuramiti_id uuid;
  v_kodzomoyo_id uuid;
  v_ngwarai_id uuid;
begin
  select id into v_gopito_id from public.profiles where full_name = 'Mr Gopito' and role = 'teacher' limit 1;
  select id into v_mahachi_id from public.profiles where full_name = 'Mr Mahachi' and role = 'teacher' limit 1;
  select id into v_svudu_id from public.profiles where full_name = 'Mr Svudu' and role = 'teacher' limit 1;
  select id into v_mabvuramiti_id from public.profiles where full_name = 'Mr Mabvuramiti' and role = 'teacher' limit 1;
  select id into v_kodzomoyo_id from public.profiles where full_name = 'Mrs Kodzomoyo' and role = 'teacher' limit 1;
  select id into v_ngwarai_id from public.profiles where phone = '+263790000018' and role = 'teacher' limit 1;

  if v_gopito_id is null or v_mahachi_id is null or v_svudu_id is null
     or v_mabvuramiti_id is null or v_kodzomoyo_id is null or v_ngwarai_id is null then
    raise exception 'A confirmed teacher account required for the 2026 allocation is missing.';
  end if;

  -- The user confirmed the displayed source name is Mr Ngwarai.
  update public.profiles
  set full_name = 'Mr Ngwarai'
  where id = v_ngwarai_id;

  update public.staff_accounts
  set name = 'Mr Ngwarai'
  where user_id = v_ngwarai_id;

  update auth.users
  set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('full_name', 'Mr Ngwarai')
  where id = v_ngwarai_id;

  -- Class teachers are stream-specific, unlike subject allocations.
  delete from public.teacher_class_assignments
  where campus = 'senior'
    and (class_level, class_stream) in (
      ('Form 3', 'Red'),
      ('Form 3', 'Blue'),
      ('Form 4', 'Green'),
      ('Lower Six', 'Commercials'),
      ('Upper Six', 'Commercials')
    );

  insert into public.teacher_class_assignments (teacher_id, class_level, class_stream, campus)
  values
    (v_gopito_id, 'Form 3', 'Red', 'senior'),
    (v_gopito_id, 'Form 3', 'Blue', 'senior'),
    (v_mahachi_id, 'Form 4', 'Green', 'senior'),
    (v_svudu_id, 'Lower Six', 'Commercials', 'senior'),
    (v_mabvuramiti_id, 'Upper Six', 'Commercials', 'senior');

  -- Form 3 History belongs to Mr Ngwarai across all Form 3 streams.
  delete from public.teacher_class_subject_assignments
  where class_level = 'Form 3' and class_stream = '' and subject = 'History' and campus = 'senior';

  delete from public.teacher_subject_assignments
  where form_level = 'Form 3' and subject = 'History';

  insert into public.teacher_subject_assignments (teacher_id, subject, form_level)
  values (v_ngwarai_id, 'History', 'Form 3')
  on conflict (teacher_id, subject, form_level) do nothing;

  insert into public.teacher_class_subject_assignments (teacher_id, class_level, class_stream, subject, campus)
  values (v_ngwarai_id, 'Form 3', '', 'History', 'senior')
  on conflict (teacher_id, class_level, class_stream, subject) do update
  set campus = excluded.campus;

  -- Explicitly retain the verified sixth-form Communication Skills allocation.
  delete from public.teacher_class_subject_assignments
  where class_level in ('Lower Six', 'Upper Six')
    and class_stream = ''
    and subject = 'Communication Skills'
    and campus = 'senior';

  delete from public.teacher_subject_assignments
  where form_level in ('Lower Six', 'Upper Six') and subject = 'Communication Skills';

  insert into public.teacher_subject_assignments (teacher_id, subject, form_level)
  values
    (v_kodzomoyo_id, 'Communication Skills', 'Lower Six'),
    (v_kodzomoyo_id, 'Communication Skills', 'Upper Six')
  on conflict (teacher_id, subject, form_level) do nothing;

  insert into public.teacher_class_subject_assignments (teacher_id, class_level, class_stream, subject, campus)
  values
    (v_kodzomoyo_id, 'Lower Six', '', 'Communication Skills', 'senior'),
    (v_kodzomoyo_id, 'Upper Six', '', 'Communication Skills', 'senior')
  on conflict (teacher_id, class_level, class_stream, subject) do update
  set campus = excluded.campus;
end $$;
