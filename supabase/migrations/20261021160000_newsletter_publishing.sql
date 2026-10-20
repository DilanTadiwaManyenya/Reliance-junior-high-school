begin;
-- Replace a draft audience in one transaction; a bad target preserves the old set.
create function public.save_announcement_targets(p_announcement_id uuid,p_targets jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare item public.announcements;
begin
 select * into item from public.announcements where id=p_announcement_id for update;
 if not public.portal_mfa_satisfied() or not public.can_manage_school_announcement(p_announcement_id)
   or item.state is distinct from 'draft' then raise exception 'Only your draft newsletter audience may be changed' using errcode='42501'; end if;
 if jsonb_typeof(p_targets) is distinct from 'array' then raise exception 'Choose an audience' using errcode='22023'; end if;
 if jsonb_array_length(p_targets) not between 1 and 50 then raise exception 'Choose between 1 and 50 audience targets' using errcode='22023'; end if;
 delete from public.announcement_targets where announcement_id=p_announcement_id;
 insert into public.announcement_targets(announcement_id,campus,class_level,class_stream)
 select p_announcement_id,t.campus,coalesce(t.class_level,''),coalesce(t.class_stream,'')
 from jsonb_to_recordset(p_targets) as t(campus text,class_level text,class_stream text);
end;
$$;
create function public.parent_school_updates(p_student_id uuid,p_offset integer default 0,p_limit integer default 20)
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
 and t.campus=learner.campus and (t.class_level='' or t.class_level=learner.class_level)
 and (t.class_stream='' or t.class_stream=coalesce(learner.class_stream,'')))
 ) select jsonb_build_object('learner_id',learner.id,'total_count',(select count(*) from scoped),
 'items',coalesce((select jsonb_agg(to_jsonb(page) order by pinned desc,published_at desc,id desc)
 from (select * from scoped order by pinned desc,published_at desc,id desc limit p_limit offset p_offset) page),'[]'::jsonb)) into result;
 return result;
end;
$$;
revoke all on function public.save_announcement_targets(uuid,jsonb),public.parent_school_updates(uuid,integer,integer) from public,anon;
grant execute on function public.save_announcement_targets(uuid,jsonb),public.parent_school_updates(uuid,integer,integer) to authenticated;
notify pgrst,'reload schema';
commit;
