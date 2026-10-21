import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { activeExpenseRows, expenseSubmissionKey, loadExpenseSubmission } from '../src/lib/expenseSubmission.js'
import { buildReconciliationEntries, summarizeReconciliationEntries } from '../src/lib/financeReconciliation.js'
import { reportTotals, reportSheets } from '../src/lib/operationsExport.js'

test('reversed expenses retain export history and leave spending totals',()=>{
 const rows=[{id:'old',currency:'USD',amount:25,status:'reversed',reversal_reason:'Wrong supplier',expense_date:'2026-10-21'}, {id:'active',currency:'USD',amount:10,status:'approved',expense_date:'2026-10-21'}, {id:'zwg',currency:'ZWG',amount:100,status:'approved',expense_date:'2026-10-21'}]
 assert.equal(activeExpenseRows(rows,'USD').length,1)
 assert.equal(summarizeReconciliationEntries(buildReconciliationEntries({expenses:rows})).USD.approvedExpenses,10)
 assert.equal(reportTotals('expenses',rows)['approved USD'],'10.00')
 const sheet=reportSheets('expenses',rows)[0].rows
 assert.equal(sheet[1][sheet[0].indexOf('Reversal reason')],'Wrong supplier')
 assert.equal(sheet.length,4)
 const key=expenseSubmissionKey('actor')
 assert.equal(loadExpenseSubmission({getItem:()=>null},key),null)
 assert.equal(loadExpenseSubmission({getItem:()=>'{broken'},key).invalid,true)
 assert.notEqual(key,expenseSubmissionKey('other-actor'))
})

