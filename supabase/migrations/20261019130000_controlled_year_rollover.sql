-- Reviewed roster changes only. No fees, admissions or source marks are generated.
begin;
create table if not exists public.academic_lifecycle_settings (
 id integer primary key check(id=1), baseline_year integer not null check(baseline_year between 2020 and 2100)
);
insert into public.academic_lifecycle_settings values(1,extract(year from timezone('Africa/Harare',now()))::integer) on conflict do nothing;
alter table public.academic_lifecycle_settings enable row level security;
revoke all on public.academic_lifecycle_settings from public,anon,authenticated,service_role;

create table if not exists public.year_rollover_batches (
 id uuid primary key, created_at timestamptz not null default now(), actor_id uuid not null,
 campus text not null check(campus in ('junior','senior')), reason text not null, request_fingerprint text not null,
 state text not null default 'applied' check(state in ('applied','reversed')),
 reversed_at timestamptz, reversed_by uuid, reversal_reason text
);
create table if not exists public.year_rollover_entries (
 id uuid primary key default gen_random_uuid(), batch_id uuid not null references public.year_rollover_batches,
 student_id uuid not null references public.students on delete restrict,
 source_year integer not null, target_year integer not null check(target_year=source_year+1),
 action text not null check(action in ('promote','retain','transfer','complete')),
 destination_class_id uuid references public.school_classes on delete restrict,
 before_roster jsonb not null, after_roster jsonb not null,
 state text not null default 'applied' check(state in ('applied','reversed')),
 unique(batch_id,student_id)
);
create unique index if not exists year_rollover_once on public.year_rollover_entries(student_id,source_year) where state='applied';
create index if not exists year_rollover_history on public.year_rollover_entries(student_id,target_year);
alter table public.year_rollover_batches enable row level security;
alter table public.year_rollover_entries enable row level security;
revoke all on public.year_rollover_batches,public.year_rollover_entries from public,anon,authenticated,service_role;
grant select on public.year_rollover_batches,public.year_rollover_entries to authenticated,service_role;
drop policy if exists "Campus admins read rollover batches" on public.year_rollover_batches;
create policy "Campus admins read rollover batches" on public.year_rollover_batches for select to authenticated
 using(public.has_active_role('admin') and public.can_manage_school_campus(campus));
drop policy if exists "Campus admins read rollover entries" on public.year_rollover_entries;
create policy "Campus admins read rollover entries" on public.year_rollover_entries for select to authenticated
 using(exists(select 1 from public.year_rollover_batches b where b.id=batch_id));

create or replace function public.rollover_roster_state(p_student public.students)
returns jsonb language sql immutable set search_path=public as $$
 select jsonb_build_object('campus',p_student.campus,'class_level',p_student.class_level,
 'class_stream',p_student.class_stream,'status',p_student.status);
$$;
create or replace function public.rollover_source_year(p_student uuid,p_enrolled_year integer)
returns integer language sql stable security definer set search_path=public as $$
 select greatest((select baseline_year from public.academic_lifecycle_settings where id=1),p_enrolled_year,
 (select max(target_year) from public.year_rollover_entries where student_id=p_student and state='applied'));
$$;
create or replace function public.rollover_next_level(p_level text)
returns text language sql immutable set search_path=public as $$
 select case p_level when 'ECD A' then 'ECD B' when 'ECD B' then 'Grade 1'
 when 'Grade 1' then 'Grade 2' when 'Grade 2' then 'Grade 3' when 'Grade 3' then 'Grade 4'
 when 'Grade 4' then 'Grade 5' when 'Grade 5' then 'Grade 6' when 'Grade 6' then 'Grade 7'
 when 'Grade 7' then 'Form 1' when 'Form 1' then 'Form 2' when 'Form 2' then 'Form 3'
 when 'Form 3' then 'Form 4' when 'Form 4' then 'Lower Six' when 'Lower Six' then 'Upper Six'
 when 'Form 5' then 'Upper Six' end;
$$;
create or replace function public.rollover_history_reviewed(p_student uuid,p_year integer)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.report_period_contexts where student_id=p_student and academic_year=p_year)
 and not exists(select 1 from public.report_period_contexts where student_id=p_student and academic_year=p_year and confirmed_at is null)
 and exists(select 1 from public.students s join lateral (
  select * from public.report_period_contexts c where c.student_id=s.id and c.academic_year=p_year order by term desc limit 1
 )c on c.campus=s.campus and c.class_level=s.class_level and coalesce(c.class_stream,'')=coalesce(s.class_stream,'') where s.id=p_student);
