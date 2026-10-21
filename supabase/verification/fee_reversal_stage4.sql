-- Synthetic records and temporary failure trigger all roll back.
begin;
create function public.verify_fee_reversal_audit_failure() returns trigger language plpgsql as $$
begin
 if new.module='fees' and new.action='payment_reversed' then raise exception 'Synthetic reversal audit failure'; end if;
 return new;
end $$;
do $$
declare learner uuid:=gen_random_uuid(); main_id uuid; request_id uuid:=gen_random_uuid();
 balance public.fee_balances; payment public.fee_payments; reversed public.fee_payments; identity_row record;
begin
 select id into main_id from public.profiles where active_role='admin' and campus='all' and portal_access_enabled is distinct from false limit 1;
 if main_id is null then raise exception 'Main Admin identity required'; end if;
 insert into public.students(id,full_name,date_of_birth,class_level,class_stream,enrolled_year,status,campus)
 values(learner,'Rollback fee reversal learner','2012-02-29','Form 3','Blue',2098,'active','senior');
 perform set_config('request.jwt.claim.sub',main_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',main_id,'role','authenticated','aal','aal1')::text,true);
 set local role authenticated;
 select * into balance from public.record_learner_fee_payment(learner,'Term 1',2098,20,current_date,'cash',null,'USD',request_id,100);
 select * into payment from public.fee_payments where fee_balance_id=balance.id;
 if payment.collection_request_id is distinct from request_id then raise exception 'Collection request not linked'; end if;
 reset role;
 for identity_row in select distinct on (active_role,campus) id,active_role,campus from public.profiles
 where portal_access_enabled is distinct from false and (active_role in ('teacher','parent','accountant','principal') or (active_role='admin' and campus in ('junior','senior'))) loop
  perform set_config('request.jwt.claim.sub',identity_row.id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',identity_row.id,'role','authenticated','aal','aal1')::text,true);
  set local role authenticated;
  begin
   perform public.reverse_learner_fee_payment(payment.id,'Rollback unauthorized attempt');
   raise exception 'Unauthorized reversal accepted' using errcode='XX000';
  exception when insufficient_privilege then null; end;
  reset role;
 end loop;
 perform set_config('request.jwt.claim.sub',main_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',main_id,'role','authenticated','aal','aal1')::text,true);
 create trigger verify_fee_reversal_failure before insert on public.financial_events
 for each row execute function public.verify_fee_reversal_audit_failure();
 set local role authenticated;
 begin
  perform public.reverse_learner_fee_payment(payment.id,'Rollback audit failure test');
  raise exception 'Audit failure did not abort reversal' using errcode='XX000';
 exception when raise_exception then
  if sqlerrm<>'Synthetic reversal audit failure' then raise; end if;
 end;
 reset role;
 if (select amount_paid from public.fee_balances where id=balance.id)<>20 or (select status from public.fee_payments where id=payment.id)<>'recorded' then raise exception 'Audit failure did not restore state'; end if;
 drop trigger verify_fee_reversal_failure on public.financial_events;
 set local role authenticated;
 select * into reversed from public.reverse_learner_fee_payment(payment.id,'Rollback wrong learner payment');
 perform public.reverse_learner_fee_payment(payment.id,'Rollback repeat same reversal');
 begin
  perform public.record_learner_fee_payment(learner,'Term 1',2098,20,current_date,'cash',null,'USD',request_id,100);
  raise exception 'Reversed collection replay reported success' using errcode='XX000';
 exception when raise_exception then
  if sqlerrm not like 'A matching payment was reversed%' then raise; end if;
 end;
 reset role;
 if reversed.status<>'reversed' or reversed.amount<>20 or reversed.reversed_by<>main_id
 or (select amount_paid from public.fee_balances where id=balance.id)<>0 then raise exception 'Reversal balance or original receipt incorrect'; end if;
 if (select count(*) from public.financial_events where module='fees' and action='payment_reversed' and record_id=payment.id)<>1 then raise exception 'Repeated reversal audit'; end if;
 if has_table_privilege('authenticated','public.fee_payments','INSERT') or has_table_privilege('authenticated','public.fee_payments','UPDATE') or has_table_privilege('authenticated','public.fee_payments','DELETE') then raise exception 'Direct payment mutation allowed'; end if;
end $$;
select true as main_admin_only,true as balance_reversed_once,true as original_payment_preserved,
 true as audit_failure_rolls_back,true as replay_after_reversal_blocked,true as direct_payment_writes_denied;
rollback;
