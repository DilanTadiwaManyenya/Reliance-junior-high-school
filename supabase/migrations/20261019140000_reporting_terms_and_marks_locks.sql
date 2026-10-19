begin;
create table if not exists public.reporting_periods (
 id uuid primary key default gen_random_uuid(), campus text not null check(campus in ('junior','senior')),
 academic_year integer not null check(academic_year between 2020 and 2100), term integer not null check(term between 1 and 3),
 state text not null default 'open' check(state in ('open','closed')), is_current boolean not null default false,
 revision integer not null default 1, changed_at timestamptz not null default now(), changed_by uuid,
 unique(campus,academic_year,term),check(not is_current or state='open')
);
create unique index if not exists reporting_period_one_current on public.reporting_periods(campus) where is_current;
create table if not exists public.reporting_period_events (
 id uuid primary key default gen_random_uuid(), period_id uuid not null references public.reporting_periods on delete restrict,
 created_at timestamptz not null default now(), actor_id uuid, actor_name text, campus text not null,
 action text not null, reason text not null, before_state jsonb, after_state jsonb not null
);
alter table public.reporting_periods enable row level security;
alter table public.reporting_period_events enable row level security;
revoke all on public.reporting_periods,public.reporting_period_events from public,anon,authenticated,service_role;
grant select on public.reporting_periods,public.reporting_period_events to authenticated,service_role;
drop policy if exists "Staff read campus terms" on public.reporting_periods;
create policy "Staff read campus terms" on public.reporting_periods for select to authenticated using(
 public.portal_mfa_satisfied() and (public.can_read_school_campus(campus) or public.accountant_can_access_campus(campus)
 or (public.has_active_role('teacher') and exists(select 1 from public.profiles p where p.id=auth.uid() and p.campus=reporting_periods.campus))));
drop policy if exists "Admins read term events" on public.reporting_period_events;
create policy "Admins read term events" on public.reporting_period_events for select to authenticated using(public.has_active_role('admin') and public.can_manage_school_campus(campus));

-- Preserve current editing behavior at rollout: existing periods begin open.
insert into public.reporting_periods(campus,academic_year,term)
select campus,academic_year,term from public.report_period_contexts
union select campus,academic_year,public.report_term_number(term) from public.coursework_assessments
on conflict(campus,academic_year,term) do nothing;
insert into public.reporting_periods(campus,academic_year,term,is_current)
select c,extract(year from timezone('Africa/Harare',now()))::integer,(extract(month from timezone('Africa/Harare',now()))::integer-1)/4+1,true
from unnest(array['junior','senior'])c
where not exists(select 1 from public.reporting_periods p where p.campus=c and p.is_current)
on conflict(campus,academic_year,term) do update set is_current=true
 where public.reporting_periods.state='open' and not exists(select 1 from public.reporting_periods p where p.campus=excluded.campus and p.is_current);
insert into public.reporting_period_events(period_id,campus,action,reason,after_state)
select p.id,p.campus,'baseline','Existing editing periods imported as open; no term was closed automatically',to_jsonb(p) from public.reporting_periods p
where not exists(select 1 from public.reporting_period_events e where e.period_id=p.id);