$$;
revoke all on function public.rollover_roster_state(public.students),public.rollover_source_year(uuid,integer),public.rollover_next_level(text),public.rollover_history_reviewed(uuid,integer) from public,anon,authenticated;
grant execute on function public.rollover_roster_state(public.students),public.rollover_source_year(uuid,integer),public.rollover_next_level(text),public.rollover_history_reviewed(uuid,integer) to service_role;

create or replace function public.review_year_rollover(p_campus text,p_search text default '',p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb;
begin
 if not coalesce(public.has_active_role('admin') and public.can_manage_school_campus(p_campus),false) or p_campus not in ('junior','senior') then raise exception 'Administrator campus access required'; end if;
 if p_offset is null or p_offset<0 or length(coalesce(p_search,''))>120 then raise exception 'Invalid review filters'; end if;
 with roster as (
  select s.*,public.rollover_source_year(s.id,s.enrolled_year) source_year from public.students s
  where s.status='active' and s.campus=p_campus and (coalesce(trim(p_search),'')='' or position(lower(trim(p_search)) in lower(s.full_name||' '||s.admission_number))>0)
 ), page as (select * from roster order by full_name,id limit 50 offset p_offset)
 select jsonb_build_object('total',(select count(*) from roster),'campus',p_campus,
 'rows',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'full_name',p.full_name,'admission_number',p.admission_number,
 'campus',p.campus,'class_level',p.class_level,'class_stream',p.class_stream,'source_year',p.source_year,'target_year',p.source_year+1,
 'expected_version',md5(to_jsonb(s)::text),'history_reviewed',public.rollover_history_reviewed(p.id,p.source_year),
 'eligible_year',p.source_year<=extract(year from timezone('Africa/Harare',now()))::integer,
 'suggested_level',public.rollover_next_level(p.class_level)) order by p.full_name,p.id)
 from page p join public.students s on s.id=p.id),'[]'),
 'classes',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'campus',c.campus,'class_level',c.class_level,'class_stream',c.class_stream,'capacity',c.capacity,
 'current_occupancy',(select count(*) from public.students s where s.status='active' and s.campus=c.campus and s.class_level=c.class_level and coalesce(s.class_stream,'')=coalesce(c.class_stream,''))) order by c.campus,c.class_level,c.class_stream)
 from public.school_classes c where c.active and public.can_manage_school_campus(c.campus)),'[]')) into result;
 return result;
end $$;

create or replace function public.apply_year_rollover(p_batch_id uuid,p_campus text,p_reason text,p_decisions jsonb,p_preview boolean default true)
returns jsonb language plpgsql security definer set search_path=public as $$
declare decision jsonb; learner public.students%rowtype; destination public.school_classes%rowtype;
 source_year integer; chosen_action text; before_state jsonb; after_state jsonb; item record; affected integer:=0;
 simulated jsonb:='[]'; capacity_result jsonb:='[]'; prior public.year_rollover_batches%rowtype;
