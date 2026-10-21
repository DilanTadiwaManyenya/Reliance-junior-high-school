-- Read-only verification of the exact unpublished Senior browser pilot.
begin read only;
select count(*)=1 as exact_pilot_exists,
  bool_and(r.state='archived' and r.published_at is null) as archived_never_published,
  (select count(*)=2 from public.portal_content_files f where f.resource_id in
    (select id from public.learning_resources where allocation_id='0cd4f136-3791-411e-8b1e-627c5ca94a2e'
      and title='Library verification — private draft (21 Oct 2026)') and f.ready) as two_finalized_versions,
  (select count(*)=1 from public.portal_content_files f where f.resource_id in
    (select id from public.learning_resources where allocation_id='0cd4f136-3791-411e-8b1e-627c5ca94a2e'
      and title='Library verification — private draft (21 Oct 2026)') and f.ready and f.active) as one_current_version
from public.learning_resources r
where r.allocation_id='0cd4f136-3791-411e-8b1e-627c5ca94a2e'
  and r.title='Library verification — private draft (21 Oct 2026)';
commit;
