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
commit;
