import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { feePaymentStorageKey, loadFeePayment, saveFeePayment } from '../src/lib/feePaymentRetry.js'

test('recovery retains original request and fails closed on unreadable storage', () => {
 const values=new Map(), storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)}
 const key=feePaymentStorageKey('accountant'), submission={name:'Learner',payload:{p_request_id:'request',p_student_id:'learner',p_amount:20}}
 saveFeePayment(storage,key,submission)
 assert.deepEqual(loadFeePayment(storage,key),submission)
 assert.equal(loadFeePayment(storage,feePaymentStorageKey('another-user')),null)
 storage.setItem(key,'broken')
 assert.equal(loadFeePayment(storage,key).invalid,true)
})

test('fee request retries apply once, reject changed submissions and roll back request with payment', async () => {
 const db=new PGlite()
 try {
 await db.exec(`create schema auth; create role authenticated; create role anon;
 create function auth.uid() returns uuid language sql as $$ select '00000000-0000-0000-0000-000000000001'::uuid $$;
 create table students(id uuid primary key,campus text);
 insert into students values('00000000-0000-0000-0000-000000000002','senior');
 create table fee_balances(id uuid primary key,amount_paid numeric);
 insert into fee_balances values('00000000-0000-0000-0000-000000000003',0);
 create function accountant_can_access_campus(text) returns boolean language sql as $$ select current_setting('test.role',true)='accountant' and $1='senior' $$;
 create function can_manage_student_record(uuid) returns boolean language sql as $$ select false $$;
 create function portal_mfa_satisfied() returns boolean language sql as $$ select true $$;
 create function record_learner_fee_payment(uuid,text,integer,numeric,date,text,text,text,numeric) returns fee_balances language plpgsql as $$ declare r fee_balances; begin update fee_balances set amount_paid=amount_paid+$4 returning * into r; return r; end $$;
 select set_config('test.role','accountant',false);`)
 await db.exec(await readFile(new URL('../supabase/migrations/20261021230000_idempotent_fee_payments.sql',import.meta.url),'utf8'))
 const call=(amount=20,request='00000000-0000-0000-0000-000000000004')=>db.query(`select * from record_learner_fee_payment('00000000-0000-0000-0000-000000000002','Term 1',2098,$1,current_date,'cash',null,'USD',$2::uuid,100)`,[amount,request])
 assert.equal((await call()).rows[0].amount_paid,'20')
 assert.equal((await call()).rows[0].amount_paid,'20')
 await assert.rejects(call(21),/different submission/)
 await assert.rejects(call(20.123),/two decimal/)
 await db.exec(`select set_config('test.role','parent',false)`)
 await assert.rejects(call(),/cannot record/)
 await db.exec(`select set_config('test.role','accountant',false);
 create function fail_request() returns trigger language plpgsql as $$ begin raise exception 'request unavailable'; end $$;
 create trigger fail_request before insert on fee_payment_requests for each row execute function fail_request();`)
 await assert.rejects(call(10,'00000000-0000-0000-0000-000000000005'),/request unavailable/)
 assert.equal((await db.query('select amount_paid from fee_balances')).rows[0].amount_paid,'20')
 assert.equal((await db.query('select count(*) from fee_payment_requests')).rows[0].count,1)
 } finally { await db.close() }
})
