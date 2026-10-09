-- Stage 1: create the confirmed Senior teacher account for Mr Muronda.
-- The temporary credentials follow the existing deterministic staff-account
-- sequence. He must update both credentials after the first sign-in.

do $$
declare
  v_teacher_id uuid;
  v_creator_id uuid;
  v_account_phone text := '+263790000019';
  v_account_email text := 'portal-263790000019@portal.reliance.local';
begin
  select id into v_teacher_id
  from auth.users
  where email = v_account_email or phone = v_account_phone
  limit 1;

  if v_teacher_id is null then
    v_teacher_id := gen_random_uuid();
    insert into auth.users (
      id, instance_id, email, phone, encrypted_password, email_confirmed_at,
      raw_user_meta_data, created_at, updated_at, role, aud
    ) values (
      v_teacher_id,
      '00000000-0000-0000-0000-000000000000',
      v_account_email,
      v_account_phone,
      '$2a$10$2wzG5oc95iVIgkyH6CK6GOWaAerAKtfeT355JfJIPnCmRAZ1i0YBK',
      now(),
      jsonb_build_object('full_name', 'Mr Muronda', 'phone', v_account_phone),
      now(), now(), 'authenticated', 'authenticated'
    );
  end if;

  update public.profiles
  set full_name = 'Mr Muronda',
      phone = v_account_phone,
      role = 'teacher',
      active_role = 'teacher',
      campus = 'senior',
      class_level = 'Upper Six',
      class_stream = 'Arts',
      portal_access_enabled = true,
      must_change_password = true,
      must_update_credentials = true
  where id = v_teacher_id;

  insert into public.user_roles (user_id, role)
  values (v_teacher_id, 'teacher')
  on conflict (user_id, role) do nothing;

  delete from public.user_roles
  where user_id = v_teacher_id and role = 'parent';

  select id into v_creator_id
  from public.profiles
  where role = 'admin' and campus = 'all'
  order by is_protected desc nulls last
  limit 1;

  insert into public.staff_accounts (
    user_id, role, phone_number, name, class_assigned, campus, created_by
  ) values (
    v_teacher_id, 'teacher', v_account_phone, 'Mr Muronda',
    'Upper Six · Arts', 'senior', coalesce(v_creator_id, v_teacher_id)
  )
  on conflict (user_id) do update
  set role = excluded.role,
      phone_number = excluded.phone_number,
      name = excluded.name,
      class_assigned = excluded.class_assigned,
      campus = excluded.campus;

  insert into public.teacher_class_assignments (
    teacher_id, class_level, class_stream, campus
  ) values (
    v_teacher_id, 'Upper Six', 'Arts', 'senior'
  )
  on conflict (teacher_id, class_level, class_stream) do update
  set campus = excluded.campus;

  insert into public.teacher_subject_assignments (teacher_id, subject, form_level)
  values
    (v_teacher_id, 'English', 'Form 3'),
    (v_teacher_id, 'History', 'Form 4'),
    (v_teacher_id, 'History', 'Upper Six')
  on conflict (teacher_id, subject, form_level) do nothing;

  insert into public.teacher_class_subject_assignments (
    teacher_id, class_level, class_stream, subject, campus
  ) values
    (v_teacher_id, 'Form 3', '', 'English', 'senior'),
    (v_teacher_id, 'Form 4', '', 'History', 'senior'),
    (v_teacher_id, 'Upper Six', '', 'History', 'senior')
  on conflict (teacher_id, class_level, class_stream, subject) do update
  set campus = excluded.campus;
end $$;
