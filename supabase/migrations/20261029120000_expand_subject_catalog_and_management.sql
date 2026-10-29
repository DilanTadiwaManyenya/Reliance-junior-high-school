-- Complete the canonical curriculum catalog and provide atomic, MFA-guarded
-- subject maintenance operations for the Main Admin portal.
begin;

with curriculum(subject_code, display_name, group_code) as (values
  ('ecd_english_languages','English Languages','ecd_a_b'),
  ('ecd_indigenous_languages','Indigenous Languages','ecd_a_b'),
  ('ecd_mathematics_science_1','Mathematics & Science (1)','ecd_a_b'),
  ('ecd_mathematics_science_2','Mathematics & Science (2)','ecd_a_b'),
  ('ecd_heritage_science_1','Heritage & Science Studies (1)','ecd_a_b'),
  ('ecd_heritage_science_2','Heritage & Science Studies (2)','ecd_a_b'),
  ('ecd_mass_display','Mass Display','ecd_a_b'),
  ('ecd_visual_performing_arts','Visual & Performing Arts','ecd_a_b'),
  ('ecd_physical_education','Physical Education','ecd_a_b'),
  ('ecd_computers_ict','Computers (ICT)','ecd_a_b'),
  ('ecd_guidance_counseling','Guidance & Counseling','ecd_a_b'),
  ('primary_english','English','grade_1_2'),
  ('primary_shona','Shona','grade_1_2'),
  ('mathematics','Mathematics','grade_1_2'),
  ('primary_social_science','Social Science','grade_1_2'),
  ('sciences_technology_ict','Sciences & Technology, ICT','grade_1_2'),
  ('pe_arts','PE & Arts','grade_1_2'),
  ('english_language','English Language','grade_3_7'),
  ('shona_language','Shona Language','grade_3_7'),
  ('mathematics','Mathematics','grade_3_7'),
  ('primary_social_science','Social Science','grade_3_7'),
  ('sciences_technology_ict','Sciences & Technology, ICT','grade_3_7'),
  ('pe_arts','PE & Arts','grade_3_7'),
  ('english_language','English Language','form_1_2_zgc'),
  ('english_literature','English Literature','form_1_2_zgc'),
  ('chishona','Chishona','form_1_2_zgc'),
  ('mathematics','Mathematics','form_1_2_zgc'),
  ('combined_science','Combined Science','form_1_2_zgc'),
  ('computer_science','Computer Science','form_1_2_zgc'),
  ('history','History','form_1_2_zgc'),
  ('geography','Geography','form_1_2_zgc'),
  ('heritage_studies','Heritage Studies','form_1_2_zgc'),
  ('family_religious_studies','Family Religious Studies','form_1_2_zgc'),
  ('business_studies','Business Studies','form_1_2_zgc'),
  ('bes','B.E.S','form_1_2_zgc'),
  ('accounting','Accounting','form_1_2_zgc'),
  ('english_language','English Language','form_3_4'),
  ('english_literature','English Literature','form_3_4'),
  ('chishona','Chishona','form_3_4'),
  ('mathematics','Mathematics','form_3_4'),
  ('combined_science','Combined Science','form_3_4'),
  ('computer_science','Computer Science','form_3_4'),
  ('history','History','form_3_4'),
  ('geography','Geography','form_3_4'),
  ('heritage_studies','Heritage Studies','form_3_4'),
  ('family_religious_studies','Family Religious Studies','form_3_4'),
  ('business_studies','Business Studies','form_3_4'),
  ('bes','B.E.S','form_3_4'),
  ('accounting','Accounting','form_3_4'),
  ('english_language','English Language','lower_six_arts'),
  ('english_literature','English Literature','lower_six_arts'),
  ('chishona','Chishona','lower_six_arts'),
  ('history','History','lower_six_arts'),
  ('geography','Geography','lower_six_arts'),
  ('heritage_studies','Heritage Studies','lower_six_arts'),
  ('family_religious_studies','Family Religious Studies','lower_six_arts'),
  ('sociology','Sociology','lower_six_arts'),
  ('communication_skills','Communication Skills','lower_six_arts'),
  ('economics','Economics','lower_six_commercials'),
  ('bes','B.E.S','lower_six_commercials'),
  ('business_studies','Business Studies','lower_six_commercials'),
  ('accounting','Accounting','lower_six_commercials'),
  ('statistics','Statistics','lower_six_commercials'),
  ('geography','Geography','lower_six_commercials'),
  ('computer_science','Computer Science','lower_six_sciences'),
  ('mathematics','Mathematics','lower_six_sciences'),
  ('chemistry','Chemistry','lower_six_sciences'),
  ('physics','Physics','lower_six_sciences'),
  ('biology','Biology','lower_six_sciences'),
  ('chishona','Chishona','lower_six_commercials'),
  ('heritage_studies','Heritage Studies','lower_six_commercials'),
  ('chishona','Chishona','lower_six_sciences'),
  ('heritage_studies','Heritage Studies','lower_six_sciences'),
  ('english_language','English Language','upper_six_arts'),
  ('english_literature','English Literature','upper_six_arts'),
  ('chishona','Chishona','upper_six_arts'),
  ('history','History','upper_six_arts'),
  ('geography','Geography','upper_six_arts'),
  ('heritage_studies','Heritage Studies','upper_six_arts'),
  ('family_religious_studies','Family Religious Studies','upper_six_arts'),
  ('sociology','Sociology','upper_six_arts'),
  ('communication_skills','Communication Skills','upper_six_arts'),
  ('economics','Economics','upper_six_commercials'),
  ('bes','B.E.S','upper_six_commercials'),
  ('business_studies','Business Studies','upper_six_commercials'),
  ('accounting','Accounting','upper_six_commercials'),
  ('statistics','Statistics','upper_six_commercials'),
  ('geography','Geography','upper_six_commercials'),
  ('computer_science','Computer Science','upper_six_sciences'),
  ('mathematics','Mathematics','upper_six_sciences'),
  ('chemistry','Chemistry','upper_six_sciences'),
  ('physics','Physics','upper_six_sciences'),
  ('biology','Biology','upper_six_sciences'),
  ('chishona','Chishona','upper_six_commercials'),
  ('heritage_studies','Heritage Studies','upper_six_commercials'),
  ('chishona','Chishona','upper_six_sciences'),
  ('heritage_studies','Heritage Studies','upper_six_sciences')
), subjects as (
  insert into public.subject_catalog(subject_code, display_name)
  select distinct subject_code, display_name from curriculum
  on conflict(subject_code) do update set display_name=excluded.display_name
  returning id, subject_code
)
insert into public.subject_catalog_group_memberships(subject_id, group_code)
select subjects.id, curriculum.group_code
from curriculum join subjects using(subject_code)
join public.curriculum_subject_groups groups using(group_code)
on conflict(subject_id, group_code) do nothing;

