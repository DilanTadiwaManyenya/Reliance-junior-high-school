# Uniform catalog: rollout and verification

Live rollout completed on 16 October 2026 at the user’s request. Both catalog migrations were applied atomically to project `ejrtmdvnumjwikehzrrk`, recorded in migration history, and the PostgREST schema cache was refreshed. The nested `inventory_products?select=id,product_variants(id)&limit=0` API query returned HTTP 200. Bucket settings, four Storage policies, image_url, the foreign key and variant RLS were verified. Rollback-only tests using existing parent and teacher identities confirmed product/image insert denial and zero editable product rows; the parent could read 21 active uniforms. The catalog remained at 22 products and existing history at one parent order. Real binary photo upload and an authenticated browser purchase were not performed during this rollout.

## Inspection before changes

- Admin module: `src/components/portal/InventoryPOS.jsx`. Catalog source: `public.inventory_products`.
- Parent module: `src/components/portal/ParentUniformShop.jsx`. It already queried active Uniforms products, but displayed an RLC/initials placeholder. There was no image URL column, image-file list, or product-photo list.
- An Edit product modal and active flag already existed. This phase extends them.
- There were no variants. The user explicitly approved a minimal `product_variants` table with per-size stock during this phase.
- POS already stored product_name, unit_price and unit_cost in pos_sale_items. Parent orders already stored name and unit_price inside items JSON, initially supplied by the cart. The size migration adds database-authoritative name/price/size snapshots for new parent orders. Existing orders are not rewritten.

## Scope and access

Uses existing `is_main_school_admin()`, `has_active_role(text)` and `accountant_can_access_campus(text)` helpers. The existing shop reserves administration for Main Admin (campus all); campus accountants gain catalog management within their existing campus. Campus administrators are not newly granted school-wide shop access. Parent and teacher active roles have no catalog or storage writes. Public image reads do not make order or inventory data public.

New image paths use `junior/<uuid>.webp` or `senior/<uuid>.webp` (PNG fallback if the browser cannot encode WebP). Replacing a photo writes a fresh path so cached old photos do not persist. The old file is removed only after the product update succeeds. An interrupted database save may leave an unreferenced uploaded file; do not delete it until confirming the product save outcome. Public image removal cannot revoke copies already downloaded by visitors.

No fee code or payment-method behavior is changed. POS keeps the existing campus-accountant restriction, payment parameters and request-id retry behavior. Its stock checks/deductions now select a size when needed. Parent orders remain pending requests for school verification; this phase does not introduce reservations or automatic stock deduction for those requests.

## Manual step 1: preflight

In Supabase Dashboard, select project `ejrtmdvnumjwikehzrrk`, then SQL Editor. Run:

```sql
select current_database(), now();
select to_regprocedure('public.is_main_school_admin()') as main_admin_helper,
       to_regprocedure('public.has_active_role(text)') as role_helper,
       to_regprocedure('public.accountant_can_access_campus(text)') as campus_helper;
select table_name from information_schema.tables
where table_schema='public' and table_name in
  ('inventory_products','pos_sales','pos_sale_items','parent_uniform_orders');
select column_name, data_type from information_schema.columns
where table_schema='public' and table_name='inventory_products'
order by ordinal_position;
select schemaname,tablename,policyname,cmd,roles,qual,with_check
from pg_policies where (schemaname='storage' and tablename='objects')
   or (schemaname='public' and tablename='inventory_products')
order by schemaname,policyname;
```

All three helper names and all four tables must exist. Review any additional broad Storage policies: PostgreSQL permissive policies combine with OR, so another policy allowing all buckets can undermine a bucket-specific restriction. The migration intentionally does not rewrite policies belonging to other features.

The SQL below is retained for reproducible manual verification; it has now been applied live as recorded above. Do not run an unrestricted `db push`: the repo also contains an unrelated pending migration from a previous phase.

## Manual step 2: images, bucket and catalog management

Open and run the entire exact SQL file:

`supabase/migrations/20261016120000_manage_shop_catalog_images.sql`

It runs in a transaction, adds nullable image_url, creates/updates the public bucket, limits files to 2097152 bytes and JPG/PNG/WebP, installs Storage policies and campus accountant catalog management, allows parent visibility of active out-of-stock uniforms, and prevents deleting ordered products.

Verify each part:

```sql
-- Expect image_url, text, YES (nullable).
select column_name,data_type,is_nullable from information_schema.columns
where table_schema='public' and table_name='inventory_products' and column_name='image_url';

-- Expect exactly one public bucket, 2097152 bytes, three allowed MIME types.
select id,name,public,file_size_limit,allowed_mime_types from storage.buckets
where id='product-images';

-- Expect SELECT/public, INSERT/authenticated, UPDATE/authenticated, DELETE/authenticated.
select policyname,cmd,roles,qual,with_check from pg_policies
where schemaname='storage' and tablename='objects' and policyname in
 ('Public catalog image reads','Catalog staff upload images',
  'Catalog staff replace images','Catalog staff remove images') order by cmd;

-- Expect accountant management with existing role/campus helpers and parent active filter.
select policyname,cmd,qual,with_check from pg_policies
where schemaname='public' and tablename='inventory_products'
order by policyname;

-- Expect enabled trigger, and function checking both POS and JSON parent order history.
select tgname,tgenabled from pg_trigger where tgrelid='public.inventory_products'::regclass
and tgname='protect_ordered_catalog_product';
select pg_get_functiondef('public.protect_ordered_catalog_product()'::regprocedure);
```

## Manual step 3: approved sizes

Run the entire exact SQL file AFTER step 2:

`supabase/migrations/20261016130000_shop_product_size_variants.sql`

Sizes share the product selling price and cost; stock and optional SKU are per size. No existing stock is automatically moved or guessed. Unsized products retain their stock field. For sized products, inventory_products.quantity_on_hand becomes the sum of visible size stocks; direct total edits are rejected. Size rows can be hidden and renamed, not deleted independently.

For a NEW sized product: create it with zero opening stock, save, reopen Edit product, and add each size and its stock. For EXISTING stock, record its current count, use the existing Main Admin stock adjustment to move unsized stock to zero, and then add those same quantities to sizes. Perform conversion while that item is hidden and no checkout is in progress. Verify totals before showing it again.

Verify:

```sql
select column_name,data_type,column_default from information_schema.columns
where table_schema='public' and table_name='inventory_products' and column_name='has_variants';
select column_name,data_type,is_nullable from information_schema.columns
where table_schema='public' and table_name='product_variants' order by ordinal_position;
select indexname,indexdef from pg_indexes where schemaname='public' and tablename='product_variants';
select policyname,cmd,qual,with_check from pg_policies
where schemaname='public' and tablename='product_variants';
select c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('inventory_products','product_variants','parent_uniform_orders');
select column_name,data_type from information_schema.columns
where table_schema='public' and table_name='pos_sale_items' and column_name in ('variant_id','size_label');
select tgrelid::regclass as table_name,tgname,tgenabled from pg_trigger
where not tgisinternal and tgname in ('lock_catalog_variant_product','sync_catalog_variant_stock',
  'guard_catalog_variant_total','snapshot_parent_catalog_items');
select pg_get_functiondef('public.complete_pos_sale(jsonb,text,text,uuid,numeric)'::regprocedure);
select pg_get_functiondef('public.snapshot_parent_catalog_items()'::regprocedure);

-- Expect no rows: sized-product totals agree with visible size stock.
select p.id,p.name,p.quantity_on_hand,coalesce(sum(v.quantity_on_hand) filter(where v.active),0) as size_total
from public.inventory_products p left join public.product_variants v on v.product_id=p.id
where p.has_variants group by p.id
having p.quantity_on_hand<>coalesce(sum(v.quantity_on_hand) filter(where v.active),0);
```

## Manual step 4: migration history (only after SQL succeeded)

SQL Editor execution does not automatically record CLI migration history. Run this after steps 2 and 3 are verified:

```sql
insert into supabase_migrations.schema_migrations(version,name)
values ('20261016120000','manage_shop_catalog_images'),
       ('20261016130000','shop_product_size_variants')
on conflict(version) do nothing;
select version,name from supabase_migrations.schema_migrations
where version in ('20261016120000','20261016130000') order by version;
```

## Manual step 5: deploy frontend once

Deploy this phase's frontend after both SQL files are applied. Subsequent product names, categories, prices, thresholds, sizes and photos are managed entirely through the portal without code changes or redeploying. Parent catalog reads only active `Uniforms` products; category is deliberately set to Uniforms for catalog items. Other shop inventory remains staff-only. The Refresh catalog button, window focus, and 30-second polling pick up changes, including hidden items no longer visible under RLS.

## Live acceptance plan

Use dedicated test items and authorized school test accounts, not real payments.

