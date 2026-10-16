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

test('Catalog and storage RLS use existing helpers, enforce campus scope, and preserve ordered products', async () => {
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
    await actAs(admin)
    await db.exec(`insert into inventory_products(id,name,category,selling_price,cost_price,quantity_on_hand,campus) values('${product}','Tie','Uniforms',5,2,10,'junior');
      insert into storage.objects(bucket_id,name) values('product-images','junior/test.webp');`)
    await actAs(accountant)
    await db.exec(`update inventory_products set image_url='https://example.test/tie.webp',selling_price=6 where id='${product}';
      insert into inventory_products(name,category,selling_price,campus) values('Socks','Uniforms',3,'junior');
      insert into storage.objects(bucket_id,name) values('product-images','junior/accountant.webp');
      update storage.objects set name='junior/replaced.webp' where name='junior/accountant.webp';
      delete from storage.objects where name='junior/replaced.webp';`)
    await assert.rejects(db.exec("insert into inventory_products(name,selling_price,campus) values('Wrong campus',1,'senior')"), /row-level security/)
    await assert.rejects(db.exec("insert into storage.objects(bucket_id,name) values('product-images','senior/blocked.webp')"), /row-level security/)
    await assert.rejects(db.exec("update storage.objects set name='senior/moved.webp' where name='junior/test.webp'"), /row-level security/)
    for (const id of [parent, teacher]) {
      await actAs(id)
      await assert.rejects(db.exec("insert into storage.objects(bucket_id,name) values('product-images','junior/denied.webp')"), /row-level security/)
      await assert.rejects(db.exec("insert into inventory_products(name,selling_price,campus) values('Denied',1,'junior')"), /row-level security/)
      assert.equal((await db.query(`update inventory_products set selling_price=0 where id='${product}' returning id`)).rows.length, 0)
      assert.equal((await db.query("update storage.objects set name='junior/denied.webp' returning id")).rows.length, 0)
      assert.equal((await db.query('delete from storage.objects returning id')).rows.length, 0)
      assert.equal((await db.query('delete from inventory_products returning id')).rows.length, 0)
    }
    await actAs('', 'anon')
    assert.equal((await db.query('select * from storage.objects')).rows.length, 1, 'anonymous users can read catalog image objects')
    await actAs(admin)
    await db.exec(`update inventory_products set active=false where id='${product}'`)
    await actAs(parent)
    assert.equal((await db.query(`select * from inventory_products where id='${product}'`)).rows.length, 0, 'hidden products cannot be read by parent')
    await actAs(admin)
    await db.exec(`update inventory_products set active=true, quantity_on_hand=0 where id='${product}'`)
    await actAs(parent)
    assert.equal((await db.query(`select * from inventory_products where id='${product}'`)).rows.length, 1, 'out of stock remains visible')
    await db.exec('reset role')
    await db.exec(`insert into students values('${parent}');
      insert into parent_uniform_orders(parent_id,student_id,items,total,ecocash_phone) values('${parent}','${parent}','[{"product_id":"${product}","name":"Original Tie","unit_price":5,"quantity":1}]',5,'test');`)
    await actAs(admin)
    await db.exec(`update inventory_products set name='Renamed Tie',selling_price=20,active=false where id='${product}'`)
    await assert.rejects(db.exec(`delete from inventory_products where id='${product}'`), /order history/)
    await db.exec("insert into inventory_products(name,selling_price,campus) values('Never ordered',1,'junior')")
    assert.equal((await db.query("delete from inventory_products where name='Never ordered' returning id")).rows.length, 1)
    await db.exec('reset role')
    const snapshot = (await db.query('select items from parent_uniform_orders')).rows[0].items[0]
    assert.equal(snapshot.name, 'Original Tie'); assert.equal(snapshot.unit_price, 5)
    await db.exec(`insert into pos_sales(payment_method,total,sold_by) values('cash',5,'${admin}');
      insert into pos_sale_items(sale_id,product_id,product_name,unit_price,quantity,line_total) select id,'${product}','Original Tie',5,1,5 from pos_sales;
      delete from parent_uniform_orders;`)
    await actAs(admin)
    await assert.rejects(db.exec(`delete from inventory_products where id='${product}'`), /order history/)
    await db.exec(`reset role; update profiles set active_role='teacher' where id='${admin}'`)
    await actAs(admin)
    await assert.rejects(db.exec("insert into storage.objects(bucket_id,name) values('product-images','junior/switched.webp')"), /row-level security/)
    assert.equal((await db.query(`update inventory_products set name='No' where id='${product}' returning id`)).rows.length, 0)

    await db.exec(`reset role; update profiles set active_role='admin' where id='${admin}';
      alter table pos_sales add column request_id uuid unique;
      alter table pos_sales add column amount_paid numeric;
      alter table pos_sales add column campus text;
      alter table pos_sale_items add column unit_cost numeric;
      grant select,insert on parent_uniform_orders to authenticated;
      grant select on parent_student to authenticated;
      insert into parent_student values('${parent}','${parent}',now());`)
    await db.exec(await migration('20261016130000_shop_product_size_variants.sql'))
    await db.exec(await migration('20261016130000_shop_product_size_variants.sql'))
    const sized='66666666-6666-4666-8666-666666666666'
    const small='77777777-7777-4777-8777-777777777777'
    const large='88888888-8888-4888-8888-888888888888'
    await actAs(accountant)
    await db.exec(`insert into inventory_products(id,name,category,selling_price,cost_price,quantity_on_hand,campus) values('${sized}','Sized Shirt','Uniforms',5,2,0,'junior');
      insert into product_variants(id,product_id,size,quantity_on_hand) values('${small}','${sized}','Small',5),('${large}','${sized}','Large',3);`)
    const stock = async () => Number((await db.query('select quantity_on_hand from inventory_products where id=$1',[sized])).rows[0].quantity_on_hand)
    assert.equal(await stock(),8)
    await assert.rejects(db.exec(`update inventory_products set quantity_on_hand=100 where id='${sized}'`),/Adjust stock by size/)
    await assert.rejects(db.exec(`insert into product_variants(product_id,size) values('${sized}',' small ')`),/unique/)
    await db.exec("insert into inventory_products(name,selling_price,quantity_on_hand,campus) values('Unsized stock',5,10,'junior')")
    await assert.rejects(db.exec("insert into product_variants(product_id,size) select id,'S' from inventory_products where name='Unsized stock'"),/Existing stock/)
    for(const id of [parent,teacher]) {
      await actAs(id)
      await assert.rejects(db.exec(`insert into product_variants(product_id,size) values('${sized}','Denied')`),/row-level security/)
      assert.equal((await db.query(`update product_variants set quantity_on_hand=99 where product_id='${sized}' returning id`)).rows.length,0)
    }
    await actAs(parent)
    await db.exec(`insert into parent_uniform_orders(parent_id,student_id,items,total,ecocash_phone)
      values('${parent}','${parent}','[{"product_id":"${sized}","variant_id":"${small}","name":"Forged","unit_price":0,"quantity":2}]',1,'test')`)
    let order=(await db.query("select items,total from parent_uniform_orders order by created_at desc limit 1")).rows[0]
    assert.equal(order.items[0].name,'Sized Shirt');assert.equal(order.items[0].size_label,'Small');assert.equal(order.items[0].unit_price,5);assert.equal(Number(order.total),10)
    await actAs(accountant)
    assert.equal(await stock(),8,'Parent requests retain existing no-reservation behavior')
    const checkout=async(items,id='99999999-9999-4999-8999-999999999999') => (await db.query("select (complete_pos_sale($1::jsonb,'cash','Customer',$2,100)).*",[JSON.stringify(items),id])).rows[0]
    const items=[{product_id:sized,variant_id:small,quantity:1},{product_id:sized,variant_id:small,quantity:1},{product_id:sized,variant_id:large,quantity:1}]
    const sale=await checkout(items)
    assert.equal(await stock(),5)
    assert.equal((await checkout(items)).id,sale.id)
    assert.equal(await stock(),5,'Idempotent retries do not deduct size stock twice')
    await assert.rejects(checkout([{product_id:sized,quantity:1}],'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),/Size unavailable/)
    await assert.rejects(checkout([{product_id:sized,variant_id:small,quantity:4}],'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),/insufficient size stock/)
    await assert.rejects(checkout([{product_id:sized,variant_id:small,quantity:-1}],'cccccccc-cccc-4ccc-8ccc-cccccccccccc'),/Invalid cart quantity/)
    assert.equal(await stock(),5)
    await db.exec(`update product_variants set size='Small renamed',active=false where id='${small}';
      update inventory_products set name='Changed Shirt',selling_price=50 where id='${sized}';`)
    assert.equal(await stock(),2,'Hidden size stock is excluded from sellable total')
    await actAs(parent)
    assert.equal((await db.query(`select * from product_variants where id='${small}'`)).rows.length,0)
    order=(await db.query("select items,total from parent_uniform_orders order by created_at desc limit 1")).rows[0]
    assert.equal(order.items[0].name,'Sized Shirt');assert.equal(order.items[0].size_label,'Small');assert.equal(order.items[0].unit_price,5)
    await db.exec('reset role')
    const lines=(await db.query('select * from pos_sale_items where sale_id=$1',[sale.id])).rows
    assert.equal(lines.length,2);assert.equal(lines.find(line=>line.variant_id===small).size_label,'Small')
    assert.equal(lines[0].product_name,'Sized Shirt');assert.equal(Number(lines[0].unit_price),5)
  } finally { await db.close() }
})