-- Seed each canonical name as an alias within its curriculum scope so staff
-- allocation and report lookup can resolve renamed display labels reliably.
insert into public.subject_catalog_aliases(alias_key, alias_label, subject_id, group_code)
select public.normalize_subject_label(subject.display_name), subject.display_name,
       membership.subject_id, membership.group_code
from public.subject_catalog_group_memberships membership
join public.subject_catalog subject on subject.id=membership.subject_id
on conflict(alias_key, group_code) do update
set alias_label=excluded.alias_label, subject_id=excluded.subject_id;

insert into public.subject_catalog_aliases(alias_key, alias_label, subject_id, group_code)
select public.normalize_subject_label(aliases.alias_label), aliases.alias_label, subject.id, aliases.group_code
from (values
  ('english_language','English','form_1_2_zgc'),('english_language','English','form_3_4'),
  ('chishona','Shona','form_1_2_zgc'),('chishona','Shona','form_3_4'),
  ('chishona','Shona','lower_six_arts'),('chishona','Shona','lower_six_commercials'),('chishona','Shona','lower_six_sciences'),
  ('chishona','Shona','upper_six_arts'),('chishona','Shona','upper_six_commercials'),('chishona','Shona','upper_six_sciences'),
  ('heritage_studies','Heritage','form_1_2_zgc'),('heritage_studies','Heritage','form_3_4'),
  ('heritage_studies','Heritage','lower_six_arts'),('heritage_studies','Heritage','lower_six_commercials'),('heritage_studies','Heritage','lower_six_sciences'),
  ('heritage_studies','Heritage','upper_six_arts'),('heritage_studies','Heritage','upper_six_commercials'),('heritage_studies','Heritage','upper_six_sciences'),
  ('bes','BES','form_1_2_zgc'),('bes','BES','form_3_4'),('bes','BES','lower_six_commercials'),('bes','BES','upper_six_commercials')
) aliases(subject_code, alias_label, group_code)
join public.subject_catalog subject using(subject_code)
on conflict(alias_key, group_code) do update
set alias_label=excluded.alias_label, subject_id=excluded.subject_id;

