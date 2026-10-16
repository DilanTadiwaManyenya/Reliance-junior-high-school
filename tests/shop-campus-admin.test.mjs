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

test('Stage 1 campus catalog, allocation, stock and image permissions', async () => {
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
    for(const [id,own,other] of [[juniorAdmin,'junior','senior'],[seniorAdmin,'senior','junior']]) {
      await actAs(id)
      const rows=(await db.query('select campus from inventory_products')).rows
      assert.ok(rows.length>0);assert.ok(rows.every(row=>row.campus===own))
      await db.exec(`insert into inventory_products(name,category,campus,selling_price,quantity_on_hand) values('New ${own}','Uniforms','${own}',10,0)`)
      await assert.rejects(db.exec(`insert into inventory_products(name,campus,selling_price) values('Denied','${other}',1)`),/row-level security/)
      assert.equal((await db.query(`update inventory_products set name='No' where campus='${other}' returning id`)).rows.length,0)
      assert.equal((await db.query(`delete from inventory_products where campus='${other}' returning id`)).rows.length,0)
      await db.exec(`insert into storage.objects(bucket_id,name) values('product-images','${own}/allowed.webp')`)
      await assert.rejects(db.exec(`insert into storage.objects(bucket_id,name) values('product-images','${other}/denied.webp')`),/row-level security/)
      await assert.rejects(db.exec(`update inventory_products set campus='${other}' where campus='${own}'`),/cannot move campuses|row-level security/)
      await db.exec(`insert into product_variants(product_id,size,quantity_on_hand) select id,'S',3 from inventory_products where name='New ${own}'`)
      await assert.rejects(db.exec(`insert into product_variants(product_id,size) values('${own==='junior'?seniorProduct:juniorProduct}','X')`),/Existing stock|row-level security/)
      const stockProduct=own==='junior'?juniorProduct:seniorProduct
      await db.query("select adjust_shop_stock($1,1,'Stock receipt')",[stockProduct])
      await assert.rejects(db.query("select adjust_shop_stock($1,1,'Denied')",[own==='junior'?seniorProduct:juniorProduct]),/administrator access/)
    }
    for(const [id,campus] of [[accountant,'junior'],[seniorAccountant,'senior']]) {
      await actAs(id)
      const rows=(await db.query('select campus from inventory_products')).rows
      assert.ok(rows.length>0);assert.ok(rows.every(row=>row.campus===campus))
      await assert.rejects(db.exec(`insert into inventory_products(name,campus,selling_price) values('Denied','${campus}',1)`),/row-level security/)
      assert.equal((await db.query('update inventory_products set selling_price=1 returning id')).rows.length,0)
      assert.equal((await db.query('delete from inventory_products returning id')).rows.length,0)
      await assert.rejects(db.exec(`insert into storage.objects(bucket_id,name) values('product-images','${campus}/denied.webp')`),/row-level security/)
      assert.equal((await db.query('update storage.objects set name=name returning id')).rows.length,0)
      assert.equal((await db.query("delete from storage.objects where bucket_id='product-images' returning id")).rows.length,0)
      assert.equal((await db.query('update product_variants set quantity_on_hand=100 returning id')).rows.length,0)
      await assert.rejects(db.query("select adjust_shop_stock($1,1,'Denied')",[campus==='junior'?juniorProduct:seniorProduct]),/administrator access/)
      await assert.rejects(db.query('select split_unassigned_shop_product($1,$2,1,$3)',[legacy,campus,{}]),/Only Main Admin/)
    }
    for(const id of [invalidAdmin,parent,teacher]) {
      await actAs(id)
      assert.equal((await db.query(`select id from inventory_products where id='${legacy}'`)).rows.length,0)
      await assert.rejects(db.exec("insert into storage.objects(bucket_id,name) values('product-images','junior/denied.webp')"),/row-level security/)
    }
    await actAs(admin)
    assert.equal((await db.query('select * from inventory_products where campus is null')).rows.length,1)
    const details={name:'Allocated shirt',sku:'LEGACY',category:'Uniforms',selling_price:10,cost_price:5,reorder_level:5,active:true,image_url:null}
    const total=async()=>Number((await db.query('select sum(quantity_on_hand) qty from inventory_products')).rows[0].qty)
    const stockBefore=await total()
    const split=(await db.query('select split_unassigned_shop_product($1,$2,4,$3) id',[legacy,'junior',details])).rows[0].id
    assert.equal(await total(),stockBefore,'Split conserves stock')
    assert.equal((await db.query('select quantity_on_hand from inventory_products where id=$1',[legacy])).rows[0].quantity_on_hand,6)
    assert.equal((await db.query('select campus from inventory_products where id=$1',[split])).rows[0].campus,'junior')
    await assert.rejects(db.query('select split_unassigned_shop_product($1,$2,99,$3)',[legacy,'junior',details]),/Split quantity/)
    assert.equal(await total(),stockBefore,'Invalid split rolls back')
    await db.exec(`update inventory_products set campus='senior' where id='${legacy}'`)
    assert.equal(await total(),stockBefore)
    await assert.rejects(db.exec(`update inventory_products set campus='junior' where id='${legacy}'`),/cannot move campuses/)
    await assert.rejects(db.exec(`update inventory_products set image_url='https://example.supabase.co/storage/v1/object/public/product-images/junior/photo.webp' where id='${legacy}'`),/Copy the product image/)
    await db.exec(`update inventory_products set image_url='https://example.supabase.co/storage/v1/object/public/product-images/senior/photo.webp' where id='${legacy}'`)
    await actAs(juniorAdmin)
    assert.equal((await db.query(`select * from inventory_products where id='${legacy}'`)).rows.length,0)
    await db.exec('reset role')
    console.log('Verified Stage 1: campus admin CRUD/images/size stock; accountant mutations denied; immutable allocation; conserved split quantities.')
    await db.exec(await migration('20261016190000_main_admin_product_delete.sql'))
    const unused=crypto.randomUUID(),retired=crypto.randomUUID()
    await db.query("insert into inventory_products(id,name,campus,selling_price) values($1,'Never ordered','junior',1)",[unused])
    for(const id of [juniorAdmin,seniorAdmin,accountant,seniorAccountant,parent,teacher]) {
      await actAs(id)
      assert.equal((await db.query('delete from inventory_products where id=$1 returning id',[unused])).rows.length,0,'Only Main Admin can delete')
    }
    await actAs(admin)
    assert.equal((await db.query('delete from inventory_products where id=$1 returning id',[unused])).rows.length,1)
    await db.exec('reset role')
    await db.query('insert into shop_retired_checkout_requests(request_id) values($1)',[retired])
    await assert.rejects(db.query("insert into pos_sales(payment_method,total,sold_by,request_id) values('cash',1,$1,$2)",[admin,retired]),/test checkout was cleared/)
    await actAs(accountant)
    await assert.rejects(db.query('select * from shop_retired_checkout_requests'),/permission denied/)
    await db.exec('reset role')
    console.log('Verified Main Admin-only permanent deletion and cleared-checkout replay denial.')
  } finally { await db.close() }
})
