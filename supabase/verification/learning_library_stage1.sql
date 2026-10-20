-- Read-only prerequisite audit. No learner names, contact details or file contents.
select jsonb_build_object(
  'relations', jsonb_build_object(
    'subject_allocations', to_regclass('public.teacher_class_subject_assignments'),
    'class_allocations', to_regclass('public.teacher_class_assignments'),
    'parent_links', to_regclass('public.parent_student'),
    'reporting_periods', to_regclass('public.reporting_periods'),
    'announcements', to_regclass('public.announcements'),
    'announcement_reads', to_regclass('public.announcement_reads')),
  'subject_allocations', (select jsonb_agg(t) from (
    select campus, count(*) as total,
      count(*) filter (where coalesce(class_stream, '') = '') as whole_level
    from public.teacher_class_subject_assignments group by campus
  ) t),
  'class_allocations', (select jsonb_agg(t) from (
    select campus, count(*) as total from public.teacher_class_assignments group by campus
  ) t),
  'buckets', (select jsonb_agg(jsonb_build_object(
    'id', id, 'public', public, 'file_size_limit', file_size_limit)) from storage.buckets),
  'helpers', (select jsonb_agg(p.proname) from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
    and p.proname in ('has_active_role', 'is_main_school_admin',
      'can_manage_school_campus', 'can_read_school_campus',
      'accountant_can_access_campus', 'teacher_has_coursework_allocation')),
  'module_tables', (select jsonb_agg(table_name) from information_schema.tables
    where table_schema = 'public' and (table_name ilike '%library%'
      or table_name ilike '%newsletter%' or table_name ilike '%resource%'))
) as learning_library_prerequisites;
