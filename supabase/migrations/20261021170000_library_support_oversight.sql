begin;
create function public.school_library_oversight(
 p_campus text,p_kind text default 'notes',p_state text default '',p_level text default '',
 p_search text default '',p_offset integer default 0,p_limit integer default 20
) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb;
begin
 if not public.portal_mfa_satisfied() or not (
   (public.has_active_role('admin') and ((p_campus='all' and public.is_main_school_admin()) or public.can_manage_school_campus(p_campus)))
   or (public.has_active_role('accountant') and p_campus in ('junior','senior') and public.accountant_can_access_campus(p_campus))
 ) then raise exception 'Assigned campus support access required' using errcode='42501'; end if;
 if p_campus is null or p_campus not in ('all','junior','senior') or p_kind is null or p_kind not in ('notes','newsletters')
 or p_state is null or p_state not in ('','draft','published','archived') or p_level is null or length(p_level)>80
 or p_search is null or length(p_search)>160 or p_offset is null or p_offset not between 0 and 10000
 or p_limit is null or p_limit not between 1 and 50 then raise exception 'Invalid support filters' using errcode='22023'; end if;
 with scoped as materialized (
 select r.id,r.title,r.description as body,r.campus,r.state,r.class_level,r.class_stream,r.subject,
 r.academic_year,r.term,r.published_at,r.updated_at,
 coalesce(nullif(p.full_name,''),'Assigned teacher') as author_name,
 null::timestamptz as expires_at,null::text as audience,'[]'::jsonb as targets,
 (select jsonb_build_object('id',f.id,'bucket_id',f.bucket_id,'object_path',f.object_path,
 'original_name',f.original_name,'mime_type',f.mime_type,'size_bytes',f.size_bytes,'ready',f.ready,'active',f.active)
 from public.portal_content_files f where f.resource_id=r.id and f.ready and f.active) as file
 from public.learning_resources r left join public.profiles p on p.id=r.teacher_id
 where p_kind='notes' and (p_campus='all' or r.campus=p_campus) and public.can_read_learning_resource(r.id)
 union all
 select a.id,a.title,a.body,a.campus,a.state,'','','',null::integer,null::integer,a.published_at,a.updated_at,
 coalesce(nullif(p.full_name,''),'School Admin'),a.expires_at,a.audience,
 coalesce((select jsonb_agg(jsonb_build_object('campus',t.campus,'class_level',t.class_level,'class_stream',t.class_stream))
 from public.announcement_targets t where t.announcement_id=a.id),'[]'::jsonb),
 (select jsonb_build_object('id',f.id,'bucket_id',f.bucket_id,'object_path',f.object_path,
 'original_name',f.original_name,'mime_type',f.mime_type,'size_bytes',f.size_bytes,'ready',f.ready,'active',f.active)
 from public.portal_content_files f where f.announcement_id=a.id and f.ready and f.active)
 from public.announcements a left join public.profiles p on p.id=a.created_by
 where p_kind='newsletters' and public.can_read_school_announcement(a.id)
 and (p_campus='all' or a.campus=p_campus or (a.campus='all' and exists(select 1 from public.announcement_targets t where t.announcement_id=a.id and t.campus=p_campus)))
 ), filtered as (
 select * from scoped where (p_state='' or state=p_state)
 and (p_level='' or class_level=p_level or exists(select 1 from jsonb_array_elements(targets) t where t->>'class_level' in ('',p_level)))
 and (p_search='' or strpos(lower(title||' '||author_name||' '||subject),lower(p_search))>0)
 ) select jsonb_build_object('campus',p_campus,'kind',p_kind,
 'levels',coalesce((select jsonb_agg(class_level order by class_level) from (select distinct class_level from scoped where class_level<>'') l),'[]'::jsonb),
 'total_count',(select count(*) from filtered),
 'items',coalesce((select jsonb_agg(to_jsonb(page) order by updated_at desc,id desc) from
 (select * from filtered order by updated_at desc,id desc limit p_limit offset p_offset) page),'[]'::jsonb)) into result;
 return result;
end;
$$;

create function public.school_content_trace(p_kind text,p_id uuid,p_offset integer default 0,p_limit integer default 20)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb; content_campus text;
begin
 if not public.portal_mfa_satisfied() or not (public.has_active_role('admin') or public.has_active_role('accountant')) then raise exception 'School support access required' using errcode='42501'; end if;
 if p_kind is null or p_kind not in ('notes','newsletters') or p_offset is null or p_offset not between 0 and 10000
 or p_limit is null or p_limit not between 1 and 50 then raise exception 'Invalid trace page' using errcode='22023'; end if;
 if p_kind='notes' then
 select campus into content_campus from public.learning_resources where id=p_id and public.can_read_learning_resource(id);
 else select campus into content_campus from public.announcements where id=p_id and public.can_read_school_announcement(id); end if;
 if content_campus is null or not (public.is_main_school_admin() or
 (content_campus in ('junior','senior') and (public.can_manage_school_campus(content_campus) or public.accountant_can_access_campus(content_campus)))
 or (content_campus='all' and p_kind='newsletters' and public.can_read_school_announcement(p_id)))
 then raise exception 'Content is unavailable to your campus' using errcode='42501'; end if;
 with scoped as materialized (
 select e.id,e.created_at,e.actor_role,e.source_table,e.operation,
 coalesce(nullif(p.full_name,''),'School account') as actor_name,
 (select coalesce(jsonb_object_agg(k,v),'{}'::jsonb) from jsonb_each(coalesce(e.old_values,'{}')) x(k,v)
 where k in ('title','state','active','ready','original_name','size_bytes','campus','class_level','class_stream')) as before,
 (select coalesce(jsonb_object_agg(k,v),'{}'::jsonb) from jsonb_each(coalesce(e.new_values,'{}')) x(k,v)
 where k in ('title','state','active','ready','original_name','size_bytes','campus','class_level','class_stream')) as after
 from public.portal_content_events e left join public.profiles p on p.id=e.actor_id
 where ((p_kind='notes' and e.resource_id=p_id) or (p_kind='newsletters' and e.announcement_id=p_id))
 and (public.is_main_school_admin() or (e.campus in ('junior','senior') and (public.can_manage_school_campus(e.campus) or public.accountant_can_access_campus(e.campus))))
 ) select jsonb_build_object('content_id',p_id,'audit_visible',content_campus<>'all' or public.is_main_school_admin(),
 'total_count',(select count(*) from scoped),
 'events',coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc,id desc) from
 (select * from scoped order by created_at desc,id desc limit p_limit offset p_offset) page),'[]'::jsonb)) into result;
 return result;
end;
$$;
revoke all on function public.school_library_oversight(text,text,text,text,text,integer,integer),public.school_content_trace(text,uuid,integer,integer) from public,anon;
grant execute on function public.school_library_oversight(text,text,text,text,text,integer,integer),public.school_content_trace(text,uuid,integer,integer) to authenticated;
notify pgrst,'reload schema';
commit;