create or replace function public.change_reporting_period(p_campus text,p_year integer,p_term integer,p_action text,p_reason text,p_expected_revision integer default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare period public.reporting_periods%rowtype; previous public.reporting_periods%rowtype; before_value jsonb; actor_name text;
begin
 if not coalesce(public.has_active_role('admin') and public.can_manage_school_campus(p_campus),false) then raise exception 'Administrator campus access required'; end if;
 if p_year is null or p_year not between 2020 and 2100 or p_term is null or p_term not between 1 and 3 or length(trim(coalesce(p_reason,''))) not between 8 and 500 or p_action is null or p_action not in ('create','close','reopen','set_current') then raise exception 'Valid period, action and review reason are required'; end if;
 perform pg_advisory_xact_lock(hashtextextended('reporting-period-'||p_campus,0));
 select p.* into period from public.reporting_periods p where p.campus=p_campus and p.academic_year=p_year and p.term=p_term for update;
 if p_action='create' then
  if found then raise exception 'Period already exists. Refresh the registry'; end if;
  insert into public.reporting_periods(campus,academic_year,term,changed_by)values(p_campus,p_year,p_term,auth.uid())returning * into period;
 else
  if not found or p_expected_revision is distinct from period.revision then raise exception 'Period changed after review. Refresh the registry'; end if;
  before_value:=to_jsonb(period);
  if p_action='close' then
   if period.state<>'open' then raise exception 'Only an open period can be closed'; end if;
   period.state:='closed';period.is_current:=false;
  elsif p_action='reopen' then
   if period.state<>'closed' then raise exception 'Only a closed period can be reopened'; end if;
   period.state:='open';
  else
   if period.state<>'open' then raise exception 'Reopen the period before making it current'; end if;
   for previous in select * from public.reporting_periods where campus=p_campus and is_current and id<>period.id for update loop
    update public.reporting_periods set is_current=false,revision=revision+1,changed_at=now(),changed_by=auth.uid() where id=previous.id;
    insert into public.reporting_period_events(period_id,actor_id,actor_name,campus,action,reason,before_state,after_state)
    select previous.id,auth.uid(),p.full_name,p_campus,'unset_current',trim(p_reason),to_jsonb(previous),to_jsonb(r)
    from public.reporting_periods r cross join public.profiles p where r.id=previous.id and p.id=auth.uid();
   end loop;
   period.is_current:=true;
  end if;
  update public.reporting_periods set state=period.state,is_current=period.is_current,revision=revision+1,changed_at=now(),changed_by=auth.uid() where id=period.id returning * into period;
 end if;
 select full_name into actor_name from public.profiles where id=auth.uid();
 insert into public.reporting_period_events(period_id,actor_id,actor_name,campus,action,reason,before_state,after_state)
 values(period.id,auth.uid(),actor_name,p_campus,p_action,trim(p_reason),before_value,to_jsonb(period));
 return to_jsonb(period);
end $$;
revoke all on function public.change_reporting_period(text,integer,integer,text,text,integer) from public,anon;
grant execute on function public.change_reporting_period(text,integer,integer,text,text,integer) to authenticated,service_role;

create or replace function public.assert_reporting_period_open(p_table text,p_row jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare campus_value text; year_value integer; term_value integer; period public.reporting_periods%rowtype;
begin
 if p_table='coursework_assessments' then
  campus_value:=p_row->>'campus';year_value:=(p_row->>'academic_year')::integer;term_value:=public.report_term_number(p_row->>'term');
 elsif p_table='coursework_marks' then
  select a.campus,a.academic_year,public.report_term_number(a.term) into campus_value,year_value,term_value from public.coursework_assessments a where a.id=(p_row->>'assessment_id')::uuid;
 else
  year_value:=coalesce((p_row->>'year')::integer,extract(year from coalesce((p_row->>'created_at')::timestamptz,now()))::integer);
  term_value:=public.report_term_number(p_row->>'term');
  select c.campus into campus_value from public.report_period_contexts c where c.student_id=(p_row->>'student_id')::uuid and c.academic_year=year_value and c.term=term_value;
  if campus_value is null then select s.campus into campus_value from public.students s where s.id=(p_row->>'student_id')::uuid; end if;
 end if;
 -- Share-lock serializes an in-flight mark transaction with close/reopen.
 select * into period from public.reporting_periods p where p.campus=campus_value and p.academic_year=year_value and p.term=term_value for share;
 if not found or period.state<>'open' then raise exception 'Reporting period is closed or not registered. Ask your campus administrator to review it'; end if;
end $$;
create or replace function public.enforce_reporting_period_write()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_op in ('UPDATE','DELETE') then perform public.assert_reporting_period_open(tg_table_name,to_jsonb(old)); end if;
 if tg_op in ('INSERT','UPDATE') then perform public.assert_reporting_period_open(tg_table_name,to_jsonb(new)); end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
revoke all on function public.assert_reporting_period_open(text,jsonb),public.enforce_reporting_period_write() from public,anon,authenticated;
grant execute on function public.assert_reporting_period_open(text,jsonb),public.enforce_reporting_period_write() to service_role;
do $$ declare table_name text;begin
 foreach table_name in array array['academic_records','junior_component_marks','junior_developmental_ratings','report_card_comments','coursework_assessments','coursework_marks'] loop
  execute format('drop trigger if exists a_enforce_report_period on public.%I',table_name);
  execute format('create trigger a_enforce_report_period before insert or update or delete on public.%I for each row execute function public.enforce_reporting_period_write()',table_name);
 end loop;
end $$;
notify pgrst,'reload schema';
commit;
