-- All synthetic learner, balance, payment, expense and audit rows roll back.
begin;
do $$
declare learner uuid:=gen_random_uuid(); main_id uuid; balance_id uuid; expense_id uuid:=gen_random_uuid();
begin
 select id into main_id from public.profiles where active_role='admin' and campus='all' and portal_access_enabled is distinct from false limit 1;
 if main_id is null then raise exception 'Main Admin identity required'; end if;
 perform set_config('request.jwt.claim.sub',main_id::text,true);
 insert into public.students(id,full_name,date_of_birth,class_level,class_stream,enrolled_year,status,campus)
 values(learner,'Rollback finance audit learner','2012-02-29','Form 3','Blue',2098,'active','senior');
 select id into balance_id from public.fee_balances where student_id=learner limit 1;
 if balance_id is null then raise exception 'Admission fee balance missing'; end if;
 update public.fee_balances set notes='Audit rollback first edit' where id=balance_id;
 update public.fee_balances set notes='Audit rollback second edit' where id=balance_id;
 if (select count(*) from public.financial_events where module='fees' and action='fee_balances_update' and details->>'source_id'=balance_id::text)<>2 then raise exception 'Repeated balance edits not audited'; end if;
 if not exists(select 1 from public.financial_events where details->>'source_id'=balance_id::text and details->'after'->>'notes'='Audit rollback second edit' and details->'before'->>'notes'='Audit rollback first edit' and actor_id=main_id) then raise exception 'Before/after actor missing'; end if;
 insert into public.school_expenses(id,expense_date,category,description,amount,currency,payment_method,entered_by,campus)
 values(expense_id,current_date,'Audit verification','Rollback only',1,'USD','cash',main_id,'senior');
 if not exists(select 1 from public.financial_events where module='expenses' and details->>'source_id'=expense_id::text and campus='senior' and actor_id=main_id) then raise exception 'Expense audit missing'; end if;
 if has_table_privilege('authenticated','public.financial_events','INSERT') or has_table_privilege('authenticated','public.financial_events','UPDATE') or has_table_privilege('authenticated','public.financial_events','DELETE') then raise exception 'Client may mutate audit'; end if;
end $$;
select true as admission_still_works,true as repeated_edits_audited,true as before_after_actor_saved,true as expense_audited,true as client_audit_writes_denied;
rollback;
