import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { test } from "node:test";

const staff = "11111111-1111-4111-8111-111111111111";
const product = "22222222-2222-4222-8222-222222222222";
const request = "33333333-3333-4333-8333-333333333333";
const otherProduct = "44444444-4444-4444-8444-444444444444";

test("Shop checkout, stock accounting, retry safety and role permissions", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role authenticated; create role anon; alter default privileges grant execute on functions to anon;
      create schema auth;
      create table public.profiles(id uuid primary key);
      insert into public.profiles values ('${staff}');
      create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
      create function public.has_active_role(expected_role text) returns boolean language sql as $$select current_setting('test.role',true)=expected_role$$;
      create function public.is_admin() returns boolean language sql as $$select current_setting('test.role',true)='admin'$$;
      create function public.is_accountant() returns boolean language sql as $$select current_setting('test.role',true)='accountant'$$;
      select set_config('test.uid','${staff}',false),set_config('test.role','admin',false);
    `);
    for (const name of [
      "20260923090000_inventory_and_pos.sql",
      "20260929100000_shop_workflows.sql",
      "20260929110000_shop_function_permissions.sql",
    ]) {
      await db.exec(
        await readFile(
          new URL(`../supabase/migrations/${name}`, import.meta.url),
          "utf8",
        ),
      );
    }
    await db.exec(
      `insert into inventory_products(id,name,selling_price,cost_price,quantity_on_hand) values('${product}','Tie',3,1,10),('${otherProduct}','Socks',2,0.5,1)`,
    );
    assert.equal((await db.query("select has_function_privilege('anon','public.complete_pos_sale(jsonb,text,text,uuid,numeric)','execute') allowed")).rows[0].allowed, false);
    const checkout = (items, id = request, paid = 20) =>
      db.query(
        "select (public.complete_pos_sale($1::jsonb,$2,$3,$4::uuid,$5::numeric)).*",
        [JSON.stringify(items), "cash", "Test learner", id, paid],
      );
    const quantity = async () =>
      Number(
        (
          await db.query(
            "select quantity_on_hand from inventory_products where id=$1",
            [product],
          )
        ).rows[0].quantity_on_hand,
      );
    const items = [
      { product_id: product, quantity: 2 },
      { product_id: product, quantity: 1 },
    ];
    const first = (await checkout(items)).rows[0];
    assert.equal(Number(first.total), 9);
    assert.equal(
      await quantity(),
      7,
      "duplicate product lines aggregate correctly",
    );
    const retry = (await checkout(items)).rows[0];
    assert.equal(retry.id, first.id);
    assert.equal(await quantity(), 7, "retry must not subtract stock twice");
    assert.equal(
      Number(
        (await db.query("select count(*) from pos_sale_items")).rows[0].count,
      ),
      1,
    );
    assert.equal(
      Number(
        (await db.query("select unit_cost from pos_sale_items")).rows[0]
          .unit_cost,
      ),
      1,
    );
    await db.exec(
      `update inventory_products set cost_price=2,selling_price=4 where id='${product}'`,
    );
    assert.equal(
      Number(
        (await db.query("select unit_cost from pos_sale_items")).rows[0]
          .unit_cost,
      ),
      1,
      "cost snapshot remains immutable",
    );
    const nextId = "55555555-5555-4555-8555-555555555555";
    await assert.rejects(
      checkout([{ product_id: product, quantity: 1 }], nextId, 1),
      /below the total/,
    );
    await assert.rejects(
      checkout([{ product_id: product, quantity: 1.5 }], nextId),
      /Invalid cart quantity/,
    );
    await assert.rejects(
      checkout([{ product_id: product, quantity: null }], nextId),
      /Invalid cart quantity/,
    );
    await assert.rejects(
      checkout(
        [
          { product_id: product, quantity: 4 },
          { product_id: product, quantity: 4 },
        ],
        nextId,
        100,
      ),
      /Insufficient stock/,
    );
    await assert.rejects(
      checkout(
        [
          { product_id: product, quantity: 1 },
          { product_id: otherProduct, quantity: 2 },
        ],
        nextId,
      ),
      /Insufficient stock/,
    );
    assert.equal(await quantity(), 7, "failed multi-item sale rolls back");
    assert.equal(
      Number((await db.query("select count(*) from pos_sales")).rows[0].count),
      1,
    );
    await db.query("select public.adjust_shop_stock($1,3,$2)", [
      product,
      "Delivery",
    ]);
    assert.equal(await quantity(), 10);
    await assert.rejects(
      db.query("select public.adjust_shop_stock($1,-11,$2)", [
        product,
        "Incorrect adjustment",
      ]),
      /check constraint/,
    );
    assert.equal(await quantity(), 10);
    await db.exec("select set_config('test.role','accountant',false)");
    await assert.rejects(
      db.query("select public.adjust_shop_stock($1,3,$2)", [
        product,
        "Forbidden",
      ]),
      /Administrator access required/,
    );
    await checkout([{ product_id: product, quantity: 1 }], nextId);
    assert.equal(await quantity(), 9);
    await db.exec("select set_config('test.role','teacher',false)");
    await assert.rejects(
      checkout(
        [{ product_id: product, quantity: 1 }],
        "66666666-6666-4666-8666-666666666666",
      ),
      /Shop staff access required/,
    );
    // Exercise policies as an actual restricted SQL role, not the migration owner.
    await db.exec(
      "grant usage on schema public,auth to authenticated; grant select,insert,update,delete on inventory_products,pos_sales,pos_sale_items to authenticated; set role authenticated",
    );
    assert.equal(
      (await db.query("select * from inventory_products")).rows.length,
      0,
      "teachers cannot read inventory",
    );
    assert.equal(
      (await db.query("select * from pos_sales")).rows.length,
      0,
      "teachers cannot read receipts",
    );
    await db.exec("select set_config('test.role','accountant',false)");
    assert.equal(
      (await db.query("select * from inventory_products")).rows.length,
      2,
    );
    assert.equal(
      (await db.query("select * from shop_audit")).rows.length,
      0,
      "accountants cannot read administrator audit logs",
    );
    await assert.rejects(
      db.query(
        "insert into pos_sales(payment_method,total,sold_by) values($1,1,$2)",
        ["cash", staff],
      ),
      /row-level security/,
    );
    await db.exec("select set_config('test.role','admin',false)");
    assert.ok((await db.query("select * from shop_audit")).rows.length >= 5);
    console.log(
      "Verified: aggregated stock, retry idempotency, transaction rollback, costs, adjustments and role policies.",
    );
  } finally {
    await db.close();
  }
});


test('Migration accepts the live admin-only schema without is_accountant', async () => {
  const db = new PGlite()
  try {
    await db.exec(`create role authenticated; create role anon; alter default privileges grant execute on functions to anon; create schema auth; create table public.profiles(id uuid primary key);
      create function auth.uid() returns uuid language sql as 'select null::uuid';
      create function public.is_admin() returns boolean language sql as 'select false';
      create function public.is_accountant() returns boolean language sql as 'select false';
      create function public.has_active_role(expected_role text) returns boolean language sql as 'select false';`)
    await db.exec(await readFile(new URL('../supabase/migrations/20260923090000_inventory_and_pos.sql',import.meta.url),'utf8'))
    await db.exec('drop function public.is_accountant() cascade')
    await db.exec(await readFile(new URL('../supabase/migrations/20260929100000_shop_workflows.sql',import.meta.url),'utf8'))
    assert.equal((await db.query("select count(*) from pg_policies where tablename in ('inventory_products','pos_sales','pos_sale_items') and policyname like 'Operational staff%'")).rows[0].count,3)
  } finally { await db.close() }
})
