-- Actual role identities; every fixture/link/edit rolls back.
begin;
do $test$
declare a record; j record; par uuid; other_par uuid; senior_learner record; junior_learner record;
 r uuid:=gen_random_uuid(); r2 uuid:=gen_random_uuid(); jr uuid:=gen_random_uuid(); wrong_stream uuid:=gen_random_uuid();
 draft_id uuid:=gen_random_uuid(); future_id uuid:=gen_random_uuid(); response jsonb; next_page jsonb;
 expected integer; checks integer:=0; blocked boolean; actor record;
begin
 select x.* into a from public.teacher_class_subject_assignments x join public.profiles p on p.id=x.teacher_id
 where x.campus='senior' and x.class_stream='' and p.active_role='teacher'
 and exists(select 1 from public.students s where s.campus=x.campus and s.class_level=x.class_level and s.status='active') limit 1;
 select x.*,c.subject into j from public.teacher_class_assignments x join public.profiles p on p.id=x.teacher_id
 join public.library_curriculum_subjects c on c.class_level=x.class_level
 where x.campus='junior' and p.active_role='teacher'
 and exists(select 1 from public.students s where s.campus='junior' and s.class_level=x.class_level and s.status='active') limit 1;
 select id into par from public.profiles where active_role='parent' order by id limit 1;
 select id into other_par from public.profiles where active_role='parent' and id<>par limit 1;
 select * into senior_learner from public.students where campus='senior' and class_level=a.class_level and status='active' limit 1;
 select * into junior_learner from public.students where campus='junior' and class_level=j.class_level and coalesce(class_stream,'')=coalesce(j.class_stream,'') and status='active' limit 1;
 if a.teacher_id is null or j.teacher_id is null or par is null or other_par is null or senior_learner.id is null or junior_learner.id is null
 then raise exception 'Required parent/teacher/learner fixtures unavailable'; end if;
 update public.parent_student set verified_at=null where parent_id in(par,other_par);
 insert into public.parent_student(parent_id,student_id,verified_at) values(par,senior_learner.id,now()),(par,junior_learner.id,now())
 on conflict(parent_id,student_id) do update set verified_at=excluded.verified_at;

 perform set_config('request.jwt.claim.sub',a.teacher_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a.teacher_id,'role','authenticated','aal','aal2')::text,true);
 set local role authenticated;
 insert into public.learning_resources(id,campus,class_level,class_stream,subject,academic_year,term,title)
 values(r,'senior',a.class_level,'',a.subject,2026,3,'Parent reader senior probe'),
 (r2,'senior',a.class_level,'',a.subject,2025,2,'Parent reader previous year probe'),
 (wrong_stream,'senior',a.class_level,case when senior_learner.class_stream='Blue' then 'Green' else 'Blue' end,a.subject,2026,3,'Parent reader wrong stream probe'),
 (draft_id,'senior',a.class_level,'',a.subject,2026,3,'Parent reader draft probe'),
 (future_id,'senior',a.class_level,'',a.subject,2026,3,'Parent reader future probe');
 reset role;
 perform set_config('request.jwt.claim.sub',j.teacher_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',j.teacher_id,'role','authenticated','aal','aal2')::text,true);
 set local role authenticated;
 insert into public.learning_resources(id,campus,class_level,class_stream,subject,academic_year,term,title)
 values(jr,'junior',j.class_level,coalesce(j.class_stream,''),j.subject,2026,3,'Parent reader Junior probe');
 reset role;
 -- Metadata-only fixture; physical upload was verified separately in Stage 3.
 insert into public.portal_content_files(resource_id,extension,original_name,mime_type,size_bytes,uploaded_by,active,ready)
 select id,'pdf','probe.pdf','application/pdf',100,teacher_id,true,true from public.learning_resources where id in(r,r2,jr,wrong_stream,draft_id,future_id);
 perform set_config('request.jwt.claim.sub',a.teacher_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a.teacher_id,'role','authenticated','aal','aal2')::text,true);
 set local role authenticated;
 update public.learning_resources set state='published' where id in(r,r2,wrong_stream);
 update public.learning_resources set state='published',published_at=now()+interval '1 day' where id=future_id;
 reset role;
 perform set_config('request.jwt.claim.sub',j.teacher_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',j.teacher_id,'role','authenticated','aal','aal2')::text,true);
 set local role authenticated;
 update public.learning_resources set state='published' where id=jr;
 reset role;
 perform set_config('request.jwt.claim.sub',par::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',par,'role','authenticated','aal','aal2')::text,true);
 set local role authenticated;
 response:=public.parent_learning_library(senior_learner.id,'',null,null,0,50);
 if response->'learner'->>'id'<>senior_learner.id::text then raise exception 'Wrong selected learner returned'; end if;
 if not exists(select 1 from jsonb_array_elements(response->'resources') e where e->>'id'=r::text) then raise exception 'Selected Senior notes missing'; end if;
 if exists(select 1 from jsonb_array_elements(response->'resources') e where e->>'id' in(jr::text,wrong_stream::text,draft_id::text,future_id::text)) then raise exception 'Other campus/stream/draft/future notes leaked'; end if;
 if jsonb_path_exists(response,'$.**.phone') or jsonb_path_exists(response,'$.**.email') or jsonb_path_exists(response,'$.**.teacher_id') then raise exception 'Private staff fields leaked'; end if;
 checks:=checks+4;
 response:=public.parent_learning_library(junior_learner.id,'',null,null,0,50);
 if not exists(select 1 from jsonb_array_elements(response->'resources') e where e->>'id'=jr::text)
 or exists(select 1 from jsonb_array_elements(response->'resources') e where e->>'id' in(r::text,r2::text,wrong_stream::text)) then raise exception 'Junior selection mixed Senior notes'; end if;
 checks:=checks+1;
 response:=public.parent_learning_library(senior_learner.id,a.subject,2025,2,0,50);
 if not exists(select 1 from jsonb_array_elements(response->'resources') e where e->>'id'=r2::text)
 or exists(select 1 from jsonb_array_elements(response->'resources') e where e->>'id'=r::text) then raise exception 'Year/term filters failed'; end if; checks:=checks+1;
 response:=public.parent_learning_library(senior_learner.id,'Unallocated subject',null,null,0,20);
 if response->>'total_count'<>'0' then raise exception 'Subject filter did not constrain results'; end if; checks:=checks+1;
 response:=public.parent_learning_library(senior_learner.id,'',null,null,0,1);
 next_page:=public.parent_learning_library(senior_learner.id,'',null,null,1,1);
 if jsonb_array_length(response->'resources')<>1 or jsonb_array_length(next_page->'resources')<>1
 or response->'resources'->0->>'id'=next_page->'resources'->0->>'id' then raise exception 'Bounded pagination failed'; end if; checks:=checks+1;
 blocked:=false;
 begin perform public.parent_learning_library(senior_learner.id,'',null,null,0,51); exception when invalid_parameter_value then blocked:=true; end;
 if not blocked then raise exception 'Unbounded page size accepted'; end if; checks:=checks+1;
 reset role;
 perform set_config('request.jwt.claim.sub',a.teacher_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a.teacher_id,'role','authenticated','aal','aal2')::text,true);
 set local role authenticated;
 update public.learning_resources set state='archived' where id=r;
 reset role;
 perform set_config('request.jwt.claim.sub',par::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',par,'role','authenticated','aal','aal2')::text,true);
 set local role authenticated;
 response:=public.parent_learning_library(senior_learner.id);
 if exists(select 1 from jsonb_array_elements(response->'resources') e where e->>'id'=r::text) then raise exception 'Archived notes remain in parent feed'; end if;
 if public.can_read_learning_resource(r) then raise exception 'Archived resource still permits parent file access'; end if;
 checks:=checks+2; reset role;
 update public.parent_student set verified_at=null where parent_id=par and student_id=senior_learner.id;
 set local role authenticated;
 blocked:=false;
 begin perform public.parent_learning_library(senior_learner.id); exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'Unverified selected link retained access'; end if;
 response:=public.parent_learning_library(junior_learner.id);
 if response->'learner'->>'id'<>junior_learner.id::text then raise exception 'Other verified learner stopped working'; end if;
 checks:=checks+2; reset role;

 for actor in select p.id,p.active_role from public.profiles p join public.user_roles u on u.user_id=p.id and u.role=p.active_role
 where p.active_role in('admin','accountant','teacher') or p.id=other_par loop
 perform set_config('request.jwt.claim.sub',actor.id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor.id,'role','authenticated','aal','aal2')::text,true);
 set local role authenticated;
 blocked:=false;
 begin perform public.parent_learning_library(junior_learner.id); exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'Unrelated role or parent used the learner reader'; end if;
 checks:=checks+1; reset role;
 end loop;
 if has_function_privilege('anon','public.parent_learning_library(uuid,text,integer,integer,integer,integer)','EXECUTE') then raise exception 'Anonymous reader execution granted'; end if;
 checks:=checks+1;
 perform set_config('test.parent_library_assertions',checks::text,true);
end;
$test$;
select current_setting('test.parent_library_assertions')::integer as assertions_passed,
 true as selected_learner_isolation_checked,true as staff_contact_details_excluded;
rollback;
