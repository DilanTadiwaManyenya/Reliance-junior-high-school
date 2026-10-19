-- Transactional acceptance only: simulated class move and review are ROLLED BACK.
-- Never remove the final ROLLBACK or run this as a promotion operation.
begin;
do $$
declare main_id uuid; junior_id uuid; senior_id uuid; context public.report_period_contexts%rowtype;
 destination public.school_classes%rowtype; before_summary jsonb; after_summary jsonb; admission text; n integer;
begin
 select id into main_id from public.profiles where active_role='admin' and campus='all' limit 1;
 select id into junior_id from public.profiles where active_role='admin' and campus='junior' limit 1;
 select id into senior_id from public.profiles where active_role='admin' and campus='senior' limit 1;
 select c.* into context from public.report_period_contexts c where c.campus='junior'
  and exists(select 1 from public.junior_component_marks m where m.student_id=c.student_id and m.year=c.academic_year and public.report_term_number(m.term)=c.term)
  order by c.academic_year desc,c.term desc,c.id limit 1;
 select * into destination from public.school_classes where campus='senior' and active and class_level='Form 1' limit 1;
 if main_id is null or junior_id is null or senior_id is null or context.id is null or destination.id is null then raise exception 'Required live acceptance fixtures are unavailable'; end if;
 select admission_number into admission from public.students where id=context.student_id;
 perform set_config('request.jwt.claim.sub',main_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',main_id,'role','authenticated','aal','aal2')::text,true);
 set local role authenticated;
 select to_jsonb(s) into before_summary from public.junior_report_summary(context.student_id,context.term,context.academic_year)s;
 update public.students set campus=destination.campus,class_level=destination.class_level,class_stream=destination.class_stream where id=context.student_id;
 select to_jsonb(s) into after_summary from public.junior_report_summary(context.student_id,context.term,context.academic_year)s;
 if before_summary is distinct from after_summary then raise exception 'Old rankings changed after simulated move'; end if;
 if not exists(select 1 from public.report_period_contexts c where c.id=context.id and to_jsonb(c)=to_jsonb(context)) then raise exception 'Old class/rules/staff snapshot changed'; end if;
 if not exists(select 1 from public.students where id=context.student_id and admission_number=admission) then raise exception 'Admission identifier changed'; end if;
 n:=public.review_report_contexts(array[context.id],'Rollback acceptance: verified class register',null,false);
 if n<>1 or not exists(select 1 from public.school_record_changes where source_table='report_period_contexts' and record_id=context.id and actor_id=main_id) then raise exception 'Context review did not produce an attributed audit event'; end if;
 reset role;
 perform set_config('request.jwt.claim.sub',junior_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',junior_id,'role','authenticated','aal','aal2')::text,true);
 set local role authenticated;
 if public.read_report_period(context.student_id,context.academic_year,context.term)->'context'->>'campus'<>'junior' then raise exception 'Old campus lost historical access'; end if;
 reset role;
 perform set_config('request.jwt.claim.sub',senior_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',senior_id,'role','authenticated','aal','aal2')::text,true);
 set local role authenticated;
 if exists(select 1 from public.report_period_contexts where id=context.id) then raise exception 'New campus gained old report metadata'; end if;
 if exists(select 1 from public.junior_component_marks where student_id=context.student_id and year=context.academic_year and public.report_term_number(term)=context.term) then raise exception 'New campus gained old marks'; end if;
 reset role;
end $$;
select true old_class_rules_staff_and_rankings_preserved,true admission_unchanged,true review_audited,true campus_access_preserved;
rollback;