1. Main Admin: Products → Add product. Set category Uniforms, campus, price, cost, threshold, zero opening stock; choose a JPG/PNG/WebP <=2 MB. Confirm preview appears before Save. Save, reopen Edit product, add Small stock 4 and Large stock 2. Confirm total 6. Try SVG, corrupt image and >2 MB file; each must be rejected before upload. A large-dimension valid photo should be resized to <=1000px on its longest side.
2. Parent on another tab/device: Refresh catalog, see photo and sizes Small/4 and Large/2 without a redeploy. A zero-stock size should be shown as out of stock and unavailable for selection. Select a size and place a test request using the existing payment workflow. Verify Recent uniform orders displays the submitted name, size and unit price.
3. Admin: replace the photo, save; parent Refresh catalog must show the new file. Remove the photo and save; parent must see the clean placeholder. Check the URL changes on replacement and the old object is removed after success.
4. Admin: rename product, change price and threshold; confirm existing parent order and POS receipt keep the OLD name, price and size. Hide via Show in shop checkbox and save; parent Refresh catalog must remove the item while Recent uniform orders retains it. Re-show it from the Hidden filter.
5. Admin: attempt Delete unused product on the ordered item; expect the history protection error. A dedicated never-ordered product may be deleted. Existing POS product foreign keys remain intact.
6. Junior accountant: create/edit Junior items and photos; attempt direct Senior catalog or storage writes and verify RLS denial. Teacher and parent: verify catalog management controls are absent; test direct writes with the SQL role probe below. Main Admin switched to Teacher active role must also lose management access.
7. POS campus accountant: select Small and Large separately, complete a test sale using the existing payment procedure. Confirm only those size quantities decrease and total agrees. Retry the same request ID; no second deduction. Inspect receipt size label. Do not run a real charge as part of this catalog test.

Verify real saved data after each successful UI action:

```sql
select id,name,category,campus,active,image_url,selling_price,cost_price,reorder_level,has_variants,quantity_on_hand
from public.inventory_products order by updated_at desc limit 20;
select id,product_id,size,sku,quantity_on_hand,active from public.product_variants order by created_at desc limit 20;
select bucket_id,name,metadata->>'mimetype' as mime,metadata->>'size' as bytes
from storage.objects where bucket_id='product-images' order by created_at desc limit 20;
select id,items,total,payment_status,created_at from public.parent_uniform_orders order by created_at desc limit 10;
select sale_id,product_id,variant_id,product_name,size_label,unit_price,unit_cost,quantity
from public.pos_sale_items order by id desc limit 20;
```

Copy a saved image_url into a signed-out/incognito browser: it must display without authentication. In browser Network, the parent inventory request must filter `active=eq.true` and category Uniforms and select image_url plus product_variants. History must read the stored parent order items, without joining current product names/prices.

## Optional live denial probe (rollback only)

Select an existing parent or teacher UUID (do not change their active role). Replace the placeholder below. Run as SQL Editor owner. It temporarily impersonates the authenticated role inside a transaction, reports blocked writes, and rolls everything back. Repeat for both accounts. Do NOT use a privileged service-role connection to test RLS without SET ROLE.

```sql
begin;
select set_config('request.jwt.claims', '{"sub":"REPLACE_WITH_PARENT_OR_TEACHER_UUID","role":"authenticated"}', true);
set local role authenticated;
select auth.uid(),public.has_active_role('parent'),public.has_active_role('teacher');
do $$
begin
  begin
    insert into public.inventory_products(name,category,campus,selling_price)
      values('RLS probe','Uniforms','junior',1);
    raise warning 'FAIL: catalog insert unexpectedly allowed';
  exception when insufficient_privilege then raise notice 'PASS: catalog insert denied'; end;
  begin
    insert into storage.objects(bucket_id,name) values('product-images','junior/rls-probe.webp');
    raise warning 'FAIL: image insert unexpectedly allowed';
  exception when insufficient_privilege then raise notice 'PASS: image insert denied'; end;
end $$;
-- Both must return zero rows. Scope is only the temporary probe name.
update public.inventory_products set name='RLS probe changed' where name='RLS probe' returning id;
update storage.objects set name='junior/rls-probe-changed.webp'
where bucket_id='product-images' and name='junior/rls-probe.webp' returning id;
rollback;
```

This tests Storage metadata RLS, not file binary processing. The isolated automated browser test covers upload/resize/compression and replacements; live admin upload and signed-out read complete the end-to-end verification.

## Automated verification

- `node --test tests/shop-catalog-database.test.mjs`: actual project helper bodies in isolated PostgreSQL; admin/accountant allowed; parent/teacher writes denied; campus restrictions; hide visibility; public image reads; deletion guard; variants; snapshots; retry-safe POS deductions.
- `npm run test:shop`: existing checkout/stock regression suite.
- `node tests/shop-catalog.browser.mjs`: mobile real-component workflow using an isolated in-memory backend. Requires the existing Playwright runtime (`PLAYWRIGHT_MODULE` if outside node_modules; `PLAYWRIGHT_CHANNEL=msedge` works with installed Edge).
- `npx eslint src/lib/productImages.js src/lib/shopCatalog.js src/components/portal/ProductImage.jsx src/components/portal/ProductVariants.jsx src/components/portal/ParentUniformShop.jsx src/components/portal/ParentUniformOrderHistory.jsx src/components/portal/InventoryPOS.jsx`
- `npm run build`

There is no hard-coded production catalog or image list. The historical SQL seed and test fixtures contain sample products only; the app does not import them. Live application of SQL, deployment and real-account smoke testing are separate from isolated test results.
