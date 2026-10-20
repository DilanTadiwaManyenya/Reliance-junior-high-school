-- Reproduces actual HTTP request statement boundaries; no school records persist.
begin;
do $$
declare a record; adm uuid; r uuid; n uuid:=gen_random_uuid(); result uuid; blocked boolean; checked integer:=0; sixth integer:=0;
begin
 for a in select x.* from public.teacher_class_subject_assignments x join public.profiles p on p.id=x.teacher_id
 where p.active_role='teacher' and p.portal_access_enabled is distinct from false and p.campus=x.campus
 and exists(select 1 from public.user_roles u where u.user_id=p.id and u.role='teacher') loop
 perform set_config('request.jwt.claim.sub',a.teacher_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a.teacher_id,'role','authenticated','aal','aal1')::text,true);
 r:=gen_random_uuid();
 set local role authenticated;
 -- Old request shape fails at the SELECT policy's same-statement parent lookup.
 blocked:=false;
 begin
 insert into public.learning_resources(id,teacher_id,allocation_id,campus,class_level,class_stream,subject,academic_year,term,title)
 values(r,a.teacher_id,a.id,a.campus,a.class_level,coalesce(a.class_stream,''),a.subject,2026,3,'Rollback library request check') returning id into result;
 exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'Expected old request failure not reproduced'; end if;
 insert into public.learning_resources(id,teacher_id,allocation_id,campus,class_level,class_stream,subject,academic_year,term,title)
 values(r,a.teacher_id,a.id,a.campus,a.class_level,coalesce(a.class_stream,''),a.subject,2026,3,'Rollback library request check');
 select id into result from public.learning_resources where id=r;
 if result is distinct from r then raise exception 'Created note was not readable in the following request'; end if;
 insert into public.portal_content_files(resource_id,extension,original_name,mime_type,size_bytes)
 values(r,'pdf','request-check.pdf','application/pdf',100) returning resource_id into result;
 if result is distinct from r then raise exception 'Attachment reservation failed'; end if;
 reset role;
 checked:=checked+1;
 if a.class_level in ('Lower Six','Upper Six') then sixth:=sixth+1; end if;
 end loop;
 if checked=0 or sixth=0 then raise exception 'Expected allocated teacher and sixth-form coverage missing'; end if;
 select id into adm from public.profiles where active_role='admin' and campus='all' and portal_access_enabled is distinct from false limit 1;
 perform set_config('request.jwt.claim.sub',adm::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',adm,'role','authenticated','aal','aal1')::text,true);
 set local role authenticated;
 blocked:=false;
 begin insert into public.announcements(id,title,campus) values(n,'Rollback newsletter request check','senior') returning id into result;
 exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'Expected old newsletter request failure not reproduced'; end if;
 insert into public.announcements(id,title,campus) values(n,'Rollback newsletter request check','senior');
 select id into result from public.announcements where id=n;
 if result is distinct from n then raise exception 'Created newsletter was not readable'; end if;
 perform public.save_announcement_targets(n,'[{"campus":"senior","class_level":"Lower Six","class_stream":""},{"campus":"senior","class_level":"Upper Six","class_stream":""}]');
 update public.announcements set state='published' where id=n returning id into result;
 if result is distinct from n then raise exception 'Existing parent UPDATE RETURNING failed'; end if;
 reset role;
 perform set_config('test.request_allocations',checked::text,true);
 perform set_config('test.request_sixth_forms',sixth::text,true);
end; $$;
select true as split_create_read_checked,true as newsletter_sixth_form_targets_checked,
 current_setting('test.request_allocations')::integer as teacher_allocations_checked,
 current_setting('test.request_sixth_forms')::integer as sixth_form_allocations_checked;
rollback;
