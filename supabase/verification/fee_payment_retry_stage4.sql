begin;
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
