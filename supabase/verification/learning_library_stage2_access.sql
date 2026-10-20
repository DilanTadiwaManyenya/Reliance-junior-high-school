-- Live role/RLS assertions. ALL fixtures, edits and audit events roll back.
begin;
do $test$
declare
 a record; j record; actor record; par uuid; other_par uuid; main_admin uuid;
 r uuid:=gen_random_uuid(); draft_id uuid:=gen_random_uuid(); junior_id uuid:=gen_random_uuid();
 note uuid:=gen_random_uuid(); pending uuid:=gen_random_uuid(); f uuid:=gen_random_uuid();
 learner uuid; learner_stream text; count_seen integer; changed integer; checks integer:=0;
 blocked boolean; expected boolean;
begin
 select t.* into a from public.teacher_class_subject_assignments t join public.profiles p on p.id=t.teacher_id
 where t.campus='senior' and t.class_stream='' and p.active_role='teacher'
 and exists(select 1 from public.user_roles u where u.user_id=p.id and u.role='teacher')
 and exists(select 1 from public.students s where s.campus='senior' and s.class_level=t.class_level and s.status='active')
 order by t.class_level,t.subject limit 1;
 select t.*,c.subject into j from public.teacher_class_assignments t join public.profiles p on p.id=t.teacher_id
 join public.library_curriculum_subjects c on c.class_level=t.class_level
 where t.campus='junior' and p.active_role='teacher' limit 1;
 select p.id into par from public.profiles p join public.user_roles u on u.user_id=p.id and u.role='parent' where p.active_role='parent' order by p.id limit 1;
 select p.id into other_par from public.profiles p join public.user_roles u on u.user_id=p.id and u.role='parent' where p.active_role='parent' and p.id<>par limit 1;
 select id into main_admin from public.profiles where active_role='admin' and campus='all' limit 1;
 if a.teacher_id is null or j.teacher_id is null or par is null or other_par is null or main_admin is null then
   raise exception 'Required role fixtures missing; no silent test skip'; end if;

 -- Reuse a learner inside this rollback-only transaction; avoid unrelated admission/fee triggers.
 select id,coalesce(class_stream,'') into learner,learner_stream from public.students
 where campus='senior' and class_level=a.class_level and status='active' limit 1;
 if learner is null then raise exception 'A matching active learner is required'; end if;
 update public.parent_student set verified_at=null where parent_id=par;
 insert into public.parent_student(parent_id,student_id,verified_at) values(par,learner,now())
 on conflict(parent_id,student_id) do update set verified_at=excluded.verified_at;
 perform set_config('request.jwt.claim.sub',a.teacher_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a.teacher_id,'role','authenticated','aal','aal2')::text,true);
 set local role authenticated;
 insert into public.learning_resources(id,teacher_id,allocation_id,campus,class_level,class_stream,subject,academic_year,term,title)
 values(r,a.teacher_id,a.id,'senior',a.class_level,'',a.subject,2026,3,'Library published probe'),
 (draft_id,a.teacher_id,a.id,'senior',a.class_level,'',a.subject,2026,3,'Library draft probe');
 insert into public.portal_content_files(id,resource_id,extension,original_name,mime_type,size_bytes)
 values(f,r,'pdf','probe.pdf','application/pdf',100);
 blocked:=false;
 begin perform public.finalize_portal_content_file(f); exception when raise_exception then blocked:=true; end;
 if not blocked then raise exception 'Unuploaded file finalized'; end if; checks:=checks+1;
 blocked:=false;
 begin update public.learning_resources set state='published' where id=r; exception when raise_exception then blocked:=true; end;
 if not blocked then raise exception 'Resource published without finalized file'; end if; checks:=checks+1;
 reset role;
 -- Trusted fixture emulates a finalized upload, not a physical Storage API upload.
 update public.portal_content_files set ready=true,active=true where id=f;
 set local role authenticated;
 update public.learning_resources set state='published' where id=r;
 update public.learning_resources set title='Updated published probe' where id=r;
 pending:=gen_random_uuid();
 insert into public.portal_content_files(id,resource_id,extension,original_name,mime_type,size_bytes)
 values(pending,r,'pdf','replacement.pdf','application/pdf',100);
 blocked:=false;
 begin perform public.finalize_portal_content_file(pending); exception when raise_exception then blocked:=true; end;
 if not blocked or not exists(select 1 from public.portal_content_files where id=f and ready and active) then
 raise exception 'Failed replacement displaced the existing file'; end if; checks:=checks+1;
 if public.portal_storage_file_access('learning-library',r::text||'/'||f::text||'.pdf',true) then
 raise exception 'Finalized file was writable'; end if; checks:=checks+1;
 blocked:=false;
 begin update public.learning_resources set class_level='Form 6' where id=r; exception when raise_exception then blocked:=true; end;
 if not blocked then raise exception 'Resource scope was mutable'; end if; checks:=checks+1;
 blocked:=false;
 begin insert into public.portal_content_files(resource_id,extension,original_name,mime_type,size_bytes,ready,active)
 values(draft_id,'pdf','forged.pdf','application/pdf',100,true,true);
 exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'Teacher forged ready file'; end if; checks:=checks+1;
 blocked:=false;
 begin insert into public.portal_content_files(resource_id,extension,original_name,mime_type,size_bytes)
 values(r,'pdf','large.pdf','application/pdf',10485761);
 exception when check_violation then blocked:=true; end;
 if not blocked then raise exception 'Oversize metadata accepted'; end if; checks:=checks+1;
 if not public.portal_storage_file_access('learning-library',r::text||'/'||f::text||'.pdf',false) then raise exception 'Teacher cannot read own file'; end if;
 if public.portal_storage_file_access('learning-library','guessed/path.pdf',true) then raise exception 'Guessed file path upload allowed'; end if;
 checks:=checks+2;
 reset role;

 -- Junior class teachers use the trusted curriculum list.
 perform set_config('request.jwt.claim.sub',j.teacher_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',j.teacher_id,'role','authenticated','aal','aal2')::text,true);
 set local role authenticated;
 insert into public.learning_resources(id,campus,class_level,class_stream,subject,academic_year,term,title)
 values(junior_id,'junior',j.class_level,coalesce(j.class_stream,''),j.subject,2026,3,'Junior probe');
 blocked:=false;
 begin insert into public.learning_resources(campus,class_level,class_stream,subject,academic_year,term,title)
 values('junior',j.class_level,coalesce(j.class_stream,''),'Unallocated invented subject',2026,3,'Invalid subject');
 exception when others then blocked:=true; end;
 if not blocked then raise exception 'Junior arbitrary subject accepted'; end if;
 checks:=checks+2;
 reset role;

 -- Draft access, campus isolation, read-only support roles, role denial of newsletters.
 for actor in select p.id,p.active_role,p.campus from public.profiles p
 join public.user_roles u on u.user_id=p.id and u.role=p.active_role
 where p.active_role in ('admin','accountant','teacher','parent') loop
 perform set_config('request.jwt.claim.sub',actor.id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor.id,'role','authenticated','aal','aal2')::text,true);
 set local role authenticated;
 expected:=coalesce((actor.active_role='admin' and actor.campus in ('all','senior'))
   or (actor.active_role='accountant' and actor.campus='senior') or actor.id=a.teacher_id,false);
 select count(*) into count_seen from public.learning_resources where id=draft_id;
 if (count_seen=1) is distinct from expected then raise exception 'Draft role/campus visibility mismatch'; end if;
 checks:=checks+1;
 if actor.id<>a.teacher_id then
 update public.learning_resources set title='Unauthorized write' where id=r;
 get diagnostics changed=row_count;
 if changed<>0 then raise exception 'Support role/parent edited teacher notes'; end if; checks:=checks+1;
 blocked:=false;
 begin insert into public.portal_content_files(resource_id,extension,original_name,mime_type,size_bytes)
 values(r,'pdf','unauthorized.pdf','application/pdf',100);
 exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'Support role/parent reserved a teacher upload'; end if; checks:=checks+1;
 end if;
 if actor.active_role in ('teacher','accountant','parent') then
 blocked:=false;
 begin insert into public.announcements(title,campus) values('Unauthorized newsletter',coalesce(actor.campus,'senior'));
 exception when others then blocked:=true; end;
 if not blocked then raise exception 'Non-admin published newsletter'; end if; checks:=checks+1;
 end if;
 if actor.active_role='admin' and actor.campus in ('junior','senior') then
 pending:=gen_random_uuid();
 insert into public.announcements(id,title,body,campus)
 values(pending,'Campus draft probe','Scoped audience probe',actor.campus);
 blocked:=false;
 begin insert into public.announcement_targets(announcement_id,campus)
 values(pending,case when actor.campus='junior' then 'senior' else 'junior' end);
 exception when raise_exception then blocked:=true; end;
 if not blocked then raise exception 'Campus Admin targeted other campus'; end if; checks:=checks+1;
 blocked:=false;
 begin insert into public.announcements(title,campus) values('Both campus bypass','all');
 exception when others then blocked:=true; end;
 if not blocked then raise exception 'Campus Admin created both-campus newsletter'; end if; checks:=checks+1;
 insert into public.announcement_targets(announcement_id,campus) values(pending,actor.campus);
 update public.announcements set state='published' where id=pending;
 checks:=checks+1;
 end if;
 reset role;
 end loop;

 -- Linked parent can see published resources and files, but not drafts or guessed paths.
 perform set_config('request.jwt.claim.sub',par::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',par,'role','authenticated','aal','aal2')::text,true);
 set local role authenticated;
 select count(*) into count_seen from public.learning_resources where id=r;
 if count_seen<>1 then raise exception 'Linked parent could not read published class-wide notes'; end if;
 if not public.portal_storage_file_access('learning-library',r::text||'/'||f::text||'.pdf',false)
 or public.portal_storage_file_access('learning-library',r::text||'/'||f::text||'.pdf',true) then raise exception 'Parent file access mismatch'; end if;
 if public.library_parent_scope('senior',a.class_level,learner_stream||'-unmatched') then
 raise exception 'Parent matched a different stream'; end if;
 checks:=checks+3; reset role;
 update public.parent_student set verified_at=null where parent_id=par and student_id=learner;
 set local role authenticated;
 select count(*) into count_seen from public.learning_resources where id=r;
 if count_seen<>0 then raise exception 'Unverified parent retained access'; end if; checks:=checks+1;
 reset role;
 update public.parent_student set verified_at=now() where parent_id=par and student_id=learner;
 update public.students set class_level=case when a.class_level='Form 1' then 'Form 2' else 'Form 1' end where id=learner;
 set local role authenticated;
 select count(*) into count_seen from public.learning_resources where id=r;
 if count_seen<>0 then raise exception 'Wrong form retained resource access'; end if; checks:=checks+1;
 reset role;
 update public.students set campus='junior',class_level='Grade 5',class_stream='' where id=learner;
 set local role authenticated;
 select count(*) into count_seen from public.learning_resources where id=r;
 if count_seen<>0 then raise exception 'Cross-campus learner retained access'; end if; checks:=checks+1;
 reset role;
 update public.students set campus='senior',class_level=a.class_level,class_stream=learner_stream where id=learner;

 -- Lost allocation revokes editing without erasing published notes.
 delete from public.teacher_class_subject_assignments where id=a.id;
 perform set_config('request.jwt.claim.sub',a.teacher_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a.teacher_id,'role','authenticated','aal','aal2')::text,true);
 set local role authenticated;
 if public.can_manage_learning_resource(r) then raise exception 'Deleted allocation retained editing'; end if;
 checks:=checks+1; reset role;
 if not exists(select 1 from public.learning_resources where id=r and state='published') then raise exception 'Deleting allocation erased notes'; end if;
 checks:=checks+1;

 -- Main Admin creates explicit multi-campus audience targets.
 perform set_config('request.jwt.claim.sub',main_admin::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',main_admin,'role','authenticated','aal','aal2')::text,true);
 set local role authenticated;
 insert into public.announcements(id,title,body,category,campus) values(note,'Newsletter probe','Rollback verification','newsletter','all');
 insert into public.announcement_targets(announcement_id,campus) values(note,'junior'),(note,'senior');
 update public.announcements set state='published' where id=note;
 blocked:=false;
 begin delete from public.announcement_targets where announcement_id=note; exception when raise_exception then blocked:=true; end;
 if not blocked then raise exception 'Published targets changed without returning to draft'; end if;
 checks:=checks+1; reset role;
 perform set_config('request.jwt.claim.sub',par::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',par,'role','authenticated','aal','aal2')::text,true);
 set local role authenticated;
 select count(*) into count_seen from public.announcements where id=note;
 if count_seen<>1 then raise exception 'Parent cannot see targeted newsletter'; end if;
 insert into public.announcement_reads(announcement_id) values(note);
 checks:=checks+2; reset role;
 perform set_config('request.jwt.claim.sub',main_admin::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',main_admin,'role','authenticated','aal','aal2')::text,true);
 set local role authenticated;
 update public.announcements set expires_at=now()-interval '1 second',published_at=now()-interval '1 day' where id=note;
 reset role;
 perform set_config('request.jwt.claim.sub',par::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',par,'role','authenticated','aal','aal2')::text,true);
 set local role authenticated;
 select count(*) into count_seen from public.announcements where id=note;
 if count_seen<>0 then raise exception 'Expired newsletter visible to parent'; end if;
 checks:=checks+1; reset role;
 if not exists(select 1 from public.portal_content_events where resource_id=r and actor_id=a.teacher_id and operation='UPDATE') then
   raise exception 'Trusted resource audit missing'; end if; checks:=checks+1;
 set local role anon;
 blocked:=false;
 begin perform 1 from public.learning_resources limit 1; exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'Anonymous resource table read allowed'; end if;
 checks:=checks+1; reset role;
 set local role authenticated;
 blocked:=false;
 begin insert into public.portal_content_events(campus,source_table,operation) values('senior','forged','INSERT');
 exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'Client forged an audit event'; end if;
 checks:=checks+1; reset role;
 perform set_config('test.library_assertions',checks::text,true);
end;
$test$;
select current_setting('test.library_assertions')::integer as assertions_passed,
 'ROLLBACK-only SQL role tests; physical upload and browser tests follow in UI stages' as test_scope;
rollback;
