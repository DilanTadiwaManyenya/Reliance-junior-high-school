# Stage 3: parent uniforms by selected learner campus

Scope: verified learner catalog visibility, learner-switch state isolation, server-side order campus enforcement and historical order preservation. No payment methods, provider calls, fees or stock-reservation behavior are changed.

## Parent experience

- The parent page loads verified learner links. The shop confirms the selected learner's actual active campus through parent_shop_student_campus before querying products.
- Product queries explicitly filter category Uniforms, active=true and campus equal to that verified learner's campus. Size options inherit product visibility.
- A family with Junior and Senior children sees only the selected learner's uniforms. A direct inventory query can access the union of campuses of that parent's active verified learners, but never an unrelated campus; new orders must still match the exact selected student.
- Changing learner, parent account, campus or enrollment status remounts the shop. Catalog, cart, size selections and payment-entry fields reset immediately. Late catalog responses from the previous learner are ignored. History remounts by parent/student so another learner's old results cannot flash or overwrite the selected history.
- Missing campus and inactive learners cannot order. Their own verified historical orders can still display; current product names, availability and prices are not joined into history.
- Unverified or revoked links cannot load the catalog or read order history. A changed link/campus during refresh disables checkout and asks the parent to reload learners. No all-campus fallback.

## Supabase

Exact migration: `supabase/migrations/20261016170000_parent_uniform_campus_isolation.sql`.

- Shop-specific helpers compose existing has_active_role('parent'), parent_student.verified_at, students.status and students.campus. No role memberships or learner assignments are created by deployment.
- Product and variant SELECT policies require an active verified linked learner in that product's campus.
- Parent order INSERT verifies the signed-in parent and exact selected learner. The snapshot trigger validates each product against the learner's database campus, not client-supplied campus/name/price. Dual-campus families cannot mix products into another child's order or attach another parent's learner.
- Existing quantity/size checks and database name/price/size snapshots remain. New parent orders remain requests for school verification, with no automatic stock deduction or reservation.
- Parent order SELECT requires ownership and a current verified learner link, without requiring the learner to remain active or have a currently assigned campus. This preserves legitimate legacy/inactive learner history while blocking unverified links.
- The old broad staff order policy is replaced so campus accountants cannot read/manage another campus's uniform orders. Main Admin retains access. Existing verification workflow and payment fields are unchanged.
- No existing product, learner, link, order or receipt row is rewritten.

## Verification SQL

```sql
select version,name from supabase_migrations.schema_migrations where version='20261016170000';
select tablename,policyname,cmd,qual,with_check from pg_policies
where schemaname='public' and tablename in ('inventory_products','product_variants','parent_uniform_orders')
order by tablename,policyname;
select pg_get_functiondef('public.parent_has_verified_shop_student(uuid)'::regprocedure);
select pg_get_functiondef('public.parent_shop_student_campus(uuid)'::regprocedure);
select pg_get_functiondef('public.parent_can_browse_shop_campus(text)'::regprocedure);
select pg_get_functiondef('public.snapshot_parent_catalog_items()'::regprocedure);
```

When authenticated as a parent, the RPC query below must return only the selected verified active learner's actual Junior/Senior campus, or NULL if not authorized:

```sql
select public.parent_shop_student_campus('REPLACE_WITH_SELECTED_STUDENT_UUID'::uuid);
```

Test RLS under SET LOCAL ROLE authenticated and the actual account's JWT subject, not as the SQL owner. Do all impersonation and test orders inside a rollback transaction. Test at least Junior-only, Senior-only, dual-campus, unverified and revoked links. Do not permanently create test links or place real payments.

## Baseline before migration

Products: 22, all unassigned; stock 1001; parent orders 1.

- Product row hash: 2d72be0f3f63c2d43240aa628d267d00.
- POS sale hash: 4a31015fa11c60f90d25edd4422c6cc1.
- Full parent order row hash: d648ba894f80aab19b6deee2e1dff7f6.
- Parent/student link row hash: bec429805d5f6877176fd0f7abba1d2e.

The live baseline had two active verified learners, both Senior. Dual-campus live probes can temporarily link existing active Junior/Senior learners inside a rollback-only transaction; do not invent learner identities or retain those links.

## Automated and acceptance tests

- `node --test tests/shop-parent-campus.test.mjs`: actual helper bodies and restricted roles; catalog/size isolation; verified, unverified and revoked links; forged parent/learner IDs; mixed-campus products and wrong variants; active/campus requirements; preserved historical snapshots and stock; staff order scope.
- `node tests/shop-catalog.browser.mjs`: real components and isolated backend; Junior/Senior family switching, clean carts/size selection/history, delayed Junior response after switching Senior, missing/inactive/unverified cases, and preserved old order display. Also protects earlier photos, admin allocation and POS workflows.
- `node tests/portal-parent-mobile.browser.mjs`: real parent page layout/route coverage and the four existing uniform payment-method submissions.
- Portal tests and Stage 1/2 database regressions; targeted lint and production build.

After deployment: parent selects Junior child → only Junior products and sizes; adds an item → switches Senior child → Junior catalog, cart and history disappear immediately; Senior order uses Senior child ID and Senior items only. Back to Junior → empty cart and fresh size selection. Renaming/hiding a product must not change old order name/price/size. A parent with no verified learner or missing campus must never receive an all-school catalog.

## Rollout and recovery

Push the tested stage, apply only this migration transactionally with its history entry, and verify the live policy/function definitions, rollback-only role/order probes, baseline hashes and deployment status. Reload the PostgREST schema cache. Do not run unrelated pending migrations.

If the frontend cannot confirm a learner campus, keep ordering unavailable and fix the helper/deployment; do not remove the campus filter or restore a broad parent policy as a workaround. Existing unassigned products still require explicit Main Admin allocation and will not appear for either campus until then.

## Status

Completed 16 October 2026. Code commit d1655bf is pushed to master. Migration 20261016170000 is applied to linked Supabase project ejrtmdvnumjwikehzrrk; its migration history entry is present and the schema reload was requested.

Live authenticated rollback-only probes passed: Junior-only saw Junior products only; Senior-only saw Senior products only; dual-campus parents could browse both authorized campuses but could not mix campuses into one learner's order; unverified links could neither browse products nor order. Correct learner-campus orders succeeded. Revoked-link and teacher helper checks passed. Temporary products, links and orders were rolled back, and parent requests did not deduct stock.

All four baseline hashes above match after verification: products, POS receipts, full parent orders and parent/student links are unchanged. The 22 existing products remain unassigned and require deliberate Main Admin allocation.

Passed: Stage 1/2/3 database regression suites, six portal tests, expanded catalog browser suite, parent mobile browser coverage (72 layouts and four payment-method submissions), targeted lint and production build. Existing build bundle-size warning remains. Missing/inactive learner cases and late responses were covered by isolated SQL/browser tests; live role probes used existing active learners with temporary links inside the rollback transaction.

Both Vercel project deployment statuses for d1655bf report success. Hosted authenticated UI was not independently inspected because deployment URLs redirect to Vercel sign-in; local real-component browser checks passed. Stage 4 final acceptance remains pending.

