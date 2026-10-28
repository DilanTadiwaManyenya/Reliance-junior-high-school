import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const admin = "11111111-1111-4111-8111-111111111111";
const product = "22222222-2222-4222-8222-222222222222";
const openingProduct = "25252525-2525-4525-8525-252525252525";
const variantProduct = "33333333-3333-4333-8333-333333333333";
const variant = "44444444-4444-4444-8444-444444444444";

const migration = (name) => readFile(
  new URL(`../supabase/migrations/${name}`, import.meta.url),
  "utf8",
);

test("supplier batches drive FIFO sale cost, retries, reversals and corrections", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role authenticated; create role anon;
      create schema auth;
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('test.uid', true), '')::uuid
      $$;
      create table public.profiles (
        id uuid primary key, role text, active_role text, campus text, full_name text
      );
      insert into public.profiles values ('${admin}', 'admin', 'admin', 'all', 'Test Admin');
      create function public.is_main_school_admin() returns boolean language sql stable as $$
        select auth.uid() is not null and current_setting('test.role', true) = 'admin'
          and exists(select 1 from public.profiles where id = auth.uid() and campus = 'all')
      $$;
      create function public.portal_mfa_satisfied() returns boolean language sql stable as $$
        select coalesce(current_setting('test.mfa', true) = 'true', false)
      $$;
      create function public.can_read_shop_campus(target text) returns boolean language sql stable as $$
        select auth.uid() is not null and (public.is_main_school_admin() or exists(
          select 1 from public.profiles where id = auth.uid() and campus = target
        ))
      $$;
      create function public.can_manage_shop_campus(target text) returns boolean language sql stable as $$
        select public.is_main_school_admin() or exists(
          select 1 from public.profiles where id = auth.uid() and active_role = 'admin' and campus = target
        )
      $$;
      create table public.students(id uuid primary key, campus text, status text, full_name text);
      create table public.inventory_products (
        id uuid primary key default gen_random_uuid(), name text not null, sku text, category text,
        selling_price numeric(12,2) not null, cost_price numeric(12,2) not null default 0,
        quantity_on_hand integer not null default 0, reorder_level integer not null default 5,
        active boolean not null default true, created_by uuid references public.profiles(id),
        created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
        campus text, currency text not null default 'USD', has_variants boolean not null default false,
        image_url text
      );
      create table public.product_variants (
        id uuid primary key default gen_random_uuid(), product_id uuid not null references public.inventory_products(id),
        size text not null, sku text, quantity_on_hand integer not null default 0,
        active boolean not null default true, created_at timestamptz not null default now()
      );
      create function public.sync_test_variant_stock() returns trigger language plpgsql as $$
      begin
        update public.inventory_products set has_variants = true,
          quantity_on_hand = (select coalesce(sum(quantity_on_hand), 0) from public.product_variants
            where product_id = new.product_id and active), updated_at = now()
        where id = new.product_id;
        return new;
      end;
      $$;
      create trigger test_variant_stock after insert or update on public.product_variants
        for each row execute function public.sync_test_variant_stock();
      create table public.pos_sales (
        id uuid primary key default gen_random_uuid(), receipt_number text not null default ('R-' || gen_random_uuid()::text),
        customer_name text, payment_method text not null, total numeric(12,2) not null,
        sold_by uuid references public.profiles(id), request_id uuid unique, amount_paid numeric(12,2),
        campus text, currency text, student_id uuid, payment_tracking boolean default true,
        paid_total numeric(12,2) default 0, balance_due numeric(12,2) default 0,
        issued_at timestamptz, created_at timestamptz not null default now(),
        status text not null default 'completed', reversed_at timestamptz,
        reversed_by uuid, reversal_reason text
      );
      create table public.pos_sale_items (
        id uuid primary key default gen_random_uuid(), sale_id uuid not null references public.pos_sales(id),
        product_id uuid not null references public.inventory_products(id), variant_id uuid,
        size_label text, product_name text not null, unit_price numeric(12,2) not null,
        unit_cost numeric(12,2), quantity integer not null, line_total numeric(12,2) not null
      );
      create function public.complete_pos_sale(jsonb,text,text,uuid,numeric,text)
        returns public.pos_sales language sql as $$ select null::public.pos_sales $$;
      create table public.shop_audit(action text, details jsonb, actor uuid);
      create table public.financial_events(
        module text, action text, record_id uuid, campus text, currency text, actor_id uuid,
        actor_name text, actor_role text, reason text, details jsonb
      );
      create function public.record_pos_payment(uuid, numeric, text, uuid, text)
        returns void language sql as $$ select $$;
      select set_config('test.uid', '${admin}', false),
        set_config('test.role', 'admin', false), set_config('test.mfa', 'true', false);
    `);

    await db.exec(await migration("20261028140000_shop_stock_receipts.sql"));
    await db.exec(`insert into public.inventory_products(id,name,selling_price,cost_price,quantity_on_hand,campus,currency)
      values ('${openingProduct}','Opening shirt',15,6.25,6,'senior','USD');`);
    await db.exec(await migration("20261028150000_shop_pos_batch_costing.sql"));
    await db.exec(`
      insert into public.inventory_products(id,name,selling_price,cost_price,quantity_on_hand,campus,currency)
      values ('${product}','Tie',10,3,0,'junior','USD');
      insert into public.inventory_products(id,name,selling_price,cost_price,quantity_on_hand,campus,currency,has_variants)
      values ('${variantProduct}','Jacket',20,8,0,'junior','USD',true);
      insert into public.product_variants(id,product_id,size,quantity_on_hand)
      values ('${variant}','${variantProduct}','Small',0);
    `);
    assert.equal(Number((await db.query(
      "select count(*) from public.shop_stock_batches where product_id=$1 and quantity_remaining=6 and unit_cost=6.25",
      [openingProduct],
    )).rows[0].count), 1);
    assert.equal((await db.query(
      "select receipt_kind from public.shop_stock_receipts join public.shop_stock_batches batch on batch.receipt_id=shop_stock_receipts.id where batch.product_id=$1",
      [openingProduct],
    )).rows[0].receipt_kind, "opening");
    const anonPrivileges = (await db.query(
      "select has_function_privilege('anon','public.receive_shop_stock(uuid,text,text,text,jsonb)','execute') as anon_receive, has_function_privilege('anon','public.complete_pos_sale(jsonb,text,text,uuid,numeric,text,uuid)','execute') as anon_checkout",
    )).rows[0];
    assert.equal(anonPrivileges.anon_receive, false);
    assert.equal(anonPrivileges.anon_checkout, false);

    const receive = (requestId, items) => db.query(
      `select public.receive_shop_stock($1::uuid,$2,null,null,$3::jsonb) as id`,
      [requestId, "Uniform Supplier", JSON.stringify(items)],
    );
    const firstReceipt = (await receive("55555555-5555-4555-8555-555555555555", [
      { product_id: product, quantity: 5, unit_cost: "2.00" },
    ])).rows[0].id;
    assert.equal((await receive("55555555-5555-4555-8555-555555555555", [
      { product_id: product, quantity: 5, unit_cost: "2.00" },
    ])).rows[0].id, firstReceipt);
    await receive("66666666-6666-4666-8666-666666666666", [
      { product_id: product, quantity: 5, unit_cost: "4.00" },
    ]);
    await receive("77777777-7777-4777-8777-777777777777", [
      { product_id: variantProduct, variant_id: variant, quantity: 4, unit_cost: "8.50" },
    ]);

    const checkout = (items, requestId, campus = "junior") => db.query(
      `select (public.complete_pos_sale($1::jsonb,'cash','Test learner',$2::uuid,$3::numeric,$4,null::uuid)).*`,
      [JSON.stringify(items), requestId, 500, campus],
    );
    const saleId = "88888888-8888-4888-8888-888888888888";
    const sale = (await checkout([{ product_id: product, quantity: 7 }], saleId)).rows[0];
    const saleLine = (await db.query(
      "select * from public.pos_sale_items where sale_id=$1", [sale.id],
    )).rows[0];
    assert.equal(Number(saleLine.cost_total), 18);
    assert.equal(Number(saleLine.unit_cost), 2.57);
    assert.deepEqual(
      (await db.query(`select allocation.quantity, allocation.unit_cost
        from public.shop_stock_batch_allocations allocation
        where allocation.sale_item_id=$1 order by allocation.unit_cost`, [saleLine.id])).rows,
      [{ quantity: 5, unit_cost: "2.00" }, { quantity: 2, unit_cost: "4.00" }],
    );
    assert.equal(Number((await db.query(
      "select quantity_on_hand from public.inventory_products where id=$1", [product],
    )).rows[0].quantity_on_hand), 3);

    const retry = (await checkout([{ product_id: product, quantity: 7 }], saleId)).rows[0];
    assert.equal(retry.id, sale.id);
    assert.equal(Number((await db.query(
      "select sum(quantity_remaining) as quantity from public.shop_stock_batches where product_id=$1", [product],
    )).rows[0].quantity), 3);
    await assert.rejects(
      checkout([{ product_id: product, quantity: 4 }], "99999999-9999-4999-8999-999999999999"),
      /insufficient stock/,
    );

    await db.query("select public.reverse_pos_sale($1::uuid,$2)", [sale.id, "Return test stock"]);
    await db.query("select public.reverse_pos_sale($1::uuid,$2)", [sale.id, "Return test stock"]);
    assert.equal(Number((await db.query(
      "select quantity_on_hand from public.inventory_products where id=$1", [product],
    )).rows[0].quantity_on_hand), 10);
    await assert.rejects(
      db.exec(`update public.inventory_products set currency='ZWG' where id='${product}'`),
      /Sell or reconcile the remaining stock batches/,
    );
    assert.equal(Number((await db.query(
      "select sum(quantity_remaining) as quantity from public.shop_stock_batches where product_id=$1", [product],
    )).rows[0].quantity), 10);
    assert.equal(Number((await db.query(
      "select count(*) from public.shop_stock_receipts where receipt_kind='return'",
    )).rows[0].count), 1);

    await db.query("select public.adjust_shop_stock($1,2,$2)", [product, "Correction test"]);
    await db.query("select public.adjust_shop_stock($1,-1,$2)", [product, "Correction test reduction"]);
    assert.equal(Number((await db.query(
      "select quantity_on_hand from public.inventory_products where id=$1", [product],
    )).rows[0].quantity_on_hand), 11);
    assert.equal(Number((await db.query(
      "select sum(quantity_remaining) as quantity from public.shop_stock_batches where product_id=$1", [product],
    )).rows[0].quantity), 11);

    const variantSale = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const sizedSale = (await checkout([
      { product_id: variantProduct, variant_id: variant, quantity: 2 },
    ], variantSale)).rows[0];
    const sizedLine = (await db.query(
      "select * from public.pos_sale_items where sale_id=$1", [sizedSale.id],
    )).rows[0];
    assert.equal(Number(sizedLine.cost_total), 17);
    await db.query("select public.reverse_pos_sale($1::uuid,$2)", [sizedSale.id, "Return sized test stock"]);
    assert.equal(Number((await db.query(
      "select quantity_on_hand from public.product_variants where id=$1", [variant],
    )).rows[0].quantity_on_hand), 4);
    assert.equal(Number((await db.query(
      "select quantity_on_hand from public.inventory_products where id=$1", [variantProduct],
    )).rows[0].quantity_on_hand), 4);

    const openingSale = (await checkout([
      { product_id: openingProduct, quantity: 2 },
    ], "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "senior")).rows[0];
    assert.equal(Number((await db.query(
      "select cost_total from public.pos_sale_items where sale_id=$1", [openingSale.id],
    )).rows[0].cost_total), 12.5);
  } finally {
    await db.close();
  }
});
