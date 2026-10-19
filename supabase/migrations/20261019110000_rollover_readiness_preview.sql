-- Read-only planning against the current active roster; no promotion is applied.
begin;
create or replace function public.preview_year_rollover(
  p_campus text, p_search text default '', p_offset integer default 0, p_limit integer default 50
) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb;
begin
  if p_campus is null or p_campus not in ('junior','senior')
     or not coalesce(public.has_active_role('admin'),false)
     or not coalesce(public.can_manage_school_campus(p_campus),false) then
    raise exception 'Only an administrator assigned to this campus can preview rollover';
  end if;
  if p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 100
     or length(coalesce(p_search,''))>120 then raise exception 'Invalid preview filters'; end if;
  with progression(source_level,target_level,target_campus,transition) as (values
    ('ECD A','ECD B','junior','standard'),('ECD B','Grade 1','junior','standard'),
    ('Grade 1','Grade 2','junior','standard'),('Grade 2','Grade 3','junior','standard'),
    ('Grade 3','Grade 4','junior','standard'),('Grade 4','Grade 5','junior','standard'),
    ('Grade 5','Grade 6','junior','standard'),('Grade 6','Grade 7','junior','standard'),
    ('Grade 7','Form 1','senior','campus_transition'),
    ('Form 1','Form 2','senior','standard'),('Form 2','Form 3','senior','standard'),
    ('Form 3','Form 4','senior','standard'),('Form 4','Lower Six','senior','sixth_form'),
    ('Lower Six','Upper Six','senior','standard'),('Form 5','Upper Six','senior','standard'),
    ('Upper Six',null,'senior','completion'),('Form 6',null,'senior','completion')
  ), roster as (
    select s.id,s.full_name,s.admission_number,s.class_level as source_level,s.class_stream as source_stream,s.campus,s.enrolled_year,
      p.target_level,p.target_campus,p.transition,
      exists(select 1 from public.school_classes c where c.active and c.campus=s.campus and c.class_level=s.class_level
        and coalesce(nullif(c.class_stream,'N/A'),'')=coalesce(nullif(s.class_stream,'N/A'),'')) as source_registered
    from public.students s left join progression p on p.source_level=s.class_level
    where s.status='active' and s.campus=p_campus
      and (coalesce(trim(p_search),'')='' or position(lower(trim(p_search)) in lower(s.full_name||' '||s.admission_number))>0)
  ), destinations as (
    select r.*,coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'class_level',c.class_level,
      'class_stream',c.class_stream,'campus',c.campus,'capacity',c.capacity) order by coalesce(c.class_stream,''),c.id)
      from public.school_classes c where c.active and c.class_level=r.target_level and c.campus=r.target_campus
        and public.can_manage_school_campus(c.campus)),'[]'::jsonb) as candidates
    from roster r
  ), matches as (
    select d.*, (select case when count(*)=1 then min(c->>'id') else null end from jsonb_array_elements(d.candidates)c
      where coalesce(nullif(c->>'class_stream','N/A'),'')=coalesce(nullif(d.source_stream,'N/A'),'')) as matched_class_id
    from destinations d
  ), review as (
    select m.*,case
      when enrolled_year>extract(year from timezone('Africa/Harare',now()))::integer then 'enrolment_year_review'
      when not source_registered then 'source_class_review'
      when transition is null then 'unknown_level_review'
      when transition='completion' then 'completion_review'
      when target_campus<>p_campus and not public.is_main_school_admin() then 'main_admin_transition'
      when jsonb_array_length(candidates)=0 then 'missing_target_class'
      when transition='campus_transition' then 'campus_transition_review'
      when transition='sixth_form' then 'sixth_form_review'
      when matched_class_id is null then 'stream_review'
      else 'standard_review' end as review_status
    from matches m
  ), page as (
    select * from review order by source_level,full_name,id limit p_limit offset p_offset
  )
  select jsonb_build_object(
    'source_year',extract(year from timezone('Africa/Harare',now()))::integer,
    'target_year',extract(year from timezone('Africa/Harare',now()))::integer+1,
    'generated_at',now(),'campus',p_campus,'total',(select count(*) from review),
    'standard_count',(select count(*) from review where review_status='standard_review'),
    'review_count',(select count(*) from review where review_status<>'standard_review'),
    'missing_target_count',(select count(*) from review where review_status='missing_target_class'),
    'rows',coalesce((select jsonb_agg(to_jsonb(page)-'transition'-'matched_class_id'||jsonb_build_object(
      'proposed_class_id',case when review_status='standard_review' then matched_class_id else null end)
      order by source_level,full_name,id) from page),'[]'::jsonb)
  ) into result;
  return result;
end;
$$;
revoke all on function public.preview_year_rollover(text,text,integer,integer) from public,anon;
grant execute on function public.preview_year_rollover(text,text,integer,integer) to authenticated,service_role;
notify pgrst,'reload schema';
commit;
