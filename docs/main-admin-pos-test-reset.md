# Main Admin deletion and test POS reset

16 October 2026. User explicitly identified all existing POS history as testing and requested its removal, with product deletion restricted to Main Admin.

## Applied live

Migration 20261016190000_main_admin_product_delete.sql splits the prior campus-admin ALL inventory policy into campus-scoped INSERT/UPDATE and Main Admin-only DELETE using the existing is_main_school_admin helper. Staff catalog reads remain campus-scoped. The frontend hides the permanent deletion action from campus admins and checks the Main Admin role before attempting it.

A one-time maintenance transaction backed up and verified the exact four existing test receipts and four sale lines before applying cleanup. It restored the quantities deducted by those tests: Skirt +1 (44), Hat +2 (66), Anorak Jacket +1 (33). It removed the four receipts, their cascading sale lines and their matching POS insert audit entries. Receipt and line counts are now zero. It recorded a summary-only POS_TEST_HISTORY_CLEARED audit entry. No stock was allocated between campuses or guessed by size. If backed-up receipt/item/affected-product snapshots had changed, the transaction would have aborted.

The existing parent order and its snapshot were preserved and verified unchanged inside the transaction. Fees and other payment records were not changed. Trouse still has a parent order and remains protected by the existing ordered-product deletion guard. No catalog products were permanently deleted during this cleanup.

The four retired checkout request UUIDs are kept in a private RLS-enabled table with no client grants, without receipt/customer payloads. A before-insert guard rejects replay so an old pending browser request cannot recreate a cleared test receipt or deduct stock again. Existing server-validation handling releases modern pending requests; legacy recovery also releases a pending request only for the explicit cleared-test error. Uncertain network requests retain their original recovery behavior.

A local backup and exact-snapshot cleanup SQL remain in tmp/ and are deliberately excluded from Git staging. The schema migration is committed; the one-time data reset must not be rerun or copied into a general reset button. Accountants and campus admins have no history-purge endpoint.

## Checks and verification queries

```sql
select version,name from supabase_migrations.schema_migrations where version='20261016190000';
select (select count(*) from pos_sales) receipts,
       (select count(*) from pos_sale_items) lines,
       (select count(*) from shop_retired_checkout_requests) retired_requests;
select policyname,cmd,qual,with_check from pg_policies
where schemaname='public' and tablename='inventory_products' order by policyname;
select pg_get_triggerdef(oid) from pg_trigger
where tgrelid='public.pos_sales'::regclass and tgname='reject_retired_shop_checkout';
```

The isolated database regression passed Main Admin-only deletion, campus administrator/accountant/parent/teacher denial, private replay-token access denial and retired-request rejection. Browser regression adds campus-admin action visibility and stale legacy test checkout recovery without recreating sales.

Final checks passed: targeted ESLint, production build (existing bundle-size warning), isolated database regression and expanded 390px browser workflow. Live rollback probes confirmed Main Admin deletion of both unassigned and Senior products; campus-admin denial; parent-order protection; and stale request rejection. All probe product deletions were rolled back. A final audit also found and cleared one global activity-log entry linked to a removed test receipt after a local backup; unrelated activity entries remain.
