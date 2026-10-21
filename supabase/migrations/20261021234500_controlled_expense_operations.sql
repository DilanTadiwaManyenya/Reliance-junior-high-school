begin;
alter table public.school_expenses drop constraint school_expenses_status_check;
alter table public.school_expenses add constraint school_expenses_status_check check(status in ('pending','approved','rejected','reversed'));
alter table public.school_expenses add column reversed_at timestamptz;
alter table public.school_expenses add column reversed_by uuid references public.profiles(id);
alter table public.school_expenses add column reversal_reason text;
alter table public.school_expenses add constraint expense_reversal_state check (
 (status<>'reversed' and reversed_at is null and reversed_by is null and reversal_reason is null) or
 (status='reversed' and reversed_at is not null and reversed_by is not null and reversal_reason is not null and length(btrim(reversal_reason)) between 5 and 1000)
);
create table public.expense_submission_requests (
 request_id uuid primary key,actor_id uuid not null,expense_id uuid not null references public.school_expenses(id),
 payload jsonb not null,created_at timestamptz not null default now()
);
alter table public.expense_submission_requests enable row level security;
revoke all on public.expense_submission_requests from public,anon,authenticated;

create function public.submit_school_expense(p_request_id uuid,p_expense jsonb)
returns public.school_expenses language plpgsql security definer set search_path=public as $$
declare payload jsonb; previous public.expense_submission_requests; result public.school_expenses;
 amount numeric; expense_day date; selected_campus text; selected_currency text;
begin
 selected_campus:=p_expense->>'campus'; selected_currency:=upper(p_expense->>'currency');
 if auth.uid() is null or not coalesce(public.is_main_school_admin() or public.accountant_can_access_campus(selected_campus),false) then
 raise exception 'Only Main Admin or the assigned campus accountant can submit expenses' using errcode='42501'; end if;
 if not coalesce(public.portal_mfa_satisfied(),false) then raise exception 'Complete required sign-in verification' using errcode='42501'; end if;
 if p_request_id is null then raise exception 'Expense request ID required'; end if;
 if selected_campus is null or selected_campus not in ('junior','senior') then raise exception 'Choose Junior or Senior campus'; end if;
 if selected_currency is null or selected_currency not in ('USD','ZWG') then raise exception 'Choose USD or ZWG'; end if;
 begin amount:=(p_expense->>'amount')::numeric; expense_day:=(p_expense->>'expense_date')::date;
 exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range then raise exception 'Enter a valid expense amount and date'; end;
 if amount is null or amount<=0 or amount::text in ('NaN','Infinity','-Infinity') or round(amount,2)<>amount or amount>9999999999.99 then raise exception 'Enter a positive expense amount with at most two decimal places'; end if;
 if expense_day is null then raise exception 'Choose an expense date'; end if;
 if coalesce(length(btrim(p_expense->>'category')),0) not between 1 and 100
 or coalesce(length(btrim(p_expense->>'description')),0) not between 1 and 2000 then raise exception 'Enter an expense category and description'; end if;
 if p_expense->>'payment_method' is null or p_expense->>'payment_method' not in ('cash','ecocash','swipe','transfer') then raise exception 'Choose a valid payment method'; end if;
 if length(coalesce(p_expense->>'supplier',''))>200 or length(coalesce(p_expense->>'receipt_reference',''))>200 then raise exception 'Supplier and reference must be no longer than 200 characters'; end if;
 payload:=jsonb_build_object('campus',selected_campus,'currency',selected_currency,'amount',amount,'expense_date',expense_day,
 'category',btrim(p_expense->>'category'),'description',btrim(p_expense->>'description'),'payment_method',p_expense->>'payment_method',
 'supplier',nullif(btrim(p_expense->>'supplier'),''),'receipt_reference',nullif(btrim(p_expense->>'receipt_reference'),''));
 perform pg_advisory_xact_lock(hashtextextended('expense-submission:'||p_request_id::text,0));
 select * into previous from public.expense_submission_requests where request_id=p_request_id;
 if found then
  if previous.actor_id<>auth.uid() or previous.payload is distinct from payload then raise exception 'Expense request belongs to a different submission' using errcode='22023'; end if;
  select * into result from public.school_expenses where id=previous.expense_id;
  return result;
 end if;
 insert into public.school_expenses(expense_date,category,supplier,description,amount,currency,payment_method,receipt_reference,status,entered_by,campus)
 values(expense_day,payload->>'category',payload->>'supplier',payload->>'description',amount,selected_currency,payload->>'payment_method',payload->>'receipt_reference','pending',auth.uid(),selected_campus)
 returning * into result;
 insert into public.expense_submission_requests(request_id,actor_id,expense_id,payload) values(p_request_id,auth.uid(),result.id,payload);
 return result;
