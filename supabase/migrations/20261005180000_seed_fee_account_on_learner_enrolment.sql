-- Every new learner receives a current-term fee account at enrolment. This
-- applies equally to admin, teacher, and accountant enrolment workflows.
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
  select amount into fee_amount from public.fee_structure_mapping where band_name = band limit 1;
  insert into public.fee_balances (student_id, term, academic_year, total_fees, amount_paid, updated_at)
  values (new.id, current_term, extract(year from current_date)::integer, coalesce(fee_amount, 0), 0, now())
  on conflict (student_id, term, academic_year) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_seed_fee_account_on_learner_enrolment on public.students;
create trigger trg_seed_fee_account_on_learner_enrolment
after insert on public.students
for each row execute function public.seed_fee_account_for_new_learner();
