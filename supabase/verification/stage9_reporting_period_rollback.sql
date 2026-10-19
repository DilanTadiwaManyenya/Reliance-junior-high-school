-- Close/reopen and edit probes are temporary. Always retain ROLLBACK.
begin;
do $$ declare actor uuid; period record; target uuid; assessment uuid; blocked integer:=0; statement text; result jsonb;
begin
 select p.id into actor from public.profiles p where p.active_role='admin' and p.campus='all' limit 1;
 if actor is null then raise exception 'Main Admin required for acceptance'; end if;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','aal','aal2')::text,true);
 for period in select * from public.reporting_periods where academic_year=2026 and term=3 and state='open' order by campus loop
  set local role authenticated;
  result:=public.change_reporting_period(period.campus,period.academic_year,period.term,'close','Rollback acceptance of reporting period closure',period.revision);
  reset role;
 end loop;
 select student_id into target from public.junior_component_marks where year=2026 and public.report_term_number(term)=3 limit 1;
 select id into assessment from public.coursework_assessments where academic_year=2026 and public.report_term_number(term)=3 limit 1;
 if target is null or assessment is null then raise exception 'Marked Junior learner and current assessment required'; end if;
 foreach statement in array array[
  format('update public.junior_component_marks set score=score where student_id=%L and year=2026 and public.report_term_number(term)=3',target),
  format('insert into public.junior_developmental_ratings(student_id,development_area,rating,term,year)values(%L,%L,4,%L,2026)',target,'Communication','3'),
  format('insert into public.report_card_comments(student_id,term,year)values(%L,3,2026)',target),
  'update public.academic_records set score=score where year=2026 and public.report_term_number(term)=3',
  format('update public.coursework_assessments set subject=subject where id=%L',assessment),
  format('insert into public.coursework_marks(student_id,assessment_id,score)values(%L,%L,1)',target,assessment)
 ] loop
  begin execute statement;raise exception 'Closed-period write unexpectedly succeeded';exception when others then
   if sqlerrm not like 'Reporting period is closed or not registered%' then raise;end if;blocked:=blocked+1;
  end;
 end loop;
 for period in select * from public.reporting_periods where academic_year=2026 and term=3 and state='closed' order by campus loop
  set local role authenticated;
  result:=public.change_reporting_period(period.campus,period.academic_year,period.term,'reopen','Rollback acceptance of authorised mark corrections',period.revision);
  reset role;
 end loop;
 update public.junior_component_marks set score=score where student_id=target and year=2026 and public.report_term_number(term)=3;
 if not exists(select 1 from public.reporting_period_events where action='reopen' and actor_id=actor) then raise exception 'Reopening was not audited'; end if;
 perform set_config('test.period_blocked',blocked::text,true);
end $$;
select current_setting('test.period_blocked')::integer closed_write_paths_denied,true reopened_write_allowed,true reopening_attributed;
rollback;
