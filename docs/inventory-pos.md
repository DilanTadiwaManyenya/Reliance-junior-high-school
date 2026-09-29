# Reliance inventory and point of sale

## Access

Administrators open **Inventory & POS** from the staff sidebar. Accountants switch between **Finance** and **Inventory & POS** using the workspace buttons. The shop uses existing authenticated Reliance accounts; it does not introduce shared portal passwords.

## Database rollout

The existing `20260923090000_inventory_and_pos.sql` migration is a prerequisite. The new migrations are `supabase/migrations/20260929100000_shop_workflows.sql` and `supabase/migrations/20260929110000_shop_function_permissions.sql`. The latter explicitly removes anonymous grants inherited from Supabase default privileges.

1. From the project terminal, run `npx supabase login` and complete Supabase authentication. Keep the management token private.
2. Verify the linked project is `ejrtmdvnumjwikehzrrk` and run `npx supabase migration list --linked`.
3. Inspect `npx supabase db push --linked --dry-run`. Apply only after checking that the pending migration list does not include unrelated historical changes.
4. Apply the reviewed migration and deploy the frontend together. The new checkout RPC replaces the previous three-argument signature. Existing older clients must refresh before processing another sale.
5. Sign in as admin and accountant to verify their respective navigation and permissions. Set actual product costs before relying on gross profit reports.

The public browser key cannot apply migrations. If management authentication is unavailable, the migration may be run by an authorized administrator through the project's SQL editor; reconcile migration history afterward before future CLI pushes. Do not replay existing migrations blindly.

## Workflows

- Catalogue grid/list, search and stock filters.
- Admin product creation/editing and stock adjustments with reasons.
- Checkout supports cash, EcoCash, card/swipe and bank transfer. These record payments already received; they do not charge external payment services.
- Amount received, change, held carts, receipt history and print/save-PDF receipts.
- Stock and sales CSV exports, monthly/all-time revenue and gross profit.
- Admin shop audit history and receipt preferences.

Held carts and uncertain checkout requests are stored in the current browser tab, scoped to the staff user. Held carts do not reserve stock. The database checks current prices and inventory at checkout. Retry pending sales using the original request; do not start a replacement transaction while confirmation is uncertain.

## Accounting and permissions

Checkout locks product rows in a consistent order, aggregates repeated product IDs, and updates stock and sale records in one transaction. A unique request UUID makes retries idempotent. A sale captures the unit selling price and unit cost. Legacy receipts without cost snapshots show unknown profit, rather than treating missing costs as zero. Reports show gross profit before operating expenses. Currency is USD.

Database row policies restrict inventory and receipts to admins/accountants. Admins alone can adjust stock, edit products, change settings and inspect shop audit logs. The audit log covers shop changes, not all authentication activity across Reliance.

## Validation

Run `npm run test:shop` for PostgreSQL execution tests using the development-only PGlite runtime. Tests use an isolated database, never the live Supabase project. They cover duplicate items, retry idempotency, immutable cost snapshots, insufficient payment/stock, invalid quantities, rollback, stock adjustments and role policies. Run `npm run build` for the production bundle.

Browser validation has also been run against an isolated fixture for hold/resume, checkout, a lost response followed by retry, receipt change, product creation, accountant visibility and a 390px mobile viewport. This does not substitute for a signed-in live check after deployment.

## Verified rollout status — 29 September 2026

Both new shop migrations have been applied to `ejrtmdvnumjwikehzrrk`. The pre-existing shop tables were inspected and reconciled from an admin-only installation to active admin/accountant policies. Migration history now records all three shop versions. The two unrelated report-card migrations remain untouched. Live checks confirmed the new RPC signatures, settings row, policies, and denial of anonymous checkout execution. The updated frontend has been built locally; it has not been published to the hosted website.
