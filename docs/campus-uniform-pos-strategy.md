# Campus uniform catalog and POS strategy

Status, 16 October 2026: Stages 0–3 are deployed and verified. Stage 4 technical acceptance is recorded in campus-shop-stage4-acceptance.md; operational allocation and hosted signed-in acceptance remain open. Latest live audit: 21 unassigned products (969 units), one Senior product (32 units), no Junior products. All five current admin/accountant memberships have valid campuses. Earlier stage counts are historical; no allocation quantities or campus memberships were guessed.

## Agreed target

| Active role | Catalog and images | Stock and sizes | POS | Campus scope |
| --- | --- | --- | --- | --- |
| Main Admin | Add, edit, hide, show; delete only never-ordered products | Manage both campuses | Access both campus POS workspaces | Junior and Senior; explicit campus selection for checkout |
| Junior Admin | Manage Junior products and images | Manage Junior stock and sizes | Junior POS access | Junior only |
| Senior Admin | Manage Senior products and images | Manage Senior stock and sizes | Senior POS access | Senior only |
| Junior Accountant | Read sale items; no catalog/image management | Read availability; no manual stock/size edits | Sell, retry checkout and view necessary receipts | Junior only |
| Senior Accountant | Read sale items; no catalog/image management | Read availability; no manual stock/size edits | Sell, retry checkout and view necessary receipts | Senior only |
| Parent | Active Uniforms products for selected verified linked learner | Read visible sizes and availability | Existing parent order request workflow | Selected learner's campus |
| Teacher / other roles | No staff catalog management or POS | None | None | No new permissions |

POS stock deductions are allowed only through the existing authenticated checkout RPC; that does not grant accountants direct UPDATE access to products or variants. Existing fee, expense and payment workflows stay outside this change. Main Admin's access to both campuses must not make a basket span two campuses.

## Stage 0 findings

Read-only live audit of linked Supabase project ejrtmdvnumjwikehzrrk:

- 22 inventory_products rows; all have campus NULL.
- Active roles include Junior and Senior admins, Main Admin (all), Junior and Senior accountants, plus one admin and one accountant with campus NULL.
- The accountant workspace already has an Inventory & POS entry. Availability is not solved simply by adding another link: products have no campus and the server only permits accountants with Junior/Senior campus to complete checkout.
- StaffDashboard and PortalSidebar exclude campus admins from inventory. InventoryPOS combines catalog management with accountant access, defaults to Overview, and exposes multiple tabs.
- The current image and variant policies grant management to accountants. Those policies must be replaced, not supplemented with restrictive-looking permissive policies (which would combine with OR).
- Parents currently read active uniforms across campuses, without linking the product to a verified learner's campus. ParentUniformShop also has no selected-learner campus filter.
- Order snapshots already preserve names, prices and sizes. New campus enforcement must keep historical snapshots intact.

Relevant files: InventoryPOS.jsx, ProductVariants.jsx, ParentUniformShop.jsx, ParentUniformOrderHistory.jsx, AccountantWorkspaceNav.jsx, PortalSidebar.jsx, StaffPortalLayout.jsx, StaffDashboard.jsx and catalog/checkout Supabase migrations.

## Stage 1 — Main Admin allocations and campus admin catalog

Deliver a migration and matching admin UI as one tested stage.

- Keep inventory_products.campus as the source of campus ownership; variants inherit their product's campus.
- Main Admin gets Junior, Senior and Unassigned views. Unassigned rows remain accessible to Main Admin for review.
- Allow Main Admin to allocate a legacy product once. Do not silently infer the campus from its name, category, current editor or previous order.
- Campus admins get their catalog workspace and have their own campus fixed in product creation, edits, size management and image paths.
- Prevent ordinary edits from moving already assigned products or variants across campuses; enforce this on the server as well as by disabling the selector.
- A product stocked in both schools uses separate product records and stock balances. Do not copy the same 22 existing stock balances into both campuses. Any division of existing stock must preserve the total and require explicit quantities entered by Main Admin.
- Rows with NULL campus remain Main Admin-only until allocated. Staff accounts with NULL/invalid campus receive no campus POS/catalog access; do not assign new roles or campuses speculatively.
- Correct catalog/image/variant write policies to allow only active admins within their campus, with Main Admin access to both. Revoke accountant catalog and image writes in Supabase, not only in the UI.
- Preserve ordered-product deletion guards and public image reads. When allocating a product, check whether its managed image path agrees with the selected campus; copy an existing image through Storage if needed rather than relabeling another campus's path.

Checks: Main Admin sees 22 unassigned rows; each campus admin can manage a test item only in their own campus; direct cross-campus writes and accountant writes fail; existing product/order counts and stock totals are unchanged by schema migration alone.

