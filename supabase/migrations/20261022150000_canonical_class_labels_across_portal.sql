begin;
create or replace function public.canonical_school_class_level(p_level text)
returns text language sql immutable parallel safe set search_path=public as $$
  select case regexp_replace(lower(trim(coalesce(p_level,''))), '\s+', ' ', 'g')
    when 'lower 6' then 'Lower Six'
    when 'form 5' then 'Lower Six'
    when 'form5' then 'Lower Six'
    when 'upper 6' then 'Upper Six'
    when 'form 6' then 'Upper Six'
    when 'form6' then 'Upper Six'
    when 'ecd a' then 'ECD A'
    when 'ecd b' then 'ECD B'
    when 'lower six' then 'Lower Six'
    when 'upper six' then 'Upper Six'
    else initcap(regexp_replace(trim(coalesce(p_level,'')), '\s+', ' ', 'g'))
  end
$$;

create or replace function public.export_learner_register(p_scope text,p_campus text default null,p_level text default null,p_stream text default null)
returns jsonb language plpgsql stable security invoker set search_path=public as $$
declare rows jsonb;
begin
 if not coalesce(public.has_active_role('admin'),false) then raise exception 'Administrator access required for learner exports'; end if;
 if p_scope is null or p_scope not in ('all','campus','class','stream') then raise exception 'Choose a valid register scope'; end if;
 if p_campus is null then
  if not coalesce(public.is_main_school_admin(),false) then raise exception 'Main Admin access required for a school-wide export'; end if;
 elsif p_campus not in ('junior','senior') or not coalesce(public.can_manage_school_campus(p_campus),false) then
  raise exception 'Export campus is outside your authority';
 end if;
 if (p_scope='all' and p_campus is not null) or (p_scope='campus' and p_campus is null)
 or (p_scope in ('all','campus') and p_level is not null) or (p_scope<>'stream' and p_stream is not null)
 or (p_scope in ('class','stream') and length(trim(coalesce(p_level,'')))=0)
 or (p_scope='stream' and length(trim(coalesce(p_stream,'')))=0)
 or length(coalesce(p_level,''))>100 or length(coalesce(p_stream,''))>100 then raise exception 'Export filters do not match the selected scope'; end if;
 select coalesce(jsonb_agg(to_jsonb(r) order by r.campus,r.class_level,r.class_stream,r.full_name,r.id),'[]') into rows
 from (select s.id,s.admission_number,s.full_name,s.date_of_birth,s.sex,s.class_level,s.class_stream,s.campus,
  s.parent_name,s.parent_phone,s.address,s.birth_cert_no,s.status
  from public.students s where (p_campus is null or s.campus=p_campus)
   and (p_scope not in ('class','stream') or public.canonical_school_class_level(s.class_level)=public.canonical_school_class_level(p_level))
   and (p_scope<>'stream' or s.class_stream=p_stream)
  order by s.campus,s.class_level,s.class_stream,s.full_name,s.id limit 20001)r;
 if jsonb_array_length(rows)>20000 then raise exception 'Register exceeds 20000 learners. Select a campus or class to export'; end if;
 return jsonb_build_object('scope',p_scope,'campus',p_campus,'level',case when p_level is null then null else public.canonical_school_class_level(p_level) end,'stream',p_stream,
 'generated_at',now(),'count',jsonb_array_length(rows),'learners',rows);
end $$;

create or replace function public.parent_school_updates(p_student_id uuid,p_offset integer default 0,p_limit integer default 20)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare learner public.students; result jsonb;
begin
 if not public.has_active_role('parent') or not public.portal_mfa_satisfied() then raise exception 'Parent access required' using errcode='42501'; end if;
 if p_limit is null or p_limit not between 1 and 50 or p_offset is null or p_offset not between 0 and 10000 then raise exception 'Invalid page' using errcode='22023'; end if;
 select s.* into learner from public.students s where s.id=p_student_id and s.status='active'
 and s.campus in ('junior','senior') and exists(select 1 from public.parent_student l
 where l.student_id=s.id and l.parent_id=auth.uid() and l.verified_at is not null);
 if not found then raise exception 'No verified active learner connection' using errcode='42501'; end if;
 with scoped as materialized (
 select a.id,a.title,a.body,a.category,a.pinned,a.published_at,a.expires_at,
 exists(select 1 from public.announcement_reads r where r.announcement_id=a.id and r.user_id=auth.uid()) as acknowledged,
 (select to_jsonb(f) from public.portal_content_files f where f.announcement_id=a.id and f.active and f.ready) as file
 from public.announcements a where a.state='published' and a.published_at<=now()
 and (a.expires_at is null or a.expires_at>now()) and a.audience in ('all','parents','students')
 and public.can_read_school_announcement(a.id)
 and exists(select 1 from public.announcement_targets t where t.announcement_id=a.id
 and t.campus=learner.campus and (t.class_level='' or public.canonical_school_class_level(t.class_level)=public.canonical_school_class_level(learner.class_level))
 and (t.class_stream='' or t.class_stream=coalesce(learner.class_stream,'')))
 ) select jsonb_build_object('learner_id',learner.id,'total_count',(select count(*) from scoped),
 'items',coalesce((select jsonb_agg(to_jsonb(page) order by pinned desc,published_at desc,id desc)
 from (select * from scoped order by pinned desc,published_at desc,id desc limit p_limit offset p_offset) page),'[]'::jsonb)) into result;
 return result;
end;
$$;
revoke all on function public.canonical_school_class_level(text) from public,anon;
grant execute on function public.canonical_school_class_level(text) to authenticated,service_role;
revoke all on function public.export_learner_register(text,text,text,text) from public,anon;
grant execute on function public.export_learner_register(text,text,text,text) to authenticated,service_role;
notify pgrst,'reload schema';
commit;
