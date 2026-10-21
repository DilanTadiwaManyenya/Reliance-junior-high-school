import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'

const migration = name => readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8')
const admin = '11111111-1111-4111-8111-111111111111'
const accountant = '22222222-2222-4222-8222-222222222222'
const parent = '33333333-3333-4333-8333-333333333333'
const teacher = '44444444-4444-4444-8444-444444444444'
const product = '55555555-5555-4555-8555-555555555555'

test('Stage 2 campus POS authorization, receipt isolation and retry safety', async () => {
  const db = new PGlite()
  try {
    await db.exec(`
      create role authenticated; create role anon; create schema auth; create schema storage;
      create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
      create table profiles(id uuid primary key,role text,active_role text,campus text);
      create table user_roles(user_id uuid,role text);
      create table staff_accounts(user_id uuid,campus text);
      create table students(id uuid primary key);
      create table parent_student(parent_id uuid,student_id uuid,verified_at timestamptz);
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text);
      alter table storage.objects enable row level security;
      create function public.is_accountant() returns boolean language sql as $$select false$$;
    `)
    // Load the project's actual helper bodies, not invented test role logic.
    for (const [file, names] of [
      ['20260910100000_multi_role_active_access.sql', ['has_active_role', 'is_admin']],
      ['20261012160000_restrict_schoolwide_settings_to_main_admin.sql', ['is_main_school_admin']],
      ['20260903130000_class_visibility_filters.sql', ['accountant_can_access_campus']],
    ]) {
      const source = await migration(file)
      for (const name of names) {
        const start = source.indexOf(`create or replace function public.${name}(`)
        assert.ok(start >= 0)
        const end = source.indexOf('$$;', source.indexOf('as $$', start)) + 3
        await db.exec(source.slice(start, end))
      }
    }
    await db.exec(await migration('20260923090000_inventory_and_pos.sql'))
    await db.exec('alter table inventory_products add column campus text; alter table inventory_products add column cost_price numeric default 0;')
    await db.exec(await migration('20261003150000_parent_uniform_orders.sql'))
    await db.exec(`drop policy "Admins manage inventory" on inventory_products;
      create policy "Main Admin manages inventory" on inventory_products for all to authenticated using (is_main_school_admin()) with check (is_main_school_admin());
      insert into profiles values ('${admin}','admin','admin','all'),('${accountant}','accountant','accountant','junior'),('${parent}','parent','parent','junior'),('${teacher}','teacher','teacher','junior');
      insert into user_roles select id,role from profiles;
      insert into user_roles values('${admin}','teacher');
      grant usage on schema public,auth,storage to authenticated,anon;
      grant select on storage.objects to authenticated,anon;
      grant insert,update,delete on storage.objects to authenticated;
    `)
    const catalogMigration = await migration('20261016120000_manage_shop_catalog_images.sql')
    await db.exec(catalogMigration)
    await db.exec(catalogMigration) // manual SQL is safely rerunnable
    const actAs = async (id, sqlRole = 'authenticated') => {
      await db.exec(`reset role; select set_config('test.uid','${id}',false); set role ${sqlRole};`)
    }
    await db.exec(`reset role;
      create table public.shop_audit(action text,details jsonb,actor uuid);
      alter table pos_sales add column request_id uuid unique;
      alter table pos_sales add column amount_paid numeric;
      alter table pos_sales add column campus text;
      alter table pos_sale_items add column unit_cost numeric;`)
    await db.exec(await migration('20261016130000_shop_product_size_variants.sql'))
    const juniorAdmin = '66666666-6666-4666-8666-666666666666'
    const seniorAdmin = '77777777-7777-4777-8777-777777777777'
    const seniorAccountant = '88888888-8888-4888-8888-888888888888'
    const invalidAdmin = '99999999-9999-4999-8999-999999999999'
    const legacy = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    const juniorProduct = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    const seniorProduct = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    await db.exec(`insert into profiles values('${juniorAdmin}','admin','admin','junior'),('${seniorAdmin}','admin','admin','senior'),('${seniorAccountant}','accountant','accountant','senior'),('${invalidAdmin}','admin','admin',null);
      insert into user_roles select id,role from profiles on conflict do nothing;
      insert into inventory_products(id,name,sku,category,selling_price,cost_price,quantity_on_hand,campus) values
        ('${legacy}','Legacy shirt','LEGACY','Uniforms',10,5,10,null),
        ('${juniorProduct}','Junior shirt','JR','Uniforms',12,6,5,'junior'),
        ('${seniorProduct}','Senior shirt','SR','Uniforms',14,7,5,'senior');
      insert into storage.objects(bucket_id,name) values('product-images','junior/existing.webp'),('product-images','senior/existing.webp');`)
    const before=(await db.query('select sum(quantity_on_hand)::integer qty from inventory_products')).rows[0].qty
    const stage=await migration('20261016150000_campus_admin_catalog_allocations.sql')
    await db.exec(stage);await db.exec(stage)
    assert.equal((await db.query('select sum(quantity_on_hand)::integer qty from inventory_products')).rows[0].qty,before)
    const posMigration=await migration('20261016160000_campus_pos_checkout.sql')
    await db.exec(posMigration);await db.exec(posMigration)
    const small='dddddddd-dddd-4ddd-8ddd-dddddddddddd'
    await db.exec(`reset role; update inventory_products set quantity_on_hand=0 where id='${juniorProduct}';
      update inventory_products set quantity_on_hand=20 where id='${seniorProduct}';
      insert into product_variants(id,product_id,size,quantity_on_hand) values('${small}','${juniorProduct}','Small',20);
      insert into profiles values('ffffffff-ffff-4fff-8fff-ffffffffffff','accountant','accountant',null);
      insert into user_roles values('ffffffff-ffff-4fff-8fff-ffffffffffff','accountant');`)
    const checkout=async(campus,items,id=crypto.randomUUID(),paid=100)=> (await db.query(
      "select (complete_pos_sale($1::jsonb,'cash','POS test',$2,$3,$4)).*",[JSON.stringify(items),id,paid,campus])).rows[0]
    const rowsFor=campus=>[{product_id:campus==='junior'?juniorProduct:seniorProduct,variant_id:campus==='junior'?small:null,quantity:1}]
    const stock=async()=>{await db.exec('reset role');return (await db.query('select id,quantity_on_hand from inventory_products order by id')).rows}
    for(const [id,campus] of [[juniorAdmin,'junior'],[seniorAdmin,'senior'],[accountant,'junior'],[seniorAccountant,'senior']]) {
      await actAs(id)
      const requestId=crypto.randomUUID()
      const sale=await checkout(campus,rowsFor(campus),requestId)
      assert.equal(sale.campus,campus);assert.equal(sale.sold_by,id)
      assert.equal((await checkout(campus,rowsFor(campus),requestId)).id,sale.id)
      await assert.rejects(checkout(campus==='junior'?'senior':'junior',rowsFor(campus)),/restricted to your assigned campus/)
      const legacyRequest=crypto.randomUUID()
      const legacySale=(await db.query("select (complete_pos_sale($1::jsonb,'cash','Legacy client',$2,100)).*",[JSON.stringify(rowsFor(campus)),legacyRequest])).rows[0]
      assert.equal(legacySale.campus,campus)
      const receipts=(await db.query('select campus from pos_sales')).rows
      assert.ok(receipts.length>0);assert.ok(receipts.every(row=>row.campus===campus),'Receipts are campus restricted')
      const lines=(await db.query('select product_id from pos_sale_items')).rows
      assert.ok(lines.every(line=>line.product_id===(campus==='junior'?juniorProduct:seniorProduct)))
      if(id===accountant || id===seniorAccountant) {
        assert.equal((await db.query('update inventory_products set selling_price=0 returning id')).rows.length,0)
        await assert.rejects(db.exec(`insert into storage.objects(bucket_id,name) values('product-images','${campus}/denied.webp')`),/row-level security/)
      }
      await assert.rejects(db.exec("insert into pos_sales(payment_method,total) values('cash',1)"),/permission denied/)
    }
    await actAs(admin)
    await assert.rejects(db.query("select complete_pos_sale($1::jsonb,'cash','Main',$2,100)",[JSON.stringify(rowsFor('junior')),crypto.randomUUID()]),/Choose a campus/)
    const mainRequest=crypto.randomUUID()
    const juniorSale=await checkout('junior',rowsFor('junior'),mainRequest)
    const seniorSale=await checkout('senior',rowsFor('senior'))
    assert.equal(juniorSale.campus,'junior');assert.equal(seniorSale.campus,'senior')
    await assert.rejects(checkout('senior',rowsFor('senior'),mainRequest),/another staff member or campus/)
    await assert.rejects(checkout(null,rowsFor('junior')),/must choose Junior or Senior/)
    const beforeFailure=await stock()
    await actAs(admin)
    await assert.rejects(checkout('junior',[...rowsFor('junior'),...rowsFor('senior')]),/unavailable in your campus/)
    await assert.rejects(checkout('junior',rowsFor('junior'),crypto.randomUUID(),0),/below the total/)
    await assert.rejects(checkout('junior',[{...rowsFor('junior')[0],quantity:-1}]),/Invalid cart quantity/)
    assert.deepEqual(await stock(),beforeFailure,'Invalid and mixed-campus sales leave stock unchanged')
    for(const id of [parent,teacher,invalidAdmin,'ffffffff-ffff-4fff-8fff-ffffffffffff']) {
      await actAs(id)
      await assert.rejects(checkout('junior',rowsFor('junior')),/restricted to your assigned campus/)
      assert.equal((await db.query('select * from pos_sales')).rows.length,0)
      assert.equal((await db.query('select * from pos_sale_items')).rows.length,0)
    }
    await actAs(admin)
    const snapshot=(await db.query('select product_name,unit_price,size_label from pos_sale_items where sale_id=$1',[juniorSale.id])).rows[0]
    await db.exec(`update inventory_products set name='Renamed',selling_price=99 where id='${juniorProduct}'`)
    assert.deepEqual((await db.query('select product_name,unit_price,size_label from pos_sale_items where sale_id=$1',[juniorSale.id])).rows[0],snapshot)
    await db.exec('reset role')
    assert.equal((await db.query("select count(*)::integer count from pg_proc where proname='complete_pos_sale'")).rows[0].count,2,'Only new campus function and safe wrapper remain')
    // New reversal stage runs against the real project helpers/stock triggers.
    await db.exec(`reset role; create function public.portal_mfa_satisfied() returns boolean language sql as $$select coalesce(nullif(current_setting('test.mfa',true),'')::boolean,true)$$;
      alter table profiles add column full_name text default 'Synthetic staff';
      alter table pos_sales add column currency text not null default 'USD';`)
    await db.exec(await migration('20261021200000_main_admin_pos_reversals.sql'))
    const reverse = async id => (await db.query('select * from reverse_pos_sale($1,$2)',[id,'Incorrect test entry'])).rows[0]
    for (const id of [accountant,seniorAccountant,juniorAdmin,seniorAdmin,invalidAdmin,parent,teacher]) {
      await actAs(id)
      await assert.rejects(reverse(juniorSale.id),/Only Main Admin/)
    }
    await actAs(admin)
    await db.exec("select set_config('test.mfa','false',false)")
    await assert.rejects(reverse(juniorSale.id),/sign-in verification/)
    await db.exec("select set_config('test.mfa','true',false)")
    await assert.rejects(db.query('select reverse_pos_sale($1,$2)',[juniorSale.id,' ']),/reversal reason/)
    await assert.rejects(db.exec("update pos_sales set status='reversed'"),/permission denied/)
    // Fail the audit insert: status and stock must roll back with it.
    await db.exec(`reset role; create function reject_test_financial_audit() returns trigger language plpgsql as $$begin raise exception 'Synthetic audit failure'; end$$;
      create trigger reject_test_audit before insert on financial_events for each row execute function reject_test_financial_audit();`)
    const stockBeforeAuditFailure=await stock()
    await actAs(admin)
    await assert.rejects(reverse(seniorSale.id),/Synthetic audit failure/)
    assert.deepEqual(await stock(),stockBeforeAuditFailure)
    assert.equal((await db.query('select status from pos_sales where id=$1',[seniorSale.id])).rows[0].status,'completed')
    await db.exec('drop trigger reject_test_audit on financial_events; drop function reject_test_financial_audit()')
    // New checkout writes both sale and exact line/stock events.
    await actAs(admin)
    const audited=await checkout('senior',rowsFor('senior'))
    assert.equal((await db.query('select count(*)::int n from financial_events')).rows[0].n,2)
    // Hidden sizes still receive their own original stock, without being shown.
    await db.exec(`reset role; update product_variants set active=false where id='${small}'`)
    const variantBefore=(await db.query('select quantity_on_hand from product_variants where id=$1',[small])).rows[0].quantity_on_hand
    await actAs(admin)
    const reversed=await reverse(juniorSale.id)
    assert.equal(reversed.status,'reversed')
    assert.equal(reversed.reversed_by,admin)
    await reverse(juniorSale.id)
    assert.equal((await db.query('select quantity_on_hand from product_variants where id=$1',[small])).rows[0].quantity_on_hand,variantBefore+1)
    assert.equal((await db.query("select count(*)::int n from financial_events where action='sale_reversed' and record_id=$1",[juniorSale.id])).rows[0].n,1)
    assert.equal((await db.query('select count(*)::int n from pos_sale_items where sale_id=$1',[juniorSale.id])).rows[0].n,1)
    const replayBefore=await stock()
    await actAs(admin)
    assert.equal((await checkout('junior',rowsFor('junior'),mainRequest)).status,'reversed')
    assert.deepEqual(await stock(),replayBefore,'Retrying original checkout cannot recreate a reversed sale')
    await actAs(admin)
    await reverse(audited.id)
    await assert.rejects(db.exec('delete from financial_events'),/permission denied/)
    await assert.rejects(db.exec("update financial_events set reason='changed'"),/permission denied/)
    await actAs(seniorAccountant)
    assert.ok((await db.query('select * from financial_events')).rows.every(row=>row.campus==='senior'))
    for(const id of [parent,teacher]) { await actAs(id); assert.equal((await db.query('select * from financial_events')).rows.length,0) }
    await db.exec(`reset role; update profiles set active_role='teacher' where id='${admin}'`)
    await actAs(admin)
    await assert.rejects(reverse(seniorSale.id),/Only Main Admin/)
    await db.exec(`reset role; update profiles set active_role='admin' where id='${admin}'`)
    await actAs('', 'anon')
    await assert.rejects(reverse(seniorSale.id),/permission denied/)
    await assert.rejects(checkout('junior',rowsFor('junior')),/permission denied/)
    await db.exec(`reset role; alter table inventory_products add column currency text not null default 'USD';
      alter table students add column full_name text; alter table students add column campus text; alter table students add column status text;
      insert into students values('10000000-0000-4000-8000-000000000001','Senior learner','senior','active'),
      ('10000000-0000-4000-8000-000000000002','Junior learner','junior','active'),
      ('10000000-0000-4000-8000-000000000003','Unlinked learner','senior','active');
      insert into parent_student values('${parent}','10000000-0000-4000-8000-000000000001',now());
      update inventory_products set selling_price=25,quantity_on_hand=20 where id='${seniorProduct}';`)
    await db.exec(await migration('20261021210000_pos_partial_payments.sql'))
    const learner='10000000-0000-4000-8000-000000000001'
    const partialCheckout=async(studentId,paid=20,requestId=crypto.randomUUID())=>(await db.query(
      "select * from complete_pos_sale($1::jsonb,'cash','Uniform buyer',$2,$3,'senior',$4)",
      [JSON.stringify(rowsFor('senior')),requestId,paid,studentId])).rows[0]
    const payment=async(saleId,tendered=5,requestId=crypto.randomUUID())=>(await db.query(
      "select * from record_pos_payment($1,$2,'cash',$3,'test reference')",[saleId,tendered,requestId])).rows[0]
    await actAs(seniorAccountant)
    await assert.rejects(partialCheckout(null),/Select a learner/)
    await assert.rejects(partialCheckout('10000000-0000-4000-8000-000000000002'),/active learner in the sale campus/)
    await assert.rejects(partialCheckout(learner,0),/positive payment/)
    await assert.rejects(partialCheckout(learner,20.001),/two decimal places/)
    const originalRequest=crypto.randomUUID()
    const partial=await partialCheckout(learner,20,originalRequest)
    assert.equal(Number(partial.total),25);assert.equal(Number(partial.paid_total),20);assert.equal(Number(partial.balance_due),5)
    assert.ok(partial.issued_at);assert.equal(partial.student_id,learner)
    assert.equal((await partialCheckout(learner,20,originalRequest)).id,partial.id)
    const afterIssue=await stock()
    for(const id of [accountant,juniorAdmin,parent,teacher]) {await actAs(id);await assert.rejects(payment(partial.id),/restricted to the sale campus/)}
    await actAs(seniorAccountant)
    const paymentRequest=crypto.randomUUID()
    const finalPayment=await payment(partial.id,10,paymentRequest)
    assert.equal(Number(finalPayment.amount),5);assert.equal(Number(finalPayment.change_due),5)
    assert.equal((await payment(partial.id,10,paymentRequest)).id,finalPayment.id)
    await assert.rejects(payment(partial.id),/no outstanding balance/)
    assert.deepEqual(await stock(),afterIssue,'Later payments do not move stock')
    await actAs(seniorAccountant)
    const settled=(await db.query('select * from pos_sales where id=$1',[partial.id])).rows[0]
    assert.equal(Number(settled.paid_total),25);assert.equal(Number(settled.balance_due),0)
    assert.equal((await db.query('select count(*)::int n from pos_payments where sale_id=$1',[partial.id])).rows[0].n,2)
    await assert.rejects(db.exec('delete from pos_payments'),/permission denied/)
    await actAs(parent)
    const parentReceipts=(await db.query('select parent_pos_receipts($1) as rows',[learner])).rows[0].rows
    assert.equal(parentReceipts.length,1);assert.equal(parentReceipts[0].payments.length,2)
    assert.equal(Number(parentReceipts[0].paid_total),25)
    assert.equal('sold_by' in parentReceipts[0],false);assert.equal('reversal_reason' in parentReceipts[0],false)
    await assert.rejects(db.query('select parent_pos_receipts($1)',['10000000-0000-4000-8000-000000000003']),/verified parent/)
    assert.equal((await db.query('select * from pos_sales')).rows.length,0,'Parent cannot read raw staff receipts')
    await actAs(seniorAccountant)
    const toReverse=await partialCheckout(learner)
    await db.exec(`reset role; create function reject_test_payment_audit() returns trigger language plpgsql as $$begin if new.action='payment_recorded' then raise exception 'Synthetic payment audit failure'; end if; return new; end$$;
      create trigger reject_test_payment_audit before insert on financial_events for each row execute function reject_test_payment_audit();`)
    const beforeFailedPayment=await stock()
    await actAs(seniorAccountant)
    await assert.rejects(payment(toReverse.id),/Synthetic payment audit failure/)
    assert.equal(Number((await db.query('select paid_total from pos_sales where id=$1',[toReverse.id])).rows[0].paid_total),20)
    await assert.rejects(partialCheckout(learner),/Synthetic payment audit failure/)
    assert.deepEqual(await stock(),beforeFailedPayment,'Audit failure rolls back initial checkout and later payment effects')
    await db.exec('drop trigger reject_test_payment_audit on financial_events; drop function reject_test_payment_audit()')
    await actAs(admin)
    const cancelled=await reverse(toReverse.id)
    assert.equal(Number(cancelled.balance_due),0);assert.equal(Number(cancelled.paid_total),20)
    await assert.rejects(payment(toReverse.id),/reversed sale/)
    assert.equal((await db.query('select count(*)::int n from pos_payments where sale_id=$1',[toReverse.id])).rows[0].n,1)
    console.log('Verified partial sale 25/20/5, learner/campus scope, issue once, final payment/change/retry, parent isolation and reversal preservation.')
    console.log('Verified Stage 2: admin/accountant campus sales, both Main Admin campuses, safe legacy wrapper, receipt RLS, immutable snapshots and no stock loss on rejected requests.')
  } finally { await db.close() }
})
