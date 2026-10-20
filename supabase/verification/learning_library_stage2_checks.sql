-- Read-only structural checks; raises if the live foundation is incomplete.
begin read only;
do $$
declare n integer;
begin
 select count(*) into n from pg_class c join pg_namespace s on s.oid=c.relnamespace
 where s.nspname='public' and c.relname in ('library_curriculum_subjects','learning_resources',
 'announcements','announcement_targets','announcement_reads','portal_content_files','portal_content_events')
 and c.relrowsecurity;
 if n<>7 then raise exception 'Expected seven RLS-protected content tables'; end if;
 select count(*) into n from storage.buckets where id in ('learning-library','school-newsletters')
 and not public and file_size_limit=10485760 and 'application/pdf'=any(allowed_mime_types)
 and not ('image/svg+xml'=any(allowed_mime_types)) and not ('text/html'=any(allowed_mime_types));
 if n<>2 then raise exception 'Private 10 MB buckets not configured'; end if;
 select count(*) into n from pg_policies where schemaname='public'
 and tablename in ('library_curriculum_subjects','learning_resources','announcements','announcement_targets',
 'announcement_reads','portal_content_files','portal_content_events')
 and policyname='Content MFA guard' and permissive='RESTRICTIVE';
 if n<>7 then raise exception 'Content MFA guards missing'; end if;
 if has_table_privilege('authenticated','public.portal_content_files','UPDATE')
 or has_table_privilege('authenticated','public.portal_content_files','DELETE')
 or has_table_privilege('authenticated','public.portal_content_events','INSERT')
 or has_table_privilege('anon','public.learning_resources','SELECT') then
 raise exception 'Unexpected content write or anonymous read grant'; end if;
 if has_function_privilege('anon','public.finalize_portal_content_file(uuid)','EXECUTE') then
 raise exception 'Anonymous finalizer execution granted'; end if;
 if exists(select 1 from public.learning_resources where title like '%probe%')
 or exists(select 1 from public.announcements where title like '%probe%') then
 raise exception 'Rollback test fixtures persisted'; end if;
end;
$$;
select true as rls_and_grants_checked,true as private_buckets_checked,
 (select count(*) from public.library_curriculum_subjects) as junior_curriculum_pairs,
 (select jsonb_agg(jsonb_build_object('name',policyname,'command',cmd))
  from pg_policies where schemaname='storage' and tablename='objects'
  and policyname like 'content_storage_%') as content_storage_policies;
rollback;
