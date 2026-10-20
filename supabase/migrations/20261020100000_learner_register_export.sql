begin;
-- One statement snapshot, SECURITY INVOKER: existing learner RLS still applies.
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
   and (p_scope not in ('class','stream') or s.class_level=p_level)
   and (p_scope<>'stream' or s.class_stream=p_stream)
  order by s.campus,s.class_level,s.class_stream,s.full_name,s.id limit 20001)r;
 if jsonb_array_length(rows)>20000 then raise exception 'Register exceeds 20000 learners. Select a campus or class to export'; end if;
 return jsonb_build_object('scope',p_scope,'campus',p_campus,'level',p_level,'stream',p_stream,
 'generated_at',now(),'count',jsonb_array_length(rows),'learners',rows);
end $$;
revoke all on function public.export_learner_register(text,text,text,text) from public,anon;
grant execute on function public.export_learner_register(text,text,text,text) to authenticated,service_role;
notify pgrst,'reload schema';
commit;
