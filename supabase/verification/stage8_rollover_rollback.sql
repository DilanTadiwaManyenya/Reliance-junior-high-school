-- Temporarily confirms history and applies/reverses one retention; ALWAYS ROLLBACK.
begin;
do $$ declare actor uuid; learner public.students%rowtype; destination uuid; ids uuid[]; request jsonb; batch uuid:=gen_random_uuid(); result jsonb; n integer;
begin
 select id into actor from public.profiles where active_role='admin' and campus='all' limit 1;
 select s.* into learner from public.students s join public.school_classes c on c.active and c.campus=s.campus and c.class_level=s.class_level and coalesce(c.class_stream,'')=coalesce(s.class_stream,'')
 where s.status='active' and s.campus='junior' and (c.capacity is null or c.capacity>=(select count(*) from public.students p where p.status='active' and p.campus=c.campus and p.class_level=c.class_level and coalesce(p.class_stream,'')=coalesce(c.class_stream,''))) order by s.id limit 1;
 if actor is null or learner.id is null then raise exception 'Acceptance requires Main Admin and a registered Junior class with capacity'; end if;
 select id into destination from public.school_classes where active and campus=learner.campus and class_level=learner.class_level and coalesce(class_stream,'')=coalesce(learner.class_stream,'') limit 1;
 select array_agg(id) into ids from public.report_period_contexts where student_id=learner.id and academic_year=public.rollover_source_year(learner.id,learner.enrolled_year);
 perform set_config('request.jwt.claim.sub',actor::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','aal','aal2')::text,true);
 set local role authenticated;
 perform public.review_report_contexts(ids,'Rollback acceptance against the school register',null,false);
 reset role;
 request:=jsonb_build_array(jsonb_build_object('student_id',learner.id,'source_year',public.rollover_source_year(learner.id,learner.enrolled_year),'expected_version',md5(to_jsonb(learner)::text),'action','retain','destination_class_id',destination));
 set local role authenticated;
 result:=public.apply_year_rollover(batch,'junior','Rollback acceptance of reviewed retention',request,true);
 if result->>'preview'<>'true' then raise exception 'Preview failed'; end if;
 result:=public.apply_year_rollover(batch,'junior','Rollback acceptance of reviewed retention',request,false);
 if result->>'applied'<>'true' then raise exception 'Apply failed'; end if;
 result:=public.apply_year_rollover(batch,'junior','Rollback acceptance of reviewed retention',request,false);
 if result->>'already_applied'<>'true' then raise exception 'Lost-response retry failed'; end if;
 n:=public.reverse_year_rollover(batch,'Rollback acceptance of school-reviewed correction');
 if n<>1 then raise exception 'Reversal failed'; end if;
 reset role;
 if public.rollover_roster_state((select s from public.students s where id=learner.id)) is distinct from public.rollover_roster_state(learner) then raise exception 'Roster was not restored'; end if;
end $$;
select true preview_passed,true retention_applied,true duplicate_retry_safe,true reviewed_reversal_passed;
rollback;
