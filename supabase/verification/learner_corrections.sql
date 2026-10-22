begin;
create temporary table correction_checks(campus text,passed boolean);
do $$ declare a record; sid uuid; blocked boolean; n integer;begin
for a in select distinct on(p.campus) p.id,p.campus,t.class_level,t.class_stream from public.profiles p join public.teacher_class_assignments t on t.teacher_id=p.id where p.active_role='teacher' and p.campus in ('junior','senior') and p.portal_access_enabled order by p.campus,t.class_level loop
sid:=gen_random_uuid();
perform set_config('request.jwt.claim.sub',a.id::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',a.id,'role','authenticated','aal','aal1')::text,true);
set local role authenticated;
insert into public.students(id,full_name,date_of_birth,class_level,class_stream,campus,enrolled_year,status) values(sid,'Rollback correction','2015-01-01',a.class_level,nullif(a.class_stream,''),a.campus,2026,'active');
perform public.correct_assigned_learner(sid,'{"full_name":"Corrected rollback","date_of_birth":"2015-02-02"}');
if not exists(select 1 from public.students where id=sid and full_name='Corrected rollback') then raise exception 'Correction failed';end if;
perform public.correct_assigned_learner(sid,'{"disable_reason":"Duplicate reviewed by teacher"}');
if not exists(select 1 from public.students where id=sid and status='inactive' and record_disable_reason='Duplicate reviewed by teacher') then raise exception 'Disable failed';end if;
delete from public.students where id=sid;get diagnostics n=row_count;if n<>0 then raise exception 'Teacher deleted learner';end if;
reset role;
if not exists(select 1 from public.school_record_changes where record_id=sid and new_values->>'record_disable_reason'='Duplicate reviewed by teacher' and actor_id=a.id) then raise exception 'Audit missing';end if;
perform set_config('request.jwt.claim.sub',(select id::text from public.profiles where active_role='parent' limit 1),true);
set local role authenticated;blocked:=false;
begin perform public.correct_assigned_learner(sid,'{"disable_reason":"Forbidden parent edit"}');exception when others then blocked:=true;end;
if not blocked then raise exception 'Parent correction permitted';end if;
reset role;insert into correction_checks values(a.campus,true);
end loop;end $$;
select * from correction_checks;
rollback;