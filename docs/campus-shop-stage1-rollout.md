# Stage 1: campus admin catalog and explicit stock allocations

16 October 2026. Scope: product/size/photo management and legacy stock allocation. Dedicated accountant POS and admin checkout are Stage 2; selected-learner parent isolation is Stage 3.

## Behavior

- Main Admin gets Both campuses, Junior, Senior and Unassigned catalog views.
- Junior/Senior admins get their own inventory workspace, fixed campus on creation, size stock and photo management, and unsized stock receipt/adjustment. Campus admins do not load global shop preferences, audit logs or sales analytics.
- Accountants with Junior/Senior campus retain existing sale/receipt access but lose product, size, stock adjustment and photo mutations in both UI and RLS. Invalid/null campus accounts do not get shop access. Shared finance helpers and fee/expense logic are unchanged.
- Assigned products cannot move to another campus through ordinary updates, including Main Admin updates. Product variants inherit their product's campus and cannot move products.
- Main Admin opens an Unassigned product, selects a campus and enters Allocation quantity. The full quantity assigns that row. A positive smaller quantity creates a separate campus row and leaves the remainder unassigned, atomically conserving stock. The generated campus SKU suffix avoids reusing the source SKU. Existing sized products must be allocated as a whole.
- When splitting, edits in the editor apply to the new campus row, not the remaining unassigned row. The source record and its order history stay intact. A managed photo is copied to the destination campus before saving and the source photo is retained on partial allocation.
- Stock is never duplicated or allocated automatically. New orders for unassigned items are rejected; existing historical orders remain intact.

## Migration

Exact SQL: `supabase/migrations/20261016150000_campus_admin_catalog_allocations.sql`.

Apply only this migration, in a transaction, and record version 20261016150000 in supabase_migrations.schema_migrations. Do not use an unrestricted db push: there is an unrelated pending migration from an earlier phase. The rollout will reload the PostgREST schema cache.

## Baseline before rollout

- Products: 22; unassigned: 22; stock total: 1001.
- Parent orders: 1.
- Catalog row hash: 2d72be0f3f63c2d43240aa628d267d00.
- Parent order item hash: 20e61495548334d457d0d192a9b6c0a5.

The migration itself must not change those rows, quantities, assignments or historical snapshots.

## Verification SQL

```sql
select version,name from supabase_migrations.schema_migrations where version='20261016150000';
select campus,count(*) products,sum(quantity_on_hand) stock from inventory_products group by campus;
select md5(coalesce(jsonb_agg(to_jsonb(p) order by id)::text,'[]')) as product_hash from inventory_products p;
select count(*) orders,md5(coalesce(jsonb_agg(items order by id)::text,'[]')) as order_hash from parent_uniform_orders;
select tablename,policyname,cmd,qual,with_check from pg_policies
where (schemaname='public' and tablename in ('inventory_products','product_variants'))
   or (schemaname='storage' and tablename='objects' and policyname like '%Catalog%')
order by tablename,policyname;
select pg_get_functiondef('public.can_manage_shop_campus(text)'::regprocedure);
select pg_get_functiondef('public.can_read_shop_campus(text)'::regprocedure);
select tgname,tgenabled from pg_trigger where tgname in ('guard_shop_product_allocation','a_require_assigned_order_products');
```

Live role probes should impersonate existing active roles only inside a rollback transaction, verify their active role, and test allowed/denied writes under SET LOCAL ROLE authenticated. Use temporary product/image metadata, not real sales or permanent account changes. Public signed-out image reads remain allowed. Test actual binary uploads separately through the UI using a dedicated test item.

## Automated checks

- `node --test tests/shop-campus-admin.test.mjs`: real helper bodies in isolated PostgreSQL; scoped admin catalog/stock/images/sizes; denied accountant mutations; no access for unassigned accounts; immutable campus ownership; valid allocation and rollback of invalid splits; total preservation.
- `node tests/shop-catalog.browser.mjs`: existing mobile photo/size/history workflow plus Main Admin explicit split, campus photo copy, retained source photo, Unassigned filter, locked campus-admin creation, and missing accountant editor controls. Uses isolated backend, not live school accounts.
- `npm run test:portal` and existing shop database suites protect unrelated portal and checkout behavior.
- Targeted lint and production build.

## Acceptance after hosted deployment

1. Main Admin: Inventory & POS → Products → Catalog campus: Unassigned. Review all 22 records before choosing campuses.
2. Select a product, choose Junior or Senior and explicitly choose the allocation quantity. Verify the remaining + allocated quantity equals the old quantity. For stock sold in both schools, allocate a partial amount to one school, then allocate the remaining original to the other.
3. Junior/Senior admin: Inventory & POS opens the campus catalog. Create an item and photo; campus is fixed. Neither catalog query nor direct writes may access the other campus.
4. Junior/Senior accountant: Products editing, photo upload, variant editing, direct inventory writes and stock adjustment RPC must fail. Existing permitted POS sale RPC remains unchanged in Stage 1.
5. Confirm previous orders still display their original name/price/size. Unassigned products intentionally disappear from parent/campus catalog until Main Admin allocates them. Full parent selected-learner campus separation still requires Stage 3.

## Recovery notes

The migration is transactional and rerunnable. Failed SQL application rolls back. Failed stock splits roll back both stock reduction and the new row. Interrupted image copying/saving can leave an unused image: confirm saved product state before cleanup. Do not reverse completed allocations blindly or replay older migrations to re-enable accountant editing. If frontend deployment fails, keep the stricter server permissions, restore/fix the frontend, and verify the hosted asset revision before directing staff to allocate stock.

## Rollout status

Code and isolated tests prepared. Live application and hosted deployment verification are recorded below after execution; no automatic stock allocation is part of deployment.