begin
 if not coalesce(public.has_active_role('admin') and public.can_manage_school_campus(p_campus),false) or p_campus not in ('junior','senior') then raise exception 'Administrator campus access required'; end if;
 if p_batch_id is null or p_preview is null or length(trim(coalesce(p_reason,''))) not between 8 and 500 or jsonb_typeof(p_decisions) is distinct from 'array' then raise exception 'A batch ID, review reason and decisions are required'; end if;
 if jsonb_array_length(p_decisions) not between 1 and 100 then raise exception 'Review between 1 and 100 learners per batch'; end if;
 if (select count(distinct d->>'student_id') from jsonb_array_elements(p_decisions)d)<>jsonb_array_length(p_decisions) then raise exception 'Duplicate or missing learner decision'; end if;
 -- Serializes capacity projection, concurrent submissions and reversals.
 perform pg_advisory_xact_lock(hashtextextended('school-year-rollover',0));
 select * into prior from public.year_rollover_batches where id=p_batch_id;
 if found then
  if prior.actor_id=auth.uid() and prior.campus=p_campus and prior.state='applied' and not p_preview then
   -- A response-loss retry succeeds only for the exact original payload.
   if exists(select 1 from public.year_rollover_entries e where e.batch_id=p_batch_id) and
    (select count(*) from public.year_rollover_entries where batch_id=p_batch_id)=jsonb_array_length(p_decisions)
    and not exists(select 1 from jsonb_array_elements(p_decisions)d where not exists(select 1 from public.year_rollover_entries e
      where e.batch_id=p_batch_id and e.student_id=(d->>'student_id')::uuid and e.action=d->>'action'
      and e.destination_class_id is not distinct from nullif(d->>'destination_class_id','')::uuid))
    and prior.reason=trim(p_reason) and prior.request_fingerprint=md5(p_decisions::text) then return jsonb_build_object('batch_id',p_batch_id,'applied',true,'already_applied',true); end if;
  end if;
  raise exception 'This batch ID has already been used';
 end if;
 -- Lock rows consistently; class changes cannot race capacity checking.
 lock table public.students in share row exclusive mode;
 perform 1 from public.school_classes order by id for share;
 perform 1 from public.students where id in(select (d->>'student_id')::uuid from jsonb_array_elements(p_decisions)d) order by id for update;
 for decision in select d from jsonb_array_elements(p_decisions)d order by d->>'student_id' loop
  select * into learner from public.students where id=(decision->>'student_id')::uuid;
  if not found or learner.status<>'active' or learner.campus<>p_campus then raise exception 'Learner is unavailable in this campus'; end if;
  if decision->>'expected_version' is distinct from md5(to_jsonb(learner)::text) then raise exception 'Learner changed after review. Refresh and review again'; end if;
  source_year:=public.rollover_source_year(learner.id,learner.enrolled_year);
  if (decision->>'source_year')::integer is distinct from source_year or source_year>extract(year from timezone('Africa/Harare',now()))::integer then raise exception 'Year decision is stale or already applied'; end if;
  if not public.rollover_history_reviewed(learner.id,source_year) then raise exception 'Confirm every source-year report context against the school register first'; end if;
  chosen_action:=decision->>'action';before_state:=public.rollover_roster_state(learner);after_state:=before_state;
  if chosen_action='complete' then
   if learner.class_level not in ('Grade 7','Form 4','Upper Six','Form 6') or nullif(decision->>'destination_class_id','') is not null then raise exception 'Completion requires a final-year learner and no destination class'; end if;
   after_state:=after_state||jsonb_build_object('status','inactive');destination.id:=null;
  else
   if chosen_action is null or chosen_action not in ('promote','retain','transfer') then raise exception 'Choose promotion, retention, transfer or completion'; end if;
   select * into destination from public.school_classes where id=nullif(decision->>'destination_class_id','')::uuid and active;
   if not found or not public.can_manage_school_campus(destination.campus) then raise exception 'Active destination class is outside your authority'; end if;
   if destination.campus<>learner.campus and not public.is_main_school_admin() then raise exception 'Main Admin must review cross-campus placements'; end if;
   if chosen_action='promote' and destination.class_level is distinct from public.rollover_next_level(learner.class_level) then raise exception 'Promotion must use the next school level'; end if;
   if chosen_action in ('retain','transfer') and destination.class_level<>learner.class_level then raise exception 'Retention or stream transfer must keep the same level'; end if;
   if chosen_action='transfer' and destination.campus=learner.campus and coalesce(destination.class_stream,'')=coalesce(learner.class_stream,'') then raise exception 'Transfer must change the class allocation'; end if;
   if destination.campus<>(case when destination.class_level like 'Grade %' or destination.class_level like 'ECD %' then 'junior' else 'senior' end) then raise exception 'Destination level and campus disagree'; end if;
   after_state:=after_state||jsonb_build_object('campus',destination.campus,'class_level',destination.class_level,'class_stream',destination.class_stream);
  end if;
  simulated:=simulated||jsonb_build_array(jsonb_build_object('student_id',learner.id,'source_year',source_year,'action',chosen_action,'destination_class_id',destination.id,'before',before_state,'after',after_state));
 end loop;
 for item in select c.* from public.school_classes c where c.id in(select nullif(d->>'destination_class_id','')::uuid from jsonb_array_elements(simulated)d) loop
  select count(*) into affected from (
   select public.rollover_roster_state(s) r from public.students s where s.status='active' and not exists(select 1 from jsonb_array_elements(simulated)d where d->>'student_id'=s.id::text)
   union all select d->'after' from jsonb_array_elements(simulated)d
  )p where p.r->>'status'='active' and p.r->>'campus'=item.campus and p.r->>'class_level'=item.class_level and coalesce(p.r->>'class_stream','')=coalesce(item.class_stream,'');
  if item.capacity is not null and affected>item.capacity then raise exception 'Destination capacity exceeded. Review class capacity and placements'; end if;
  capacity_result:=capacity_result||jsonb_build_array(jsonb_build_object('class_id',item.id,'campus',item.campus,'class_level',item.class_level,'class_stream',item.class_stream,'projected_occupancy',affected,'capacity',item.capacity));
 end loop;
 if p_preview then return jsonb_build_object('preview',true,'count',jsonb_array_length(simulated),'capacity',capacity_result); end if;
 insert into public.year_rollover_batches(id,actor_id,campus,reason,request_fingerprint)values(p_batch_id,auth.uid(),p_campus,trim(p_reason),md5(p_decisions::text));
 for decision in select d from jsonb_array_elements(simulated)d loop
  insert into public.year_rollover_entries(batch_id,student_id,source_year,target_year,action,destination_class_id,before_roster,after_roster)
  values(p_batch_id,(decision->>'student_id')::uuid,(decision->>'source_year')::integer,(decision->>'source_year')::integer+1,decision->>'action',nullif(decision->>'destination_class_id','')::uuid,decision->'before',decision->'after');
  -- Existing learner/report/audit triggers run; admissions and enrolled_year stay untouched.
  update public.students set campus=decision->'after'->>'campus',class_level=decision->'after'->>'class_level',class_stream=decision->'after'->>'class_stream',status=decision->'after'->>'status' where id=(decision->>'student_id')::uuid;
 end loop;
 return jsonb_build_object('batch_id',p_batch_id,'applied',true,'count',jsonb_array_length(simulated),'capacity',capacity_result);