end $$;
revoke all on function public.submit_school_expense(uuid,jsonb) from public,anon;
grant execute on function public.submit_school_expense(uuid,jsonb) to authenticated;

create or replace function public.review_school_expense(p_expense_id uuid,p_status text)
returns void language plpgsql security definer set search_path=public as $$
declare expense public.school_expenses;
begin
 if auth.uid() is null or not coalesce(public.is_main_school_admin(),false) then raise exception 'Main Admin approval required' using errcode='42501'; end if;
 if not coalesce(public.portal_mfa_satisfied(),false) then raise exception 'Complete required sign-in verification' using errcode='42501'; end if;
 if p_status is null or p_status not in ('approved','rejected') then raise exception 'Choose approved or rejected'; end if;
 select * into expense from public.school_expenses where id=p_expense_id for update;
 if not found then raise exception 'Expense not found'; end if;
 if expense.status=p_status then return; end if;
 if expense.status<>'pending' then raise exception 'Expense is no longer awaiting approval'; end if;
 update public.school_expenses set status=p_status,approved_by=auth.uid(),approved_at=now() where id=p_expense_id;
end $$;
revoke all on function public.review_school_expense(uuid,text) from public,anon;
grant execute on function public.review_school_expense(uuid,text) to authenticated;

create function public.reverse_school_expense(p_expense_id uuid,p_reason text)
returns public.school_expenses language plpgsql security definer set search_path=public as $$
declare expense public.school_expenses; original public.school_expenses;
begin
 if auth.uid() is null or not coalesce(public.is_main_school_admin(),false) then raise exception 'Only Main Admin can reverse an expense' using errcode='42501'; end if;
 if not coalesce(public.portal_mfa_satisfied(),false) then raise exception 'Complete required sign-in verification' using errcode='42501'; end if;
 if p_reason is null or length(btrim(p_reason)) not between 5 and 1000 then raise exception 'Enter a reason of 5 to 1000 characters'; end if;
 select * into expense from public.school_expenses where id=p_expense_id for update;
 if not found then raise exception 'Expense not found'; end if;
 if expense.status='reversed' then return expense; end if;
 original:=expense;
 update public.school_expenses set status='reversed',reversed_at=now(),reversed_by=auth.uid(),reversal_reason=btrim(p_reason)
 where id=p_expense_id returning * into expense;
 insert into public.financial_events(module,action,record_id,campus,currency,actor_id,actor_name,actor_role,reason,details)
 select 'expenses','expense_reversed',expense.id,expense.campus,expense.currency,auth.uid(),p.full_name,coalesce(p.active_role,p.role),expense.reversal_reason,
 jsonb_build_object('before',to_jsonb(original),'after',to_jsonb(expense),'settlement','Ledger correction only; no cash is refunded or transferred')
 from public.profiles p where p.id=auth.uid();
 if not found then raise exception 'Authenticated financial actor required'; end if;
 return expense;
end $$;
revoke all on function public.reverse_school_expense(uuid,text) from public,anon;
grant execute on function public.reverse_school_expense(uuid,text) to authenticated;
revoke insert,update,delete on public.school_expenses from public,anon,authenticated;
commit;
