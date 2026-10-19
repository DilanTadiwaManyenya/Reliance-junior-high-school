-- Forward-only, database-authored correction history. Existing records are not backfilled.
begin;
create table if not exists public.school_record_changes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default clock_timestamp(),
  source_table text not null,
  record_id uuid not null,
  operation text not null check(operation in ('INSERT','UPDATE','DELETE')),
  actor_id uuid, actor_name text not null, actor_role text not null,
  learner_id uuid, learner_name text,
  campus text, previous_campus text,
  context jsonb not null default '{}',
  old_values jsonb not null, new_values jsonb not null,
  changed_fields text[] not null
);
create index if not exists school_record_changes_time_idx on public.school_record_changes(created_at desc,id desc);
create index if not exists school_record_changes_learner_idx on public.school_record_changes(learner_id,created_at desc);
create index if not exists school_record_changes_campus_idx on public.school_record_changes(campus,created_at desc);
alter table public.school_record_changes enable row level security;
revoke all on public.school_record_changes from public,anon,authenticated,service_role;
grant select on public.school_record_changes to authenticated,service_role;
drop policy if exists "Managers read scoped record changes" on public.school_record_changes;
create policy "Managers read scoped record changes" on public.school_record_changes for select to authenticated using (
  public.is_main_school_admin() or (
    campus in ('junior','senior') and public.can_read_school_campus(campus)
    and (previous_campus is null or public.can_read_school_campus(previous_campus))
  )
);
drop policy if exists "Admin sessions require MFA" on public.school_record_changes;
create policy "Admin sessions require MFA" on public.school_record_changes as restrictive for all to authenticated
  using(public.portal_mfa_satisfied()) with check(public.portal_mfa_satisfied());

create or replace function public.capture_school_record_change()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  before_row jsonb:='{}'; after_row jsonb:='{}'; row_data jsonb;
  previous_values jsonb:='{}'; next_values jsonb:='{}'; fields text[]:='{}'; field text;
  learner uuid; previous_learner uuid; learner_label text; current_campus text; old_campus text;
  actor_label text; actor_scope text; record_context jsonb;
begin
  if tg_op<>'INSERT' then before_row:=to_jsonb(old); end if;
  if tg_op<>'DELETE' then after_row:=to_jsonb(new); end if;
  foreach field in array tg_argv[0]::text[] loop
    if coalesce(before_row->field,'null'::jsonb) is distinct from coalesce(after_row->field,'null'::jsonb) then
      fields:=array_append(fields,field);
      previous_values:=previous_values||jsonb_build_object(field,before_row->field);
      next_values:=next_values||jsonb_build_object(field,after_row->field);
    end if;
  end loop;
  if cardinality(fields)=0 then return null; end if;
  row_data:=case when tg_op='DELETE' then before_row else after_row end;
  if tg_table_name='students' then
    learner:=(row_data->>'id')::uuid; learner_label:=row_data->>'full_name';
    current_campus:=row_data->>'campus';
    if tg_op='UPDATE' then old_campus:=before_row->>'campus'; end if;
  else
    learner:=(row_data->>'student_id')::uuid;
    select full_name,campus into learner_label,current_campus from public.students where id=learner;
    if tg_op='UPDATE' then
      previous_learner:=(before_row->>'student_id')::uuid;
      select campus into old_campus from public.students where id=previous_learner;
      -- Unknown campus must never expose a change across a missing old learner.
      if not found then old_campus:='unknown'; end if;
    end if;
  end if;
  select full_name,coalesce(active_role,role) into actor_label,actor_scope from public.profiles where id=auth.uid();
  record_context:=jsonb_strip_nulls(jsonb_build_object('subject',row_data->'subject','component',row_data->'component',
    'development_area',row_data->'development_area','term',row_data->'term','year',row_data->'year',
    'date',row_data->'date','assessment_id',row_data->'assessment_id','class_level',row_data->'class_level'));
  insert into public.school_record_changes(source_table,record_id,operation,actor_id,actor_name,actor_role,
    learner_id,learner_name,campus,previous_campus,context,old_values,new_values,changed_fields)
  values(tg_table_name,(row_data->>'id')::uuid,tg_op,auth.uid(),
    coalesce(actor_label,'Service / database operation'),coalesce(actor_scope,auth.jwt()->>'role',session_user),
    learner,learner_label,current_campus,old_campus,record_context,previous_values,next_values,fields);
  return null;
end;
$$;
revoke all on function public.capture_school_record_change() from public,anon,authenticated,service_role;
grant execute on function public.capture_school_record_change() to service_role;

drop trigger if exists school_record_change_history on public.students;
create trigger school_record_change_history after insert or update or delete on public.students for each row
  execute function public.capture_school_record_change('{full_name,admission_number,date_of_birth,class_level,class_stream,enrolled_year,status,inactive_reason,sex,birth_cert_no,address,parent_phone,parent_name,campus}');
drop trigger if exists school_record_change_history on public.academic_records;
create trigger school_record_change_history after insert or update or delete on public.academic_records for each row
  execute function public.capture_school_record_change('{student_id,term,subject,score,grade,comment,term_mark,exam_mark,percentage,points,year,teachers_comment,teacher_initials}');
drop trigger if exists school_record_change_history on public.attendance;
create trigger school_record_change_history after insert or update or delete on public.attendance for each row
  execute function public.capture_school_record_change('{student_id,date,status,late_minutes,note}');
drop trigger if exists school_record_change_history on public.coursework_marks;
create trigger school_record_change_history after insert or update or delete on public.coursework_marks for each row
  execute function public.capture_school_record_change('{student_id,assessment_id,score}');
drop trigger if exists school_record_change_history on public.junior_component_marks;
create trigger school_record_change_history after insert or update or delete on public.junior_component_marks for each row
  execute function public.capture_school_record_change('{student_id,subject,component,score,possible_mark,term,year,comment}');
drop trigger if exists school_record_change_history on public.junior_developmental_ratings;
create trigger school_record_change_history after insert or update or delete on public.junior_developmental_ratings for each row
  execute function public.capture_school_record_change('{student_id,development_area,rating,term,year,comment}');
notify pgrst,'reload schema';
commit;
