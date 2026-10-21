begin;

-- Append events in the same transaction as each change. No fabricated backfill.
-- A fresh event record_id permits repeated edits; details retains the source ID.
create function public.audit_fee_expense_event() returns trigger
language plpgsql security definer set search_path=public as $$
declare before_row jsonb; after_row jsonb; source_row jsonb;
 actor_name text; actor_role text; event_campus text;
begin
 if tg_op <> 'INSERT' then before_row:=to_jsonb(old); end if;
 if tg_op <> 'DELETE' then after_row:=to_jsonb(new); end if;
 if tg_op='UPDATE' and before_row=after_row then return new; end if;
 source_row:=coalesce(after_row,before_row);
 if tg_table_name='school_expenses' then event_campus:=source_row->>'campus';
 else select campus into event_campus from public.students where id=(source_row->>'student_id')::uuid; end if;
 select p.full_name,coalesce(p.active_role,p.role) into actor_name,actor_role
 from public.profiles p where p.id=auth.uid();
 insert into public.financial_events(module,action,record_id,campus,currency,actor_id,actor_name,actor_role,details)
 values(case when tg_table_name='school_expenses' then 'expenses' else 'fees' end,
 tg_table_name||'_'||lower(tg_op),gen_random_uuid(),
 case when event_campus in ('junior','senior') then event_campus end,
 source_row->>'currency',auth.uid(),coalesce(actor_name,'Database operation'),coalesce(actor_role,'system'),
 jsonb_build_object('table',tg_table_name,'source_id',source_row->>'id',
 'before',before_row,'after',after_row,
 'actor_source',case when auth.uid() is null then 'database' else 'authenticated session' end));
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
revoke all on function public.audit_fee_expense_event() from public,anon,authenticated;
create trigger fee_payment_financial_event after insert or update or delete on public.fee_payments
 for each row execute function public.audit_fee_expense_event();
create trigger fee_balance_financial_event after insert or update or delete on public.fee_balances
 for each row execute function public.audit_fee_expense_event();
create trigger expense_financial_event after insert or update or delete on public.school_expenses
 for each row execute function public.audit_fee_expense_event();

create policy "Campus finance staff read fee expense events" on public.financial_events
 for select to authenticated using (
 module in ('fees','expenses') and
 (public.is_main_school_admin() or public.accountant_can_access_campus(campus))
 );
-- All synthetic learner, balance, payment, expense and audit rows roll back.

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
