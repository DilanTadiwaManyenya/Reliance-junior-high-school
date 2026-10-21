import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { buildReconciliationEntries, summarizeReconciliationEntries } from '../src/lib/financeReconciliation.js'
import { reportTotals, reportSheets } from '../src/lib/operationsExport.js'

test('reversed fee payments remain exported but are excluded from collections', () => {
 const payments=[{id:'original',amount:20,currency:'USD',paid_on:'2026-10-21',status:'reversed',reversal_reason:'Wrong learner'}, {id:'active',amount:10,currency:'USD',paid_on:'2026-10-21'}]
 const entries=buildReconciliationEntries({feePayments:payments})
 assert.equal(summarizeReconciliationEntries(entries).USD.collected,10)
 assert.equal(reportTotals('payments',payments)['Ledger payments USD'],'10.00')
 const rows=reportSheets('payments',payments)[0].rows
 assert.equal(rows.length,3)
 assert.equal(rows[1][rows[0].indexOf('Status')],'reversed')
 assert.equal(rows[1][rows[0].indexOf('Reversal reason')],'Wrong learner')
})

test('fee reversal is Main Admin only, atomic, preserves originals and cannot subtract twice',async()=>{
 const db=new PGlite()
 try {
 await db.exec(`create schema auth; create role authenticated; create role anon;
 create function auth.uid() returns uuid language sql as $$ select '00000000-0000-0000-0000-000000000001'::uuid $$;
 create function is_main_school_admin() returns boolean language sql as $$ select current_setting('test.role',true)='main' $$;
 create function portal_mfa_satisfied() returns boolean language sql as $$ select current_setting('test.mfa',true)='yes' $$;
 create table profiles(id uuid primary key,full_name text,active_role text,role text);
 insert into profiles values(auth.uid(),'Main Admin','admin','admin');
 create table students(id uuid primary key,campus text);
 insert into students values('00000000-0000-0000-0000-000000000002','senior');
 create table fee_balances(id uuid primary key,student_id uuid,currency text,term text,academic_year integer,amount_paid numeric,payment_date date,updated_by uuid,updated_at timestamptz);
 insert into fee_balances values('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002','USD','Term 3',2026,0,null,null,null);
 create table fee_payments(id uuid primary key default gen_random_uuid(),fee_balance_id uuid,student_id uuid,currency text,term text,academic_year integer,amount numeric,paid_on date,payment_method text,received_by uuid,reference_number text);
 create table fee_payment_requests(request_id uuid primary key,fee_balance_id uuid);
 create table financial_events(module text,action text,record_id uuid,campus text,currency text,actor_id uuid,actor_name text,actor_role text,reason text,details jsonb);
 grant select,insert,update,delete on fee_payments to authenticated;
 create function record_learner_fee_payment(uuid,text,integer,numeric,date,text,text,text,uuid,numeric) returns fee_balances language plpgsql security definer as $$ declare r fee_balances; begin
 if exists(select 1 from fee_payment_requests where request_id=$9) then select * into r from fee_balances; return r; end if;
 update fee_balances set amount_paid=amount_paid+$4,payment_date=$5 returning * into r;
 insert into fee_payments(fee_balance_id,student_id,currency,term,academic_year,amount,paid_on,payment_method,received_by,reference_number) values(r.id,$1,$8,$2,$3,$4,$5,$6,auth.uid(),$7);
 insert into fee_payment_requests values($9,r.id); return r; end $$;
 select set_config('test.role','main',false); select set_config('test.mfa','yes',false);`)
 await db.exec(await readFile(new URL('../supabase/migrations/20261021233000_main_admin_fee_reversals.sql',import.meta.url),'utf8'))
 const request='00000000-0000-0000-0000-000000000004'
 const collect=(requestId=request)=>db.query(`select * from record_learner_fee_payment('00000000-0000-0000-0000-000000000002','Term 3',2026,20,current_date,'cash',null,'USD',$1::uuid,100)`,[requestId])
 await collect()
 const payment=(await db.query('select * from fee_payments')).rows[0]
 assert.equal(payment.collection_request_id,request)
 const reverse=()=>db.query(`select * from reverse_learner_fee_payment($1,'Wrong learner selected')`,[payment.id])
 for(const role of ['accountant','campus-admin','teacher','parent','principal']) {
  await db.query(`select set_config('test.role',$1,false)`,[role])
  await assert.rejects(reverse(),/Only Main Admin/)
 }
 await db.exec(`select set_config('test.role','main',false); select set_config('test.mfa','no',false)`)
 await assert.rejects(reverse(),/sign-in verification/)
 await db.exec(`select set_config('test.mfa','yes',false);
 create function fail_audit() returns trigger language plpgsql as $$ begin raise exception 'audit unavailable'; end $$;
 create trigger fail_audit before insert on financial_events for each row execute function fail_audit();`)
 await assert.rejects(reverse(),/audit unavailable/)
 assert.equal((await db.query('select amount_paid from fee_balances')).rows[0].amount_paid,'20')
 assert.equal((await db.query('select status from fee_payments')).rows[0].status,'recorded')
 await db.exec('drop trigger fail_audit on financial_events')
 assert.equal((await reverse()).rows[0].status,'reversed')
 await reverse()
 assert.equal((await db.query('select amount_paid from fee_balances')).rows[0].amount_paid,'0')
 assert.equal((await db.query('select count(*) from financial_events')).rows[0].count,1)
 assert.equal((await db.query('select amount from fee_payments')).rows[0].amount,'20')
 await assert.rejects(collect(),/was reversed/)
 await collect('00000000-0000-0000-0000-000000000005')
 const second=(await db.query("select * from fee_payments where status='recorded'")).rows[0]
 await db.exec('update fee_balances set amount_paid=0')
 await assert.rejects(db.query("select * from reverse_learner_fee_payment($1,'Wrong amount entered')",[second.id]),/do not reconcile/)
 await db.exec("update fee_balances set amount_paid=20; update fee_payments set payment_method='recorded' where status='recorded'")
 await assert.rejects(db.query("select * from reverse_learner_fee_payment($1,'Wrong amount entered')",[second.id]),/Legacy opening balance/)
 await db.exec('set role authenticated')
 await assert.rejects(db.exec('update fee_payments set amount=999'),/permission denied/)
 await assert.rejects(db.exec('delete from fee_payments'),/permission denied/)
 await assert.rejects(db.exec('insert into fee_payments(amount) values(10)'),/permission denied/)
 } finally { await db.close() }
})
