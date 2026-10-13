-- A payment is an append-only ledger entry. The balance is updated in the
-- same transaction so a finance user can never overwrite prior receipts.
create or replace function public.record_learner_fee_payment(
  p_student_id uuid, p_term text, p_academic_year integer, p_amount numeric,
  p_paid_on date, p_payment_method text, p_reference_number text,
  p_total_fees numeric default null
) returns public.fee_balances
language plpgsql security definer set search_path = public as $$
declare v_balance public.fee_balances; v_campus text; v_plan text;
begin
  select campus into v_campus from public.students where id = p_student_id;
  if v_campus is null or not (public.accountant_can_access_campus(v_campus) or public.can_manage_student_record(p_student_id)) then raise exception 'You cannot record payments for this learner'; end if;
  if p_amount is null or p_amount <= 0 or p_amount::text in ('NaN','Infinity','-Infinity') then raise exception 'Enter an amount received greater than zero'; end if;
  if p_payment_method not in ('cash','ecocash','swipe','transfer','bank_deposit') then raise exception 'Choose a valid payment method'; end if;
  select * into v_balance from public.fee_balances where student_id=p_student_id and term=p_term and academic_year=p_academic_year for update;
  if not found then
    if p_total_fees is null or p_total_fees < 0 then raise exception 'A valid term fee is required before recording the first payment'; end if;
    insert into public.fee_balances(student_id,term,academic_year,total_fees,amount_paid,payment_date,updated_by,updated_at)
    values(p_student_id,p_term,p_academic_year,p_total_fees,p_amount,p_paid_on,auth.uid(),now()) returning * into v_balance;
  else
    update public.fee_balances set amount_paid=amount_paid+p_amount,payment_date=p_paid_on,updated_by=auth.uid(),updated_at=now() where id=v_balance.id returning * into v_balance;
  end if;
  v_plan := case when v_balance.amount_paid < v_balance.total_fees then 'instalment' else 'once_off' end;
  insert into public.fee_payments(fee_balance_id,student_id,term,academic_year,amount,paid_on,payment_method,payment_plan,reference_number,received_by)
  values(v_balance.id,p_student_id,p_term,p_academic_year,p_amount,p_paid_on,p_payment_method,v_plan,nullif(trim(p_reference_number),''),auth.uid());
  return v_balance;
end; $$;
revoke all on function public.record_learner_fee_payment(uuid,text,integer,numeric,date,text,text,numeric) from public;
grant execute on function public.record_learner_fee_payment(uuid,text,integer,numeric,date,text,text,numeric) to authenticated;
