-- Apply the school's configured score bands to future report snapshots.
-- Existing report_period_contexts rows are intentionally left unchanged.
begin;

create or replace function public.report_rules_for_new_period(p_level text,p_stream text)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare
 rules jsonb:=public.report_rules_baseline(p_level,p_stream);
 group_name text;
 grading_scale jsonb;
begin
 group_name:=case
  when p_level like 'Grade %' or p_level like 'ECD%' then 'primary'
  when p_level ~ '^Form [1-4]$' then 'olevel'
  else 'alevel'
 end;
 select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
   'grade',b.grade,'points',b.points,'description',b.description,'minimum',b.minimum_score,
   'unit',case when group_name='primary' then nullif(substring(b.grade from '[0-9]+'),'')::integer else null end
  )) order by b.minimum_score desc)
 into grading_scale
 from public.grade_bands b where b.band_group=group_name;
 if grading_scale is not null then
  rules:=jsonb_set(rules,'{grading_scale}',grading_scale,true);
 end if;
 return rules;
end;
$$;
revoke all on function public.report_rules_for_new_period(text,text) from public,anon,authenticated;
grant execute on function public.report_rules_for_new_period(text,text) to service_role;

create or replace function public.capture_report_class(p_student uuid,p_year integer,p_term integer,p_provenance text)
returns void language plpgsql security definer set search_path=public as $$
declare target public.students%rowtype;
begin
 if p_year not between 2020 and 2100 or p_term not between 1 and 3 or p_year is null or p_term is null then
  raise exception 'A valid report year and term are required';
 end if;
 select * into target from public.students where id=p_student for share;
 if not found or target.campus not in ('junior','senior') or target.campus is null then
  raise exception 'Learner campus must be assigned before recording reports';
 end if;
 insert into public.report_period_contexts(student_id,academic_year,term,campus,class_level,class_stream,learner_name,admission_number,enrolled_year,
   active_when_captured,class_teacher,subject_teachers,report_rules,provenance,staffing_verified_at)
 select s.id,p_year,p_term,s.campus,s.class_level,s.class_stream,s.full_name,s.admission_number,s.enrolled_year,s.status='active',
   staff.data->'class_teacher',staff.data->'subject_teachers',public.report_rules_for_new_period(s.class_level,s.class_stream),p_provenance,
   case when p_provenance='captured' then now() else null end
 from public.students s cross join lateral (select public.report_staff_snapshot(s.campus,s.class_level,s.class_stream) data)staff
 where (s.id=p_student or (s.status='active' and s.enrolled_year<=p_year and s.campus=target.campus
   and s.class_level=target.class_level and coalesce(s.class_stream,'')=coalesce(target.class_stream,'')))
   and not exists(select 1 from public.report_period_contexts c where c.student_id=s.id and c.academic_year=p_year and c.term=p_term)
 on conflict(student_id,academic_year,term) do nothing;
end;
$$;

create or replace function public.review_report_contexts(p_ids uuid[],p_reason text,p_class_id uuid default null,p_refresh_staffing boolean default false)
returns integer language plpgsql security definer set search_path=public as $$
declare context public.report_period_contexts%rowtype; destination public.school_classes%rowtype; staff jsonb; changed integer:=0;
begin
 if not coalesce(public.has_active_role('admin'),false) then raise exception 'Verified administrator access is required'; end if;
 if p_ids is null or array_position(p_ids,null) is not null or cardinality(p_ids) not between 1 and 100 or length(trim(coalesce(p_reason,''))) not between 8 and 500 then raise exception 'Choose up to 100 contexts and give a review reason of 8–500 characters'; end if;
 if p_class_id is not null then
  if cardinality(p_ids)<>1 then raise exception 'Correct one historical class at a time'; end if;
  select * into destination from public.school_classes where id=p_class_id;
  if not found or not public.can_manage_school_campus(destination.campus) then raise exception 'Destination class is outside your campus authority'; end if;
 end if;
 for context in select * from public.report_period_contexts where id=any(p_ids) order by id for update loop
  if not public.can_manage_school_campus(context.campus) then raise exception 'Historical context is outside your campus authority'; end if;
  if p_class_id is not null then
   context.campus:=destination.campus;context.class_level:=destination.class_level;context.class_stream:=destination.class_stream;
   context.report_rules:=public.report_rules_for_new_period(context.class_level,context.class_stream);
   context.class_teacher:=null;context.subject_teachers:='[]';context.staffing_verified_at:=null;
  end if;
  if p_refresh_staffing then
   staff:=public.report_staff_snapshot(context.campus,context.class_level,context.class_stream);
   context.class_teacher:=staff->'class_teacher';context.subject_teachers:=staff->'subject_teachers';context.staffing_verified_at:=now();
  end if;
  update public.report_period_contexts set campus=context.campus,class_level=context.class_level,class_stream=context.class_stream,
   report_rules=context.report_rules,class_teacher=context.class_teacher,subject_teachers=context.subject_teachers,staffing_verified_at=context.staffing_verified_at,
   confirmed_at=now(),confirmed_by=auth.uid(),confirmation_reason=trim(p_reason) where id=context.id;
  changed:=changed+1;
 end loop;
 if changed<>(select count(distinct id) from unnest(p_ids)id) then raise exception 'A selected report context is unavailable'; end if;
 return changed;
end;
$$;
revoke all on function public.review_report_contexts(uuid[],text,uuid,boolean) from public,anon;
grant execute on function public.review_report_contexts(uuid[],text,uuid,boolean) to authenticated,service_role;

commit;
