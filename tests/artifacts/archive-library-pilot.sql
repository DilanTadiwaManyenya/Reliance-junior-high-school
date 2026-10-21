begin;
do $$
declare item public.learning_resources; matches integer;
begin
 select count(*) into matches from public.learning_resources
 where title='Library pilot — draft only (20 Oct 2026)' and campus='senior'
 and allocation_id='a0ca7447-4115-4de9-beff-5e2bb61e875c' and academic_year=2026 and term=3
 and description='Private technical validation using the public school crest. Not teaching material. Keep archived after verification. Do not publish to parents.';
 if matches<>1 then raise exception 'Expected exactly one known private pilot record; no changes made'; end if;
 select * into item from public.learning_resources
 where title='Library pilot — draft only (20 Oct 2026)' and allocation_id='a0ca7447-4115-4de9-beff-5e2bb61e875c';
 if item.published_at is not null or item.state not in ('draft','archived') then raise exception 'Pilot publication status is unexpected'; end if;
 perform set_config('request.jwt.claim.sub',item.teacher_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',item.teacher_id,'role','authenticated','aal','aal1')::text,true);
 set local role authenticated;
 update public.learning_resources set state='archived' where id=item.id and state='draft';
 if not exists(select 1 from public.learning_resources where id=item.id and state='archived' and published_at is null) then raise exception 'Pilot did not archive under its teacher authority'; end if;
 if not exists(select 1 from public.portal_content_files where resource_id=item.id and ready and active and mime_type='image/webp' and size_bytes>0) then raise exception 'Finalized attachment missing'; end if;
 reset role;
end; $$;
select true as exact_private_pilot_archived,true as finalized_attachment_preserved,true as never_published_to_parents;
commit;
