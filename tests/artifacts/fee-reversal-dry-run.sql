begin;

alter table public.fee_payments add column status text not null default 'recorded';
alter table public.fee_payments add column reversed_at timestamptz;
alter table public.fee_payments add column reversed_by uuid references public.profiles(id);
alter table public.fee_payments add column reversal_reason text;
alter table public.fee_payments add constraint fee_payment_reversal_state check (
 (status='recorded' and reversed_at is null and reversed_by is null and reversal_reason is null) or
 (status='reversed' and reversed_at is not null and reversed_by is not null and length(btrim(reversal_reason)) between 5 and 1000 and reversal_reason is not null)
);
-- Every active portal payment writer uses the atomic RPC, including legacy
-- signatures. Remove direct client mutation of the append-only payment ledger.
revoke insert,update,delete on public.fee_payments from public,anon,authenticated;

-- Link future UUID submissions to their original ledger row. Old receipts are
-- not guessed or backfilled. The trigger is not callable by clients.
alter table public.fee_payments add column collection_request_id uuid unique;
create function public.tag_fee_collection_request() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 new.collection_request_id:=nullif(current_setting('app.fee_collection_request',true),'')::uuid;
 return new;
end $$;
revoke all on function public.tag_fee_collection_request() from public,anon,authenticated;
create trigger tag_fee_collection_request before insert on public.fee_payments
 for each row execute function public.tag_fee_collection_request();
alter function public.record_learner_fee_payment(uuid,text,integer,numeric,date,text,text,text,uuid,numeric)
 rename to record_learner_fee_payment_once;
revoke all on function public.record_learner_fee_payment_once(uuid,text,integer,numeric,date,text,text,text,uuid,numeric) from public,anon,authenticated;
create function public.record_learner_fee_payment(
 p_student_id uuid,p_term text,p_academic_year integer,p_amount numeric,p_paid_on date,
 p_payment_method text,p_reference_number text,p_currency text,p_request_id uuid,p_total_fees numeric default null
) returns public.fee_balances language plpgsql security definer set search_path=public as $$
declare result public.fee_balances; previous_context text; was_retry boolean;
begin
 was_retry:=exists(select 1 from public.fee_payment_requests where request_id=p_request_id);
 previous_context:=current_setting('app.fee_collection_request',true);
 perform set_config('app.fee_collection_request',p_request_id::text,true);
 select * into result from public.record_learner_fee_payment_once(p_student_id,p_term,p_academic_year,p_amount,p_paid_on,p_payment_method,p_reference_number,p_currency,p_request_id,p_total_fees);
 perform set_config('app.fee_collection_request',coalesce(previous_context,''),true);
 if exists(select 1 from public.fee_payments where status='reversed' and (
 collection_request_id=p_request_id or
 (was_retry and collection_request_id is null and fee_balance_id=result.id and amount=p_amount and paid_on=p_paid_on
 and payment_method=p_payment_method and received_by=auth.uid()
 and nullif(trim(reference_number),'') is not distinct from nullif(trim(p_reference_number),''))
 )) then raise exception 'A matching payment was reversed; reconcile its history before collecting again'; end if;
 return result;
end $$;
revoke all on function public.record_learner_fee_payment(uuid,text,integer,numeric,date,text,text,text,uuid,numeric) from public,anon;
grant execute on function public.record_learner_fee_payment(uuid,text,integer,numeric,date,text,text,text,uuid,numeric) to authenticated;

create function public.reverse_learner_fee_payment(p_payment_id uuid,p_reason text)
returns public.fee_payments language plpgsql security definer set search_path=public as $$
declare payment public.fee_payments; original public.fee_payments;
 balance public.fee_balances; original_balance public.fee_balances; learner_campus text;
begin
 if auth.uid() is null or not coalesce(public.is_main_school_admin(),false) then
  raise exception 'Only Main Admin can reverse a fee payment' using errcode='42501'; end if;
 if not coalesce(public.portal_mfa_satisfied(),false) then raise exception 'Complete required sign-in verification' using errcode='42501'; end if;
 if p_reason is null or length(btrim(p_reason)) not between 5 and 1000 then raise exception 'Enter a reason of 5 to 1000 characters'; end if;
 select * into payment from public.fee_payments where id=p_payment_id for update;
 if not found then raise exception 'Fee payment not found'; end if;
 if payment.status='reversed' then return payment; end if;
 if payment.payment_method='recorded' then raise exception 'Legacy opening balance requires separate review; it is not an individual cash receipt'; end if;
 select * into balance from public.fee_balances where id=payment.fee_balance_id for update;
 if not found or balance.student_id is distinct from payment.student_id or balance.currency is distinct from payment.currency
 or balance.term is distinct from payment.term or balance.academic_year is distinct from payment.academic_year
 or balance.amount_paid is null or balance.amount_paid::text in ('NaN','Infinity','-Infinity')
 or payment.amount is null or payment.amount<=0 or payment.amount::text in ('NaN','Infinity','-Infinity')
 or balance.amount_paid<payment.amount then
  raise exception 'Payment and balance do not reconcile; review the ledger before reversing'; end if;
 select campus into learner_campus from public.students where id=payment.student_id;
 if learner_campus is null or learner_campus not in ('junior','senior') then raise exception 'Learner campus requires review'; end if;
 original:=payment; original_balance:=balance;
 update public.fee_payments set status='reversed',reversed_at=now(),reversed_by=auth.uid(),reversal_reason=btrim(p_reason)
 where id=payment.id returning * into payment;
 update public.fee_balances set amount_paid=amount_paid-payment.amount,
 payment_date=(select max(paid_on) from public.fee_payments where fee_balance_id=balance.id and status='recorded'),
 updated_by=auth.uid(),updated_at=now() where id=balance.id returning * into balance;
 insert into public.financial_events(module,action,record_id,campus,currency,actor_id,actor_name,actor_role,reason,details)
 select 'fees','payment_reversed',payment.id,learner_campus,payment.currency,auth.uid(),p.full_name,coalesce(p.active_role,p.role),payment.reversal_reason,
 jsonb_build_object('before',to_jsonb(original),'after',to_jsonb(payment),'balance_before',to_jsonb(original_balance),'balance_after',to_jsonb(balance),'settlement','Ledger correction only; no money is refunded')
 from public.profiles p where p.id=auth.uid();
 if not found then raise exception 'Authenticated financial actor required'; end if;
 return payment;
end $$;
revoke all on function public.reverse_learner_fee_payment(uuid,text) from public,anon;
grant execute on function public.reverse_learner_fee_payment(uuid,text) to authenticated;
-- Synthetic records and temporary failure trigger all roll back.

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