-- Reconcile current senior allocations without replacing their familiar
-- labels. Junior uses a separate Shona subject and remains explicitly scoped.
update public.teacher_class_subject_assignments allocation
set subject_id=alias.subject_id
from public.subject_catalog_aliases alias
where public.normalize_subject_label(allocation.subject)=alias.alias_key
  and (
    alias.group_code=case
      when allocation.class_level in ('Form 1','Form 2') then 'form_1_2_zgc'
      when allocation.class_level in ('Form 3','Form 4') then 'form_3_4'
      when allocation.class_level='Lower Six' and lower(allocation.class_stream) in ('arts','commercials','sciences') then 'lower_six_'||lower(allocation.class_stream)
      when allocation.class_level='Upper Six' and lower(allocation.class_stream) in ('arts','commercials','sciences') then 'upper_six_'||lower(allocation.class_stream)
      else null
    end
    or (allocation.class_level='Lower Six' and coalesce(allocation.class_stream,'')=''
      and alias.group_code like 'lower_six_%'
      and (select count(distinct scoped.group_code) from public.subject_catalog_aliases scoped
        where scoped.alias_key=alias.alias_key and scoped.subject_id=alias.subject_id and scoped.group_code like 'lower_six_%')=3)
    or (allocation.class_level='Upper Six' and coalesce(allocation.class_stream,'')=''
      and alias.group_code like 'upper_six_%'
      and (select count(distinct scoped.group_code) from public.subject_catalog_aliases scoped
        where scoped.alias_key=alias.alias_key and scoped.subject_id=alias.subject_id and scoped.group_code like 'upper_six_%')=3)
  )
  and allocation.subject_id is distinct from alias.subject_id;

