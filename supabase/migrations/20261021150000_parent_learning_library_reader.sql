-- Selected-learner reads, with no additional profile/table grants for parents.
begin;
create function public.parent_learning_library(
 p_student_id uuid, p_subject text default '', p_year integer default null,
 p_term integer default null, p_offset integer default 0, p_limit integer default 20
) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare learner public.students; result jsonb;
begin
 if not public.has_active_role('parent') then raise exception 'Parent library access required' using errcode='42501'; end if;
 if p_limit is null or p_limit<1 or p_limit>50 or p_offset is null or p_offset<0 or p_offset>10000
   or (p_term is not null and p_term not between 1 and 3)
   or (p_year is not null and p_year not between 2000 and 2200)
   or p_subject is null or length(p_subject)>160 then
   raise exception 'Invalid library filters or page size' using errcode='22023'; end if;
 select s.* into learner from public.students s
 where s.id=p_student_id and s.status='active' and s.campus in ('junior','senior')
 and exists(select 1 from public.parent_student l where l.student_id=s.id
   and l.parent_id=auth.uid() and l.verified_at is not null);
 if not found then raise exception 'No verified active learner connection is available' using errcode='42501'; end if;

 with scoped as materialized (
   select r.id,r.title,r.description,r.subject,r.academic_year,r.term,r.published_at,
     coalesce(nullif(p.full_name,''),'Assigned teacher') as teacher_name,
     jsonb_build_object('id',f.id,'bucket_id',f.bucket_id,'object_path',f.object_path,
       'original_name',f.original_name,'mime_type',f.mime_type,'size_bytes',f.size_bytes,
       'active',f.active,'ready',f.ready) as file
   from public.learning_resources r
   join public.portal_content_files f on f.resource_id=r.id and f.ready and f.active
   left join public.profiles p on p.id=r.teacher_id
   where r.campus=learner.campus and r.class_level=learner.class_level
     and (r.class_stream='' or r.class_stream=coalesce(learner.class_stream,''))
     and r.state='published' and r.published_at<=now()
     and public.can_read_learning_resource(r.id)
 ), filtered as (
   select * from scoped where (p_subject='' or subject=p_subject)
     and (p_year is null or academic_year=p_year) and (p_term is null or term=p_term)
 )
 select jsonb_build_object(
   'learner',jsonb_build_object('id',learner.id,'full_name',learner.full_name,'campus',learner.campus,
     'class_level',learner.class_level,'class_stream',learner.class_stream,'status',learner.status),
   'subjects',coalesce((select jsonb_agg(subject order by subject) from (select distinct subject from scoped) s),'[]'::jsonb),
   'years',coalesce((select jsonb_agg(academic_year order by academic_year desc) from (select distinct academic_year from scoped) y),'[]'::jsonb),
   'total_count',(select count(*) from filtered),
   'resources',coalesce((select jsonb_agg(to_jsonb(page) order by published_at desc,id desc) from
     (select * from filtered order by published_at desc,id desc limit p_limit offset p_offset) page),'[]'::jsonb)
 ) into result;
 return result;
end;
$$;
revoke all on function public.parent_learning_library(uuid,text,integer,integer,integer,integer) from public,anon;
grant execute on function public.parent_learning_library(uuid,text,integer,integer,integer,integer) to authenticated;
comment on function public.parent_learning_library(uuid,text,integer,integer,integer,integer) is
 'Parent-only, verified selected-learner resources. Exposes teacher display name, never private staff contact details.';
notify pgrst,'reload schema';
commit;
