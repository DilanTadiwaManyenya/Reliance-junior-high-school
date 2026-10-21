-- READ ONLY. Review counts are not authorization to delete files or history.
begin read only;
with files as (
 select f.*,o.id as object_id,o.updated_at as object_updated_at,o.metadata
 from public.portal_content_files f left join storage.objects o on o.bucket_id=f.bucket_id and o.name=f.object_path
), buckets as (select unnest(array['learning-library','school-newsletters']) as bucket)
select b.bucket,
 (select count(*) from storage.objects o where o.bucket_id=b.bucket) as stored_objects,
 (select count(*) from files f where f.bucket_id=b.bucket and f.ready and f.active) as current_finalized_files,
 (select count(*) from files f where f.bucket_id=b.bucket and f.ready and not f.active) as preserved_previous_versions,
 (select count(*) from files f where f.bucket_id=b.bucket and not f.ready and f.object_id is null) as unfinished_reservations_without_bytes,
 (select count(*) from files f where f.bucket_id=b.bucket and not f.ready and f.object_id is not null) as unfinished_uploads_with_bytes,
 (select count(*) from files f where f.bucket_id=b.bucket and not f.ready and not f.active
   and f.created_at<now()-interval '7 days' and (f.object_id is null or f.object_updated_at<now()-interval '7 days')) as pending_older_than_7_days_review_only,
 (select count(*) from storage.objects o where o.bucket_id=b.bucket
   and not exists(select 1 from public.portal_content_files f where f.bucket_id=o.bucket_id and f.object_path=o.name)) as objects_without_reservations_review_only,
 (select count(*) from files f where f.bucket_id=b.bucket and f.ready and f.object_id is null) as finalized_files_missing_objects,
 (select count(*) from files f where f.bucket_id=b.bucket and f.ready and f.object_id is not null
   and ((f.metadata->>'size') is distinct from f.size_bytes::text or f.metadata->>'mimetype' is distinct from f.mime_type)) as finalized_metadata_mismatches
from buckets b order by b.bucket;
commit;