test('expense operations enforce campus, Main Admin corrections, retry and atomic audits',async()=>{
 const db=new PGlite()
 const main='00000000-0000-0000-0000-000000000001', accountant='00000000-0000-0000-0000-000000000002'
 try {
 await db.exec(`create schema auth; create role authenticated; create role anon;
 create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.actor',true),'')::uuid $$;
 create function is_main_school_admin() returns boolean language sql as $$ select current_setting('test.role',true)='main' $$;
 create function accountant_can_access_campus(text) returns boolean language sql as $$ select current_setting('test.role',true)='accountant' and $1='senior' $$;
 create function portal_mfa_satisfied() returns boolean language sql as $$ select current_setting('test.mfa',true)='yes' $$;
 create table profiles(id uuid primary key,full_name text,active_role text,role text);
 insert into profiles values('${main}','Main Admin','admin','admin'),('${accountant}','Senior Accountant','accountant','accountant');
 create table students(id uuid,campus text); create table fee_balances(id uuid,student_id uuid,currency text); create table fee_payments(id uuid,student_id uuid,currency text);
 create table financial_events(module text,action text,record_id uuid,campus text,currency text,actor_id uuid,actor_name text,actor_role text,reason text,details jsonb,unique(module,action,record_id));
 alter table financial_events enable row level security;
 create table school_expenses(id uuid primary key default gen_random_uuid(),expense_date date,category text,supplier text,description text,amount numeric(12,2),currency text,payment_method text,receipt_reference text,status text not null default 'pending' check(status in ('pending','approved','rejected')),entered_by uuid,approved_by uuid,approved_at timestamptz,created_at timestamptz default now(),campus text);
 grant select,insert,update,delete on school_expenses to authenticated;
 select set_config('test.role','accountant',false);select set_config('test.actor','${accountant}',false);select set_config('test.mfa','yes',false);`)
 await db.exec(await readFile(new URL('../supabase/migrations/20261021220000_fee_expense_financial_audit.sql',import.meta.url),'utf8'))
 await db.exec(await readFile(new URL('../supabase/migrations/20261021234500_controlled_expense_operations.sql',import.meta.url),'utf8'))
 const request='00000000-0000-0000-0000-000000000003'
 const payload={campus:'senior',currency:'USD',amount:25,expense_date:'2026-10-21',category:'Fuel',description:'School transport',payment_method:'cash',status:'approved',entered_by:main}
 const submit=(id=request,values=payload)=>db.query('select * from submit_school_expense($1,$2::jsonb)',[id,JSON.stringify(values)])
 const original=(await submit()).rows[0]
 assert.equal(original.status,'pending');assert.equal(original.entered_by,accountant)
 assert.equal((await submit()).rows[0].id,original.id)
 assert.equal((await db.query('select count(*) from financial_events')).rows[0].count,1)
 assert.equal((await db.query('select actor_name from financial_events')).rows[0].actor_name,'Senior Accountant')
 await assert.rejects(submit(request,{...payload,amount:26}),/different submission/)
 await assert.rejects(submit(crypto.randomUUID(),{...payload,campus:'junior'}),/assigned campus/)
 await assert.rejects(submit(crypto.randomUUID(),{...payload,amount:1.123}),/two decimal/)
 await assert.rejects(submit(crypto.randomUUID(),{...payload,amount:'NaN'}),/positive expense/)
 const reverse=()=>db.query("select * from reverse_school_expense($1,'Wrong supplier entered')",[original.id])
 const review=(status='approved')=>db.query('select review_school_expense($1,$2)',[original.id,status])
 for(const role of ['accountant','campus-admin','teacher','parent','principal']) {
  await db.query("select set_config('test.role',$1,false)",[role])
  await assert.rejects(reverse(),/Only Main Admin/)
  await assert.rejects(review(),/Main Admin approval/)
  if(role!=='accountant')await assert.rejects(submit(crypto.randomUUID()),/assigned campus/)
 }
 await db.exec(`select set_config('test.role','main',false);select set_config('test.actor','${main}',false);select set_config('test.mfa','no',false)`)
 await assert.rejects(reverse(),/sign-in verification/)
 await db.exec("select set_config('test.mfa','yes',false)")
 await review();await review()
 assert.equal((await db.query("select count(*) from financial_events where action='school_expenses_update'")).rows[0].count,1)
 await assert.rejects(review('rejected'),/no longer awaiting/)
 await db.exec("create function fail_audit() returns trigger language plpgsql as $$ begin if new.action='expense_reversed' then raise exception 'audit unavailable'; end if; return new; end $$;create trigger fail_audit before insert on financial_events for each row execute function fail_audit()")
 await assert.rejects(reverse(),/audit unavailable/)
 assert.equal((await db.query('select status from school_expenses')).rows[0].status,'approved')
 await db.exec('drop trigger fail_audit on financial_events')
 assert.equal((await reverse()).rows[0].status,'reversed');await reverse()
 const reversed=(await db.query('select * from school_expenses')).rows[0]
 assert.equal(reversed.amount,'25.00');assert.equal(reversed.approved_by,main);assert.equal(reversed.reversed_by,main)
 assert.equal((await db.query("select count(*) from financial_events where action='expense_reversed'")).rows[0].count,1)
 await assert.rejects(review(),/no longer awaiting/)
 await db.exec(`select set_config('test.role','accountant',false);select set_config('test.actor','${accountant}',false)`)
 assert.equal((await submit()).rows[0].status,'reversed')
 await db.exec("create function fail_request() returns trigger language plpgsql as $$ begin raise exception 'request unavailable'; end $$;create trigger fail_request before insert on expense_submission_requests for each row execute function fail_request()")
 await assert.rejects(submit(crypto.randomUUID()),/request unavailable/)
 assert.equal((await db.query('select count(*) from school_expenses')).rows[0].count,1)
 await db.exec('set role authenticated')
 await assert.rejects(db.exec('delete from school_expenses'),/permission denied/)
 await assert.rejects(db.exec("update school_expenses set status='approved'"),/permission denied/)
 await assert.rejects(db.exec('insert into school_expenses(amount) values(20)'),/permission denied/)
 await assert.rejects(db.exec('select * from expense_submission_requests'),/permission denied/)
 } finally {await db.close()}
})