end $$;

create or replace function public.reverse_year_rollover(p_batch_id uuid,p_reason text)
returns integer language plpgsql security definer set search_path=public as $$
declare batch public.year_rollover_batches%rowtype; entry record; learner public.students%rowtype; n integer:=0; destination public.school_classes%rowtype; projected integer;
begin
 if not coalesce(public.is_main_school_admin() and public.has_active_role('admin'),false) then raise exception 'Main Admin access required'; end if;
 if length(trim(coalesce(p_reason,''))) not between 8 and 500 then raise exception 'A correction reason of 8–500 characters is required'; end if;
 perform pg_advisory_xact_lock(hashtextextended('school-year-rollover',0));
 select * into batch from public.year_rollover_batches where id=p_batch_id for update;
 if not found or batch.state<>'applied' then raise exception 'Applied batch is unavailable'; end if;
 lock table public.students in share row exclusive mode;
 perform 1 from public.school_classes order by id for share;
 perform 1 from public.students where id in(select student_id from public.year_rollover_entries where batch_id=p_batch_id) order by id for update;
 for entry in select * from public.year_rollover_entries where batch_id=p_batch_id order by student_id loop
  select * into learner from public.students where id=entry.student_id;
  if public.rollover_roster_state(learner) is distinct from entry.after_roster or exists(select 1 from public.year_rollover_entries e where e.student_id=entry.student_id and e.state='applied' and e.target_year>entry.target_year) then raise exception 'Roster has moved on; this batch cannot be safely reversed'; end if;
  -- A new-year report is evidence that teaching has started in the new allocation.
  if exists(select 1 from public.report_period_contexts c where c.student_id=entry.student_id and c.academic_year>=entry.target_year) then raise exception 'New-year reporting has begun; review corrections with the system owner'; end if;
  select * into destination from public.school_classes c where c.active and c.campus=entry.before_roster->>'campus' and c.class_level=entry.before_roster->>'class_level' and coalesce(c.class_stream,'')=coalesce(entry.before_roster->>'class_stream','') limit 1;
  if not found then raise exception 'Original class must be active before reversing placements'; end if;
  select count(*) into projected from (
   select public.rollover_roster_state(s) r from public.students s where s.status='active' and not exists(select 1 from public.year_rollover_entries e where e.batch_id=p_batch_id and e.student_id=s.id)
   union all select e.before_roster from public.year_rollover_entries e where e.batch_id=p_batch_id
  ) p where p.r->>'status'='active' and p.r->>'campus'=destination.campus and p.r->>'class_level'=destination.class_level and coalesce(p.r->>'class_stream','')=coalesce(destination.class_stream,'');
  if destination.capacity is not null and projected>destination.capacity then raise exception 'Original class capacity would be exceeded by reversal'; end if;
 end loop;
 for entry in select * from public.year_rollover_entries where batch_id=p_batch_id order by student_id loop
  update public.students set campus=entry.before_roster->>'campus',class_level=entry.before_roster->>'class_level',class_stream=entry.before_roster->>'class_stream',status=entry.before_roster->>'status' where id=entry.student_id;
  n:=n+1;
 end loop;
 update public.year_rollover_entries set state='reversed' where batch_id=p_batch_id;
 update public.year_rollover_batches set state='reversed',reversed_at=now(),reversed_by=auth.uid(),reversal_reason=trim(p_reason) where id=p_batch_id;
 return n;
end $$;
revoke all on function public.review_year_rollover(text,text,integer),public.apply_year_rollover(uuid,text,text,jsonb,boolean),public.reverse_year_rollover(uuid,text) from public,anon;
grant execute on function public.review_year_rollover(text,text,integer),public.apply_year_rollover(uuid,text,text,jsonb,boolean),public.reverse_year_rollover(uuid,text) to authenticated,service_role;
notify pgrst,'reload schema';
commit;
