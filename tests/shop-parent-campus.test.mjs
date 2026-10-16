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

test('Stage 3 verified parent learner campus catalog, orders and history isolation', async () => {
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
    const seniorParent='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
    const dualParent='ffffffff-ffff-4fff-8fff-ffffffffffff'
    const unverifiedParent='12121212-1212-4212-8212-121212121212'
    const jrStudent='13131313-1313-4313-8313-131313131313'
    const srStudent='14141414-1414-4414-8414-141414141414'
    const noCampusStudent='15151515-1515-4515-8515-151515151515'
    const inactiveStudent='16161616-1616-4616-8616-161616161616'
    const otherStudent='17171717-1717-4717-8717-171717171717'
    await db.exec(`reset role;
      alter table students add column campus text; alter table students add column status text default 'active';
      insert into profiles values('${seniorParent}','parent','parent','senior'),('${dualParent}','parent','parent',null),('${unverifiedParent}','parent','parent','junior');
      insert into user_roles values('${seniorParent}','parent'),('${dualParent}','parent'),('${unverifiedParent}','parent');
      insert into students(id,campus,status) values('${jrStudent}','junior','active'),('${srStudent}','senior','active'),('${noCampusStudent}',null,'active'),('${inactiveStudent}','senior','inactive'),('${otherStudent}','junior','active');
      insert into parent_student values('${parent}','${jrStudent}',now()),('${parent}','${srStudent}',null),('${seniorParent}','${srStudent}',now()),('${dualParent}','${jrStudent}',now()),('${dualParent}','${srStudent}',now()),('${dualParent}','${noCampusStudent}',now()),('${dualParent}','${inactiveStudent}',now()),('${unverifiedParent}','${otherStudent}',null);
      grant select,insert on parent_uniform_orders to authenticated;
      grant select on students to authenticated;
      insert into parent_uniform_orders(parent_id,student_id,items,total,ecocash_phone) values('${dualParent}','${noCampusStudent}','[{"product_id":"${juniorProduct}","quantity":1,"name":"Old","unit_price":1}]',1,'test');`)
    const sizedJr='18181818-1818-4818-8818-181818181818'
    const sizedSr='19191919-1919-4919-8919-191919191919'
    const variantJr='20202020-2020-4020-8020-202020202020'
    const variantSr='21212121-2121-4121-8121-212121212121'
    await db.exec(`insert into inventory_products(id,name,category,campus,selling_price,quantity_on_hand) values('${sizedJr}','Sized Junior','Uniforms','junior',5,0),('${sizedSr}','Sized Senior','Uniforms','senior',6,0);
      insert into product_variants(id,product_id,size,quantity_on_hand) values('${variantJr}','${sizedJr}','Small',3),('${variantSr}','${sizedSr}','Large',4);`)
    const historical=(await db.query('select id,items,total from parent_uniform_orders')).rows[0]
    const parentStockBefore=(await db.query('select sum(quantity_on_hand) qty from inventory_products')).rows[0].qty
    const stage3=await migration('20261016170000_parent_uniform_campus_isolation.sql')
    await db.exec(stage3);await db.exec(stage3)
    assert.deepEqual((await db.query('select id,items,total from parent_uniform_orders')).rows[0],historical)
    for(const [actor,expected] of [[parent,['junior']],[seniorParent,['senior']],[dualParent,['junior','senior']],[unverifiedParent,[]]]) {
      await actAs(actor)
      const rows=(await db.query('select campus from inventory_products')).rows
      assert.deepEqual([...new Set(rows.map(row=>row.campus))].sort(),expected)
      assert.equal((await db.query('select * from inventory_products where campus is null')).rows.length,0)
      const visibleSizes=(await db.query('select id from product_variants')).rows.map(row=>row.id)
      assert.deepEqual(visibleSizes.sort(),[...(expected.includes('junior')?[variantJr]:[]),...(expected.includes('senior')?[variantSr]:[])].sort())
      await assert.rejects(db.exec("insert into storage.objects(bucket_id,name) values('product-images','junior/denied.webp')"),/row-level security/)
      assert.equal((await db.query('update inventory_products set name=name returning id')).rows.length,0)
    }
    const order=async(actor,student,lines,parentId=actor)=>db.query('insert into parent_uniform_orders(parent_id,student_id,items,total,ecocash_phone) values($1,$2,$3,1,\'test\') returning id,items,total',[parentId,student,JSON.stringify(lines)])
    const line=id=>({product_id:id,quantity:1,name:'Forged name',unit_price:0})
    await actAs(parent)
    assert.equal((await db.query('select parent_shop_student_campus($1) campus',[jrStudent])).rows[0].campus,'junior')
    assert.equal((await db.query('select parent_shop_student_campus($1) campus',[srStudent])).rows[0].campus,null)
    await order(parent,jrStudent,[{...line(sizedJr),variant_id:variantJr}])
    await assert.rejects(order(parent,jrStudent,[{...line(sizedJr),variant_id:variantSr}]),/Size unavailable/)
    const juniorOrder=(await order(parent,jrStudent,[line(juniorProduct)])).rows[0]
    assert.equal(juniorOrder.items[0].name,'Junior shirt');assert.equal(juniorOrder.items[0].unit_price,12)
    await assert.rejects(order(parent,jrStudent,[line(seniorProduct)]),/learner’s campus/)
    await assert.rejects(order(parent,srStudent,[line(seniorProduct)]),/verified active learner/)
    await assert.rejects(order(parent,jrStudent,[line(juniorProduct)],dualParent),/verified active learner/)
    await actAs(dualParent)
    await order(dualParent,srStudent,[line(seniorProduct)])
    await order(dualParent,jrStudent,[line(juniorProduct)])
    await assert.rejects(order(dualParent,jrStudent,[line(juniorProduct),line(seniorProduct)]),/learner’s campus/)
    await assert.rejects(order(dualParent,srStudent,[line(juniorProduct)]),/learner’s campus/)
    await assert.rejects(order(dualParent,noCampusStudent,[line(juniorProduct)]),/verified active learner/)
    await assert.rejects(order(dualParent,inactiveStudent,[line(seniorProduct)]),/verified active learner/)
    await assert.rejects(order(dualParent,otherStudent,[line(juniorProduct)]),/verified active learner/)
    assert.equal((await db.query('select * from parent_uniform_orders where id=$1',[historical.id])).rows.length,1,'Missing campus does not remove verified historical orders')
    await actAs(unverifiedParent)
    await assert.rejects(order(unverifiedParent,otherStudent,[line(juniorProduct)]),/verified active learner/)
    assert.equal((await db.query('select * from parent_uniform_orders')).rows.length,0)
    await actAs(parent)
    assert.equal((await db.query('select * from parent_uniform_orders where parent_id=$1',[dualParent])).rows.length,0)
    await db.exec('reset role')
    assert.equal((await db.query('select sum(quantity_on_hand) qty from inventory_products')).rows[0].qty,parentStockBefore,'Parent requests retain no automatic stock deduction behavior')
    await db.exec(`update inventory_products set active=false,name='Changed name',selling_price=99 where id='${juniorProduct}'`)
    await actAs(parent)
    const saved=(await db.query('select items,total from parent_uniform_orders where id=$1',[juniorOrder.id])).rows[0]
    assert.equal(saved.items[0].name,'Junior shirt');assert.equal(saved.items[0].unit_price,12)
    assert.equal((await db.query('select * from inventory_products where id=$1',[juniorProduct])).rows.length,0)
    await db.exec('reset role')
    await db.exec(`update parent_student set verified_at=null where parent_id='${parent}' and student_id='${jrStudent}'`)
    await actAs(parent)
    assert.equal((await db.query('select * from parent_uniform_orders')).rows.length,0,'Revoked links lose order access')
    assert.equal((await db.query('select parent_shop_student_campus($1) campus',[jrStudent])).rows[0].campus,null)
    await actAs(accountant)
    assert.ok((await db.query('select * from parent_uniform_orders')).rows.every(row=>row.student_id===jrStudent),'Junior accountant cannot read Senior or unassigned orders')
    await assert.rejects(order(accountant,srStudent,[line(seniorProduct)],seniorParent),/Only authorized staff/)
    await actAs(teacher)
    assert.equal((await db.query('select parent_shop_student_campus($1) campus',[srStudent])).rows[0].campus,null)
    await assert.rejects(order(teacher,srStudent,[line(seniorProduct)],seniorParent),/Only authorized staff/)
    await db.exec('reset role')
    console.log('Verified Stage 3: single/dual-campus parents, verified links, forged/mixed-campus order rejection, historical snapshots and unchanged stock.')
  } finally { await db.close() }
})