create or replace function public.save_subject_catalog_entry(
  p_subject_id uuid,
  p_subject_code text,
  p_display_name text,
  p_group_codes text[]
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  existing public.subject_catalog%rowtype;
  subject_id_value uuid;
  normalized_code text:=lower(trim(coalesce(p_subject_code,'')));
  display_value text:=trim(coalesce(p_display_name,''));
  group_values text[];
  previous_aliases text[]:='{}';
begin
  if auth.uid() is null or not coalesce(public.has_active_role('admin'),false)
     or not coalesce(public.portal_mfa_satisfied(),false) then
    raise exception 'Verified administrator access is required' using errcode='42501';
  end if;
  if length(display_value) not between 2 and 120 then raise exception 'Subject name must be 2–120 characters'; end if;
  if p_group_codes is null or cardinality(p_group_codes) not between 1 and 11 or array_position(p_group_codes,null) is not null then
    raise exception 'Choose one or more curriculum groups';
  end if;
  select array_agg(distinct group_code order by group_code) into group_values from unnest(p_group_codes) group_code;
  if cardinality(group_values)<>cardinality(p_group_codes) then raise exception 'Choose each curriculum group once'; end if;
  if exists(select 1 from unnest(group_values) g where not exists(select 1 from public.curriculum_subject_groups x where x.group_code=g)) then
    raise exception 'One or more curriculum groups are unavailable';
  end if;

  if p_subject_id is null then
    if normalized_code !~ '^[a-z][a-z0-9_]{1,79}$' then raise exception 'Subject code must use lowercase letters, numbers, or underscores'; end if;
    insert into public.subject_catalog(subject_code,display_name,is_active)
    values(normalized_code,display_value,true) returning id into subject_id_value;
  else
    select * into existing from public.subject_catalog where id=p_subject_id for update;
    if not found then raise exception 'Subject not found'; end if;
    subject_id_value:=existing.id;
    select coalesce(array_agg(alias_label), '{}'::text[]) into previous_aliases
    from public.subject_catalog_aliases where subject_id=existing.id;
    if exists (
      select 1 from public.subject_catalog_aliases a
      where a.alias_key=public.normalize_subject_label(display_value)
        and a.group_code=any(group_values) and a.subject_id<>existing.id
    ) then raise exception 'That subject name is already used in one of the selected groups'; end if;
    if exists (
      select 1 from public.teacher_class_subject_assignments current_assignment
      join public.teacher_class_subject_assignments other_assignment
        on other_assignment.teacher_id=current_assignment.teacher_id
       and other_assignment.class_level=current_assignment.class_level
       and other_assignment.class_stream=current_assignment.class_stream
       and other_assignment.id<>current_assignment.id
       and public.normalize_subject_label(other_assignment.subject)=public.normalize_subject_label(display_value)
      where current_assignment.subject_id=existing.id
    ) then raise exception 'A teacher already has another allocation using the new subject name; resolve that allocation before renaming'; end if;
    if exists (
      select 1 from public.teacher_class_subject_assignments
      where subject_id=existing.id
      group by teacher_id,class_level,class_stream having count(*)>1
    ) then raise exception 'This subject has duplicate teacher allocations for the same class scope; resolve them before renaming'; end if;
    if exists (
      select 1 from public.teacher_subject_assignments current_assignment
      join public.teacher_subject_assignments other_assignment
        on other_assignment.teacher_id=current_assignment.teacher_id
       and other_assignment.form_level=current_assignment.form_level
       and other_assignment.id<>current_assignment.id
       and public.normalize_subject_label(other_assignment.subject)=public.normalize_subject_label(display_value)
      where current_assignment.subject=any(previous_aliases)
        and ((current_assignment.form_level in ('Form 1','Form 2') and exists(select 1 from unnest(group_values) g where g='form_1_2_zgc'))
          or (current_assignment.form_level in ('Form 3','Form 4') and exists(select 1 from unnest(group_values) g where g='form_3_4'))
          or (current_assignment.form_level='Lower Six' and exists(select 1 from unnest(group_values) g where g like 'lower_six_%'))
          or (current_assignment.form_level='Upper Six' and exists(select 1 from unnest(group_values) g where g like 'upper_six_%')))
    ) then raise exception 'A legacy teacher allocation conflicts with the new subject name; resolve it before renaming'; end if;
    update public.subject_catalog set display_name=display_value,is_active=true,updated_at=now() where id=existing.id;
    update public.teacher_class_subject_assignments set subject=display_value where subject_id=existing.id;
    if cardinality(previous_aliases)>0 then
      update public.teacher_subject_assignments legacy set subject=display_value
      where legacy.subject=any(previous_aliases)
        and ((legacy.form_level in ('Form 1','Form 2') and exists(select 1 from unnest(group_values) g where g='form_1_2_zgc'))
          or (legacy.form_level in ('Form 3','Form 4') and exists(select 1 from unnest(group_values) g where g='form_3_4'))
          or (legacy.form_level='Lower Six' and exists(select 1 from unnest(group_values) g where g like 'lower_six_%'))
          or (legacy.form_level='Upper Six' and exists(select 1 from unnest(group_values) g where g like 'upper_six_%')));
    end if;
    delete from public.subject_catalog_aliases
    where subject_id=existing.id and alias_key=public.normalize_subject_label(existing.display_name);
    delete from public.subject_catalog_aliases
    where subject_id=existing.id and group_code<>all(group_values);
    delete from public.subject_catalog_group_memberships where subject_id=existing.id;
  end if;

  insert into public.subject_catalog_group_memberships(subject_id,group_code)
  select subject_id_value,group_code from unnest(group_values) group_code
  on conflict(subject_id,group_code) do nothing;
  insert into public.subject_catalog_aliases(alias_key,alias_label,subject_id,group_code)
  select public.normalize_subject_label(display_value),display_value,subject_id_value,group_code
  from unnest(group_values) group_code
  on conflict(alias_key,group_code) do update set alias_label=excluded.alias_label,subject_id=excluded.subject_id;
  return subject_id_value;
end;
$$;

create or replace function public.set_subject_catalog_active(p_subject_id uuid,p_is_active boolean)
returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or not coalesce(public.has_active_role('admin'),false)
     or not coalesce(public.portal_mfa_satisfied(),false) then
    raise exception 'Verified administrator access is required' using errcode='42501';
  end if;
  update public.subject_catalog set is_active=p_is_active,updated_at=now() where id=p_subject_id;
  if not found then raise exception 'Subject not found'; end if;
end;
$$;

create or replace function public.delete_unused_subject_catalog_entry(p_subject_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or not coalesce(public.has_active_role('admin'),false)
     or not coalesce(public.portal_mfa_satisfied(),false) then
    raise exception 'Verified administrator access is required' using errcode='42501';
  end if;
  if exists(select 1 from public.teacher_class_subject_assignments where subject_id=p_subject_id) then
    raise exception 'This subject still has teacher allocations. Retire it or reassign those teachers first.';
  end if;
  if exists(
    select 1 from public.teacher_subject_assignments allocation
    join public.subject_catalog_aliases alias
      on alias.alias_key=public.normalize_subject_label(allocation.subject)
    where alias.subject_id=p_subject_id
  ) then
    raise exception 'This subject still has legacy teacher allocations. Retire it or reassign those teachers first.';
  end if;
  delete from public.subject_catalog_aliases where subject_id=p_subject_id;
  delete from public.subject_catalog where id=p_subject_id;
  if not found then raise exception 'Subject not found'; end if;
end;
$$;

-- New report periods use the managed catalog. Existing snapshots keep their
-- saved rules so a later catalog edit cannot rewrite historical reports.
create or replace function public.report_rules_for_new_period(p_level text,p_stream text)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare
 rules jsonb:=public.report_rules_baseline(p_level,p_stream);
 group_code_value text;
 catalog_subjects jsonb;
 group_name text;
 grading_scale jsonb;
begin
 group_code_value:=case
  when p_level like 'Grade %' or p_level like 'ECD%' then
   case when p_level like 'ECD%' then 'ecd_a_b'
        when p_level in ('Grade 1','Grade 2') then 'grade_1_2'
        when p_level in ('Grade 3','Grade 4','Grade 5','Grade 6','Grade 7') then 'grade_3_7'
        else null end
  when p_level in ('Form 1','Form 2') then 'form_1_2_zgc'
  when p_level in ('Form 3','Form 4') then 'form_3_4'
  when p_level in ('Lower Six','Upper Six') and lower(coalesce(p_stream,'')) in ('arts','commercials','sciences')
   then lower(replace(p_level,' ','_'))||'_'||lower(p_stream)
  else null
 end;
 if group_code_value is not null then
  select coalesce(jsonb_agg(subject.display_name order by subject.display_name),'[]'::jsonb)
   into catalog_subjects
  from public.subject_catalog_group_memberships membership
  join public.subject_catalog subject on subject.id=membership.subject_id and subject.is_active
  where membership.group_code=group_code_value;
  rules:=jsonb_set(rules,'{subjects}',catalog_subjects,true);
 end if;

 group_name:=case
  when p_level like 'Grade %' or p_level like 'ECD%' then 'primary'
  when p_level ~ '^Form [1-4]$' then 'olevel'
  else 'alevel'
 end;
 select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
   'grade',b.grade,'points',b.points,'description',b.description,'minimum',b.minimum_score,
   'unit',case when group_name='primary' then nullif(substring(b.grade from '[0-9]+'),'')::integer else null end
  )) order by b.minimum_score desc)
 into grading_scale
 from public.grade_bands b where b.band_group=group_name;
 if grading_scale is not null then rules:=jsonb_set(rules,'{grading_scale}',grading_scale,true); end if;
 return rules;
end;
$$;
revoke all on function public.report_rules_for_new_period(text,text) from public,anon,authenticated;
grant execute on function public.report_rules_for_new_period(text,text) to service_role;

revoke all on function public.save_subject_catalog_entry(uuid,text,text,text[]),
  public.set_subject_catalog_active(uuid,boolean), public.delete_unused_subject_catalog_entry(uuid) from public,anon;
grant execute on function public.save_subject_catalog_entry(uuid,text,text,text[]),
  public.set_subject_catalog_active(uuid,boolean), public.delete_unused_subject_catalog_entry(uuid) to authenticated,service_role;

commit;
