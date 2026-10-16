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
    await actAs('', 'anon')
    await assert.rejects(checkout('junior',rowsFor('junior')),/permission denied/)
    console.log('Verified Stage 2: admin/accountant campus sales, both Main Admin campuses, safe legacy wrapper, receipt RLS, immutable snapshots and no stock loss on rejected requests.')
  } finally { await db.close() }
})
