begin;

create table public.fee_payment_requests (
 request_id uuid primary key,
 actor_id uuid not null,
 fee_balance_id uuid not null references public.fee_balances(id),
 payload jsonb not null,
 created_at timestamptz not null default now()
);
alter table public.fee_payment_requests enable row level security;
revoke all on public.fee_payment_requests from public,anon,authenticated;

create function public.record_learner_fee_payment(
 p_student_id uuid,p_term text,p_academic_year integer,p_amount numeric,
 p_paid_on date,p_payment_method text,p_reference_number text,p_currency text,
 p_request_id uuid,p_total_fees numeric default null
) returns public.fee_balances
language plpgsql security definer set search_path=public as $$
declare request_payload jsonb; previous public.fee_payment_requests;
 result public.fee_balances; learner_campus text;
begin
 select campus into learner_campus from public.students where id=p_student_id;
 if auth.uid() is null or not coalesce(public.accountant_can_access_campus(learner_campus) or public.can_manage_student_record(p_student_id),false)
 then raise exception 'You cannot record payments for this learner' using errcode='42501'; end if;
 if not coalesce(public.portal_mfa_satisfied(),false) then raise exception 'Complete required sign-in verification' using errcode='42501'; end if;
 if p_request_id is null then raise exception 'Payment request ID required'; end if;
 if p_currency is null or upper(p_currency) not in ('USD','ZWG') then raise exception 'Choose USD or ZWG'; end if;
 if p_amount is null or p_amount<=0 or p_amount::text in ('NaN','Infinity','-Infinity') or round(p_amount,2)<>p_amount then raise exception 'Enter a positive amount with at most two decimal places'; end if;
 if p_paid_on is null or p_term is null or p_term not in ('Term 1','Term 2','Term 3') or p_academic_year is null or p_academic_year not between 2000 and 2200 then raise exception 'Choose a valid term, year and payment date'; end if;
 if length(coalesce(p_reference_number,''))>200 then raise exception 'Reference must be no longer than 200 characters'; end if;
 request_payload:=jsonb_build_object('student_id',p_student_id,'term',p_term,'year',p_academic_year,'amount',p_amount,'paid_on',p_paid_on,'method',p_payment_method,'reference',nullif(trim(p_reference_number),''),'currency',upper(p_currency),'total_fees',p_total_fees);
 perform pg_advisory_xact_lock(hashtextextended('fee-payment-request:'||p_request_id::text,0));
 select * into previous from public.fee_payment_requests where request_id=p_request_id;
 if found then
  if previous.actor_id<>auth.uid() or previous.payload is distinct from request_payload then raise exception 'Payment request already belongs to a different submission' using errcode='22023'; end if;
  select * into result from public.fee_balances where id=previous.fee_balance_id;
  return result;
 end if;
 -- Serialize first-account creation as well as increments for this ledger.
 perform pg_advisory_xact_lock(hashtextextended('fee-account:'||p_student_id::text||':'||p_term||':'||p_academic_year::text||':'||upper(p_currency),0));
 select * into result from public.record_learner_fee_payment(p_student_id,p_term,p_academic_year,p_amount,p_paid_on,p_payment_method,p_reference_number,p_currency,p_total_fees);
 insert into public.fee_payment_requests(request_id,actor_id,fee_balance_id,payload)
 values(p_request_id,auth.uid(),result.id,request_payload);
 return result;
end $$;
revoke all on function public.record_learner_fee_payment(uuid,text,integer,numeric,date,text,text,text,uuid,numeric) from public,anon;
grant execute on function public.record_learner_fee_payment(uuid,text,integer,numeric,date,text,text,text,uuid,numeric) to authenticated;

do $$
declare learner uuid:=gen_random_uuid(); main_id uuid; request_id uuid:=gen_random_uuid(); balance public.fee_balances; again public.fee_balances;
begin
 select id into main_id from public.profiles where active_role='admin' and campus='all' and portal_access_enabled is distinct from false limit 1;
 if main_id is null then raise exception 'Main Admin identity required'; end if;
 insert into public.students(id,full_name,date_of_birth,class_level,class_stream,enrolled_year,status,campus)
 values(learner,'Rollback retry learner','2012-02-29','Form 3','Blue',2098,'active','senior');
 perform set_config('request.jwt.claim.sub',main_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',main_id,'role','authenticated','aal','aal1')::text,true);
 set local role authenticated;
 select * into balance from public.record_learner_fee_payment(learner,'Term 1',2098,20,current_date,'cash',null,'USD',request_id,100);
 select * into again from public.record_learner_fee_payment(learner,'Term 1',2098,20,current_date,'cash',null,'USD',request_id,100);
 if balance.id<>again.id or again.amount_paid<>20 then raise exception 'Retry duplicated balance'; end if;
 begin
  perform public.record_learner_fee_payment(learner,'Term 1',2098,21,current_date,'cash',null,'USD',request_id,100);
  raise exception 'Changed submission accepted';
 exception when invalid_parameter_value then null; end;
 reset role;
 if (select count(*) from public.fee_payments where fee_balance_id=balance.id)<>1 then raise exception 'Duplicate ledger payment'; end if;
 if (select count(*) from public.financial_events where module='fees' and action='fee_payments_insert' and details->'after'->>'fee_balance_id'=balance.id::text)<>1 then raise exception 'Duplicate audit payment'; end if;
 if has_table_privilege('authenticated','public.fee_payment_requests','SELECT') or has_table_privilege('authenticated','public.fee_payment_requests','INSERT') then raise exception 'Request ledger accessible directly'; end if;
end $$;
select true as retry_applied_once,true as one_payment_and_audit,true as altered_retry_denied,true as private_request_ledger;
rollback;
