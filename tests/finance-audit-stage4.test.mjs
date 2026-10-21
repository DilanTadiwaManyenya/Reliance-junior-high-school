import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('fee and expense changes are atomic, repeatable, immutable audit events', async () => {
 const db = new PGlite()
 try {
 await db.exec(`create schema auth;
 create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 create role authenticated; create role anon;
 create table profiles(id uuid primary key,full_name text,active_role text,role text);
 create table students(id uuid primary key,campus text);
 create table fee_balances(id uuid primary key,student_id uuid,currency text,total_fees numeric);
 create table fee_payments(id uuid primary key,student_id uuid,currency text,amount numeric);
 create table school_expenses(id uuid primary key,campus text,currency text,amount numeric);
 create table financial_events(id uuid default gen_random_uuid(),module text,action text,record_id uuid,campus text,currency text,actor_id uuid,actor_name text,actor_role text,details jsonb,unique(module,action,record_id));
 alter table financial_events enable row level security;
 grant select on financial_events to authenticated;
 create function is_main_school_admin() returns boolean language sql as $$ select false $$;
 create function accountant_can_access_campus(text) returns boolean language sql as $$ select $1='senior' and current_setting('test.role',true)='accountant' $$;
 insert into students values('00000000-0000-0000-0000-000000000001','senior');`)
 await db.exec(await readFile(new URL('../supabase/migrations/20261021220000_fee_expense_financial_audit.sql', import.meta.url),'utf8'))
 await db.exec(`insert into fee_balances values('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','USD',100);
 update fee_balances set total_fees=110; update fee_balances set total_fees=120;
 update fee_balances set total_fees=120;
 insert into fee_payments values(gen_random_uuid(),'00000000-0000-0000-0000-000000000001','USD',20);
 insert into school_expenses values(gen_random_uuid(),'junior','ZWG',30);`)
 const rows=(await db.query('select * from financial_events')).rows
 assert.equal(rows.length,5)
 assert.equal(rows[0].actor_role,'system')
 assert.equal(rows[2].details.before.total_fees,110)
 assert.equal(rows[2].details.after.total_fees,120)
 assert.equal(rows[4].campus,'junior')
 await db.exec(`set role authenticated; select set_config('test.role','accountant',false)`)
 assert.equal((await db.query('select * from financial_events')).rows.length,4)
 await assert.rejects(db.exec('delete from financial_events'), /permission denied/)
 await db.exec(`select set_config('test.role','parent',false)`)
 assert.equal((await db.query('select * from financial_events')).rows.length,0)
 await db.exec('reset role')
 await db.exec(`create function fail_audit() returns trigger language plpgsql as $$ begin raise exception 'audit unavailable'; end $$;
 create trigger fail_audit before insert on financial_events for each row execute function fail_audit();`)
 await assert.rejects(db.exec('update fee_balances set total_fees=999'), /audit unavailable/)
 assert.equal((await db.query('select total_fees from fee_balances')).rows[0].total_fees,'120')
 } finally { await db.close() }
})
