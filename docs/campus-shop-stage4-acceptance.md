# Stage 4: campus shop acceptance

16 October 2026. Technical acceptance for Stages 1–3; stock allocation remains an operational task.

## Reproducible checks

- `npm run test:shop:campus`: six database tests across the original shop, image catalog, campus admin, campus POS and parent campus suites. Passed. Restricted authenticated roles exercise actual migration/helper bodies, rather than UI-only permission mocks.
- `npm run test:shop:browser`: full real-component catalog/POS/parent workflow at 390px and 1280px. Covers Main Admin allocation/photo copying, both campus admins, both campus accountants, campus switching, pending checkout recovery, photo preview/compression/upload/replacement/removal, variants, parent visibility, dual-campus learner switching and delayed responses.
- `node tests/portal-navigation.browser.mjs`: passed all 16 role/viewport combinations (320, 390, 768, 1024px), including role switching, drawer focus and scrolling.
- Targeted ESLint for acceptance scripts passed; production build passed with the existing large-bundle warning.

Browser runtime: Playwright must be resolvable or supplied through PLAYWRIGHT_MODULE; PLAYWRIGHT_CHANNEL can select installed Edge. This workspace used the bundled Playwright package and msedge. Browser backend fixtures isolate these tests from real payments and stock.

## Live Supabase verification

Linked project: ejrtmdvnumjwikehzrrk. All three stage migration history entries are present: 20261016150000, 20261016160000, 20261016170000. No additional migration is required for Stage 4 and no unrelated pending migration was applied.

Rollback-only probes against real existing identities passed again:

| Actor | Own campus catalog management | POS and own receipts | Cross-campus action |
| --- | --- | --- | --- |
| Junior admin | Product insert/edit, variant edit and image metadata insert allowed | Allowed; retry returns same sale | Denied |
| Senior admin | Product insert/edit, variant edit and image metadata insert allowed | Allowed; retry returns same sale | Denied |
| Junior accountant | Product/variant/image mutations denied | Allowed; no Senior receipts | Denied |
| Senior accountant | Product/variant/image mutations denied | Allowed; no Junior receipts | Denied |
| Main Admin | Stock split conserves quantity | Both campuses; explicit campus and separate retry scope | Mixed-campus sale denied |
| Parent / teacher | No staff catalog management | POS denied | Denied |

Parent probes: Junior-only and Senior-only visibility, authorized dual-campus browsing, correct learner-campus orders, mixed-campus order denial, unverified/revoked links and teacher helper denial all passed. Temporary learner links, products, images metadata, orders and receipts were rolled back. No binary image was uploaded to live Storage by these tests. Browser photo upload/replacement uses an isolated backend; an authenticated hosted binary-upload smoke test remains an operational acceptance check.

Live policy inspection confirmed: product/variant management uses can_manage_shop_campus; staff reads/receipts use can_read_shop_campus; parent catalog requires verified active learner campus; parent orders verify the exact learner and preserve snapshots; Storage mutation is restricted to campus admin paths. Public image reads remain intentional. Product-images is public, accepts JPEG/PNG/WebP and has a 2097152-byte limit.

Live REST: inventory_products?select=id,product_variants(id)&limit=1 returned HTTP 200 (anonymous result empty as expected). The relationship is backed by the product_variants.product_id foreign key. Anonymous parent_shop_student_campus returned HTTP 401 / 42501, not a missing-RPC/schema-cache error.

SQL regression tests also confirm hidden-product rules, ordered-product deletion protection, stock aggregation, size validation, zero/insufficient stock, checkout rollback/idempotency, immutable price/name/size snapshots and parent requests without stock deduction. Parent mobile/payment-method regression results are recorded in Stage 3; no payment/fee behavior changed in this stage.

## Remaining allocations, observed live

The latest read-only audit supersedes earlier rollout counts: 22 products and 1001 total units remain, but one product is now allocated to Senior (32 units). The other 21 products (969 units) are unassigned. Junior has no assigned products yet. These observations reflect current live catalog activity; this acceptance run did not retain any allocations. Do not compare old product row hashes as proof of unchanged data across legitimate intervening edits.

Current admin/accountant memberships: one Main Admin (all), one Junior admin, one Senior admin, one Junior accountant and one Senior accountant. All five have valid campus assignments; zero current admin/accountant memberships need campus assignment. This count includes all memberships, not just the currently active role.

Main Admin should open Inventory & POS → Products → Unassigned and allocate each remaining product to Junior or Senior. If shared, enter the actual quantity going to each campus using the split control, preserving the original total. Sizes must reflect actual counts. No stock split or membership is guessed. Unassigned products intentionally remain invisible to parents and campus staff.

## Hosted acceptance and release

Both connected Vercel projects reported success for 283a57f (Stage 3 implementation and verification). Final Stage 4 deployment status is recorded after push. Hosted authenticated UI inspection remains unverified because deployment URLs redirect to Vercel sign-in; local real-component tests and live database/API checks are separate evidence.

After allocation, sign in through the normal school portal: create a dedicated campus test uniform with photo as its admin; confirm it appears for that campus parent without redeployment; replace the image; hide/show it; verify the other campus parent never sees it. Confirm accountants have only POS/receipts within Inventory & POS and cannot upload/edit/delete. Confirm previous orders retain their recorded name, unit price and size. Delete the test product only if never ordered. Use no real payments for this check.

Technical checks can pass while operational allocation remains incomplete. Full business rollout requires the remaining 21 product allocations and the hosted signed-in photo/access smoke check.
