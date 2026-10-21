-- Synthetic admissions and mapping changes are always rolled back.
begin;
do $$
declare learner uuid; level_name text; expected numeric; actual numeric;
begin
  update public.fee_structure_mapping set amount=123.45 where currency='USD';
  update public.fee_structure_mapping set amount=9876.54 where currency='ZWG';
  foreach level_name in array array['ECD A','Grade 1','Form 1','Form 3','Lower Six','Upper Six'] loop
    learner:=gen_random_uuid();
    expected:=coalesce(public.get_fee_amount(level_name,'USD'),0);
    insert into public.students(id,full_name,date_of_birth,class_level,class_stream,enrolled_year,status,campus)
    values(learner,'Temporary fee currency rollback acceptance','2012-02-29',level_name,'Red',2098,'active',case when level_name like 'Form%' or level_name like '%Six' then 'senior' else 'junior' end);
    select total_fees into actual from public.fee_balances where student_id=learner and currency='USD';
    if actual is distinct from expected or (select count(*) from public.fee_balances where student_id=learner)<>1 then
      raise exception 'Admission fee assertion failed for %',level_name;
    end if;
  end loop;
end $$;
select true as six_class_band_admissions_passed, true as usd_schedule_selected;
rollback;
