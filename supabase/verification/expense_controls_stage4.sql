-- No real school expense is changed. Synthetic entries, audit rows and trigger roll back.
begin;
create function public.verify_expense_reversal_failure() returns trigger language plpgsql as $$
begin
 if new.module='expenses' and new.action='expense_reversed' then raise exception 'Synthetic expense audit failure'; end if;
 return new;
end $$;
do $$
declare main_id uuid; cashier uuid; request_id uuid:=gen_random_uuid(); payload jsonb;
 expense public.school_expenses; retried public.school_expenses; original_approval timestamptz; identity_row record;
begin
 select id into main_id from public.profiles where active_role='admin' and campus='all' and portal_access_enabled is distinct from false limit 1;
 select id into cashier from public.profiles where active_role='accountant' and campus='senior' and portal_access_enabled is distinct from false limit 1;
 if main_id is null or cashier is null then raise exception 'Main Admin and Senior accountant identities required'; end if;
 payload:=jsonb_build_object('campus','senior','currency','USD','amount',1,'expense_date',current_date,'category','Verification','description','Rollback expense only','payment_method','cash','status','approved','entered_by',main_id);
 perform set_config('request.jwt.claim.sub',cashier::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',cashier,'role','authenticated','aal','aal1')::text,true);
 set local role authenticated;
 select * into expense from public.submit_school_expense(request_id,payload);
 select * into retried from public.submit_school_expense(request_id,payload);
 if expense.id<>retried.id or expense.status<>'pending' or expense.entered_by<>cashier then raise exception 'Submission duplicate or forged state accepted'; end if;
 begin
  perform public.submit_school_expense(request_id,payload||jsonb_build_object('amount',2));
  raise exception 'Changed submission accepted' using errcode='XX000';
 exception when invalid_parameter_value then null; end;
 begin
  perform public.submit_school_expense(gen_random_uuid(),payload||jsonb_build_object('campus','junior'));
  raise exception 'Cross-campus submission accepted' using errcode='XX000';
 exception when insufficient_privilege then null; end;
 reset role;
 for identity_row in select distinct on(active_role,campus) id,active_role,campus from public.profiles
 where portal_access_enabled is distinct from false and (active_role in ('teacher','parent','accountant','principal') or (active_role='admin' and campus in ('junior','senior'))) loop
  perform set_config('request.jwt.claim.sub',identity_row.id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',identity_row.id,'role','authenticated','aal','aal1')::text,true);
  set local role authenticated;
  begin
   perform public.reverse_school_expense(expense.id,'Rollback unauthorized expense');
   raise exception 'Unauthorized reversal accepted' using errcode='XX000';
  exception when insufficient_privilege then null; end;
  begin
   perform public.review_school_expense(expense.id,'approved');
   raise exception 'Unauthorized approval accepted' using errcode='XX000';
  exception when insufficient_privilege then null; end;
  reset role;
 end loop;
 perform set_config('request.jwt.claim.sub',main_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',main_id,'role','authenticated','aal','aal1')::text,true);
 set local role authenticated;
 perform public.review_school_expense(expense.id,'approved');
 perform public.review_school_expense(expense.id,'approved');
 select approved_at into original_approval from public.school_expenses where id=expense.id;
 reset role;
 create trigger verify_expense_failure before insert on public.financial_events for each row execute function public.verify_expense_reversal_failure();
 set local role authenticated;
 begin
  perform public.reverse_school_expense(expense.id,'Rollback expense audit failure');
  raise exception 'Audit failure did not abort reversal' using errcode='XX000';
 exception when raise_exception then if sqlerrm<>'Synthetic expense audit failure' then raise; end if; end;
 reset role;
 if (select status from public.school_expenses where id=expense.id)<>'approved' then raise exception 'Audit failure did not restore approval'; end if;
 drop trigger verify_expense_failure on public.financial_events;
 set local role authenticated;
 select * into expense from public.reverse_school_expense(expense.id,'Rollback wrong supplier entry');
 perform public.reverse_school_expense(expense.id,'Rollback repeat same correction');
 begin
  perform public.review_school_expense(expense.id,'approved');
  raise exception 'Reversed expense was approved' using errcode='XX000';
 exception when raise_exception then if sqlerrm<>'Expense is no longer awaiting approval' then raise; end if; end;
 reset role;
 perform set_config('request.jwt.claim.sub',cashier::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',cashier,'role','authenticated','aal','aal1')::text,true);
 set local role authenticated;
 select * into retried from public.submit_school_expense(request_id,payload);
 reset role;
 if expense.status<>'reversed' or retried.id<>expense.id or retried.status<>'reversed' or expense.amount<>1 or expense.entered_by<>cashier or expense.approved_by<>main_id or expense.approved_at is distinct from original_approval then raise exception 'Original history or reversed replay lost'; end if;
 if (select count(*) from public.financial_events where module='expenses' and action='expense_reversed' and record_id=expense.id)<>1 then raise exception 'Repeated reversal audit'; end if;
 if (select count(*) from public.financial_events where module='expenses' and action='school_expenses_insert' and details->>'source_id'=expense.id::text)<>1 then raise exception 'Repeated submission audit'; end if;
 if has_table_privilege('authenticated','public.school_expenses','INSERT') or has_table_privilege('authenticated','public.school_expenses','UPDATE') or has_table_privilege('authenticated','public.school_expenses','DELETE') or has_table_privilege('authenticated','public.expense_submission_requests','SELECT') then raise exception 'Direct expense/request access allowed'; end if;
end $$;
select true as campus_submission_enforced,true as retry_creates_one_pending_entry,true as main_admin_only_corrections,
 true as reversal_atomic_and_once,true as original_approval_preserved,true as client_mutations_denied;
rollback;
