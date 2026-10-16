# Stage 2: campus POS and scoped checkout recovery

Scope: dedicated accountant POS, admin POS access, campus receipt isolation and safe per-campus cart sessions. Parent campus separation remains Stage 3.

## User behavior

- Accountant navigation says Point of sale. Opening it goes directly to checkout. Only Point of sale and Sales & receipts tabs are available; no catalog editor, photos, sizes, manual stock, settings, audit or profit dashboards.
- Junior and Senior admins get POS and their own receipts alongside campus catalog management.
- Main Admin selects Junior or Senior in Checkout campus before a sale. Only that campus's items are loaded into the basket. Receipts display the sale campus.
- Carts, held baskets, customer/learner choices, amounts and pending requests are stored by user, active role and campus. Main Admin changing campus remounts the workspace and restores only that campus's state.
- Campus switching is disabled while checkout is running or its result is pending. Reopening a pending campus session uses the original request ID. Other role/campus sessions cannot silently inherit its basket.
- Old unscoped carts are not imported. An old pending checkout is retained and shown separately; starting another sale is blocked until Recover earlier checkout succeeds in its original campus using the original request ID. Failed recovery keeps the old pending record. No uncertain sale is silently discarded.
- Other accountant workspaces (Finance, Expenses, learner profiles, progress reports) are unchanged.

## SQL and API

Exact migration: `supabase/migrations/20261016160000_campus_pos_checkout.sql`.

- Six-argument complete_pos_sale adds p_campus and validates existing shop role/campus helpers on the server. Main Admin may choose either campus; campus admins/accountants may choose only their assigned campus. Missing campuses and parent/teacher roles are denied.
- The five-argument function remains as a safe compatibility wrapper: it takes the caller's actual assigned campus and calls the same six-argument implementation. Main Admin must use the new explicit-campus request.
- Remove any retained original three-argument non-idempotent checkout function.
- Retry lookup verifies both the original seller and campus. Product/variant locks, quantity aggregation, transactional stock deduction, payment parameters, and immutable name/price/cost/size snapshots remain.
- Drop broad legacy receipt policies and replace with campus reads using can_read_shop_campus. Historical NULL-campus receipts remain Main Admin-only.
- Direct client receipt inserts, updates and deletes are revoked. Checkout uses the secured transactional RPC.
- No fee, expense, parent ordering, payment-provider, reservation or financial balance code is changed.

## Verification

```sql
select version,name from supabase_migrations.schema_migrations where version='20261016160000';
select pg_get_function_identity_arguments(p.oid) from pg_proc p
join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='complete_pos_sale';
-- Exactly six-argument implementation plus five-argument safe wrapper; no three-argument endpoint.
select tablename,policyname,cmd,qual from pg_policies
where schemaname='public' and tablename in ('pos_sales','pos_sale_items');
select campus,count(*) receipts from pos_sales group by campus;
select campus,count(*) products,sum(quantity_on_hand) units from inventory_products group by campus;
```

Automated checks:

- `node --test tests/shop-campus-pos.test.mjs`: real helper bodies, both campus admins/accountants, Main Admin both campuses, wrong-campus and mixed baskets, safe old wrapper, duplicate request safety, unchanged snapshots and stock rollback.
- Existing Stage 1 and historical catalog/checkout SQL regression suites.
- `npm run test:portal`.
- `node tests/shop-catalog.browser.mjs`: actual components against isolated backend; Main Admin campus choice, cart/held-cart isolation, request interruption and retry after reload, original request ID reuse, legacy pending recovery, campus receipt labels and accountant-only POS tabs.
- Targeted lint and production build.

Live validation uses dedicated temporary products and rollback-only transactions. No real payments or committed test sales. Receipt sequence numbers may have gaps after rolled-back SQL test inserts; this does not create sales or change balances.

## Rollout baseline

22 products, all unassigned, stock 1001, four historical POS sales.

Product hash: 2d72be0f3f63c2d43240aa628d267d00.
POS sales hash: 4a31015fa11c60f90d25edd4422c6cc1.
POS lines hash: b6c62692b93ea8be9f0583c9c88f8496.
Parent order item hash: 20e61495548334d457d0d192a9b6c0a5.

Schema rollout must preserve all these records. Existing unassigned uniforms still need explicit Main Admin allocation before either campus can sell them.

## Deployment and recovery

Push tested code, apply only the reviewed Stage 2 migration transactionally with its history entry, then verify live policies/functions and GitHub/Vercel deployment status. Do not replay unrelated pending migrations. The safe five-argument wrapper lets existing scoped callers keep working while the frontend deploys. Do not restore the obsolete broad receipt policies or three-argument function if recovering a frontend failure.

## Status

Completed on 16 October 2026. Code pushed as e8f90be. Migration 20261016160000 applied and recorded transactionally in live project ejrtmdvnumjwikehzrrk. Both connected GitHub/Vercel checks reported success for this exact code commit. Authenticated hosted UI inspection is not confirmed; the deployment URLs use Vercel sign-in protection, as observed during Stage 1.

Portal tests: 6 passed. Shop SQL tests: 5 passed across the historical catalog/checkout, Stage 1 and Stage 2 suites. The mobile real-component browser workflow passed, including cart/held-cart campus isolation, interrupted response and retry after reload with the same request ID, and explicit legacy pending recovery. Targeted lint and production build passed.

Live rollback-only tests using existing identities passed for Junior/Senior admins and accountants: own-campus sales allowed, legacy wrapper and repeated requests returned the same sale, stock deducted once, wrong campus denied, cross-campus receipt reads returned zero rows. Accountants still could not edit products. Main Admin could explicitly sell in both campuses but could not reuse one request ID across campuses. Parent and teacher sales/receipt access were denied. Temporary products and test sales were rolled back; no real payments were made.

The final live product, POS sale, POS line and parent order hashes exactly match the baseline above. Existing data remains 22 unassigned products, 1001 stock units and 4 historical POS sales. Only the secured six-argument function and five-argument wrapper remain. An anonymous call to the new six-argument REST endpoint returned HTTP 401/code 42501 (permission denied), confirming the route is live and rejects unauthenticated calls.

Main Admin allocation is still required before campus POS catalogs have real sale items. Stage 3 selected-learner parent campus separation remains pending.
