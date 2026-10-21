begin;
-- Admissions continue to seed USD; separate ZWG accounts remain explicit.
create or replace function public.seed_fee_account_for_new_learner()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  current_term text := case when extract(month from current_date) <= 4 then 'Term 1' when extract(month from current_date) <= 8 then 'Term 2' else 'Term 3' end;
  band text := case
    when lower(new.class_level) like 'ecd%' then 'ECD A & B'
    when lower(new.class_level) like 'grade%' then 'Grade 1-7'
    when new.class_level in ('Form 1','Form 2') then 'Form 1-2'
    when new.class_level in ('Form 3','Form 4') then 'Form 3-4'
    when new.class_level in ('Form 5','Form 6','Lower Six','Upper Six') then 'Lower & Upper Six'
  end;
  fee_amount numeric(12,2);
begin
  select amount into fee_amount from public.fee_structure_mapping
    where band_name = band and currency = 'USD' limit 1;
  insert into public.fee_balances (student_id, term, academic_year, currency, total_fees, amount_paid, updated_at)
  values (new.id, current_term, extract(year from current_date)::integer, 'USD', coalesce(fee_amount, 0), 0, now())
  on conflict (student_id, term, academic_year, currency) do nothing;
  return new;
end;
$$;


-- Synthetic admissions and mapping changes are always rolled back.

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

