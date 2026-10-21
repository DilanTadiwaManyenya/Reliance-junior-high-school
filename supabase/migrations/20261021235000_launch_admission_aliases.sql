begin;
create or replace function public.admission_class_code(student_campus text,student_class_level text)
returns text language sql immutable as $$
 select case
 when lower(trim(student_class_level)) in ('form 5','lower six','lower 6') then 'f5'
 when lower(trim(student_class_level)) in ('form 6','upper six','upper 6') then 'f6'
 when lower(trim(student_class_level)) ~ '^form [1-4]$' then 'f'||regexp_replace(student_class_level,'\D','','g')
 when lower(trim(student_class_level)) ~ '^grade [1-7]$' then 'g'||regexp_replace(student_class_level,'\D','','g')
 when lower(trim(student_class_level))='ecd a' then 'eA'
 when lower(trim(student_class_level))='ecd b' then 'eB'
 else 'x0' end;
$$;
create or replace function public.next_admission_number(requested_year integer,requested_campus text,requested_class_level text)
returns text language plpgsql security definer set search_path=public as $$
declare class_code text:=public.admission_class_code(requested_campus,requested_class_level); next_sequence integer;
begin
 -- Admission numbers are globally unique. Every alias emitting the same
 -- prefix must lock and inspect the same namespace, not its display label.
 perform pg_advisory_xact_lock(hashtext(requested_year::text||':'||class_code));
 select coalesce(max(right(admission_number,2)::integer),-1)+1 into next_sequence
 from public.students where admission_number ~ ('^'||right(requested_year::text,2)||class_code||'[0-9]{2}$');
 if next_sequence>99 then raise exception 'Admission sequence is full for % %',requested_year,requested_class_level; end if;
 return right(requested_year::text,2)||class_code||lpad(next_sequence::text,2,'0');
end $$;
create or replace function public.seed_fee_account_for_new_learner()
returns trigger language plpgsql security definer set search_path=public as $$
declare current_term text:='Term '||least(3,greatest(1,ceil(extract(month from current_date)/4.0)::integer))::text;
 band text:=case when new.class_level in ('ECD A','ECD B') then 'ECD'
 when lower(new.class_level) like 'grade%' then 'Grade 1-7'
 when new.class_level in ('Form 1','Form 2') then 'Form 1-2'
 when new.class_level in ('Form 3','Form 4') then 'Form 3-4'
 when new.class_level in ('Form 5','Form 6','Lower Six','Upper Six','Lower 6','Upper 6') then 'Lower & Upper Six' end;
 fee_amount numeric(12,2);
begin
 select amount into fee_amount from public.fee_structure_mapping where band_name=band and currency='USD' limit 1;
 insert into public.fee_balances(student_id,term,academic_year,currency,total_fees,amount_paid,updated_at)
 values(new.id,current_term,extract(year from current_date)::integer,'USD',coalesce(fee_amount,0),0,now())
 on conflict(student_id,term,academic_year,currency) do nothing;
 return new;
end $$;
commit;