Push: tested code, exact SQL, rollback notes and verification queries. Apply only the stage migration, verify live, then push its rollout record. No unrestricted db push.

## Stage 2 — Dedicated campus POS for accountants and admin POS access

- Expose an explicit POS entry in the accountant workspace and open it directly in checkout mode.
- Accountants have POS controls and their own campus receipts only; no Products editor, Add product, Hide/Show, Delete, photo uploads, size editing, stock adjustments, shop settings or admin audit tools.
- Admins retain the inventory workspace and can open POS within their authorized campus. Main Admin selects Junior or Senior before selling.
- Update the checkout RPC to accept an explicit campus when required by Main Admin, validating it against the active role on the server. Keep old callers compatible during rollout using a deliberate wrapper/default strategy; leave no older callable RPC that can bypass the new checks.
- Products and variant stocks are selected under campus restrictions on the server. Never trust a campus supplied by the browser as authorization.
- Keep request-id retry protection, transaction rollback, price/cost/size snapshots and payment parameters. Never deduct another campus's stock.
- Partition carts, held baskets and pending requests by user, active role and campus. Switching campus/role must not reuse an unrelated cart; uncertain pending sales must be resolved in their original campus.
- Do not alter accountant access to existing Finance, Expenses or Learner Profile workspaces.

Checks: Junior accountant sells Junior only; Senior accountant sells Senior only; both fail cross-campus RPC requests; accountants cannot edit products/images even through direct API calls. Admin POS uses its own campus; Main Admin can switch campuses with separate baskets. Request retries do not deduct stock twice.

Push, apply the stage's reviewed SQL, verify live, and push the rollout record.

## Stage 3 — Parent catalog and order campus enforcement

- Derive campus from the selected verified linked learner, never from the parent's profile or an arbitrary URL.
- Add an explicit campus predicate to ParentUniformShop queries. A family with learners in both campuses sees only the selected learner's uniforms at a time.
- Restrict product/variant SELECT policies to campuses of the parent's verified linked learners. The UI narrows that authorized set to the selected learner.
- Reset product results, size choices and cart on learner/campus changes. Ignore late responses from the previous learner. Do not briefly render the other campus's cached catalog.
- A learner with a missing/invalid campus gets a clear unavailable/allocation message, not an all-campus fallback.
- Validate new parent order lines against the actual selected student's campus in the database snapshot trigger. Reject mixed-campus and forged learner/product requests, including for parents who legitimately have children in both campuses.
- Preserve historical order snapshots. Filter recent history to the selected learner; do not rewrite or hide legitimate old orders because a catalog item is renamed or hidden.
- Keep payment methods, verification status and the existing no-reservation parent request behavior.

Checks: Junior parent cannot read or submit Senior items; Senior parent cannot read or submit Junior items. Verified dual-campus family changes learner and gets a clean cart/catalog. Unverified links grant no catalog or order access. Old order names/prices/sizes remain unchanged.

Push, apply the stage SQL and reload PostgREST schema where needed, verify live, then push the rollout record.

## Stage 4 — End-to-end verification and allocation completion

- Run isolated SQL tests with the project's real role helper bodies and restricted authenticated roles. Cover catalog, variants, images, receipts, checkout RPC and parent order policies, including direct bypass attempts.
- Run mobile/desktop browser scenarios for Main Admin, both campus admins, both campus accountants, single-campus parents and a dual-campus family.
- Verify role switching, campus switching, legacy NULL campuses, hidden products, zero stock, image replacement, size totals, ordered-product deletion protection, checkout idempotency and rollback.
- Verify the live schema, exact policy definitions, migration history and real REST relationship queries after each backend stage.
- Use rollback-only impersonated-role probes for live denial checks; use dedicated test items for any real Storage upload. Do not place real payments for testing.
- Publish the test outcomes and outstanding unassigned product/account counts. A schema rollout must never be described as completing stock allocation while those counts remain unresolved.
- Confirm deployed frontend revision after each push. A GitHub commit, a Supabase migration and a hosted deployment are distinct checks.

Push the final verification record. Each stage ends with its commit hash, tests, live Supabase status, hosted deployment status and any real remaining allocation work.

## Rollout order and temporary visibility

All 22 existing items currently need Main Admin allocation. Strict campus policies will intentionally stop serving unassigned products to campus staff and parents. Deploy matching UI and SQL for each stage with verified compatibility; communicate any empty-catalog transition instead of assigning stock automatically. Prepare and verify allocation controls before requiring staff to use them.

No passwords, staff identities, stock quantities or campus memberships are invented. If a specific account's intended campus is unknown, leave that account restricted and report the missing assignment. This strategy uses the existing active-role and campus model; any new shop permission helper should compose those existing checks and remain scoped to the shop, rather than changing shared finance helpers globally.

