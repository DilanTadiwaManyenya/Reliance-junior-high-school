# Stage 4A — fee and expense audit foundation

Adds transactional INSERT/UPDATE/DELETE audit triggers to fee_balances,
fee_payments and school_expenses. Each event snapshots before/after values,
currency, campus and the authenticated actor. Repeated edits create separate
events; unchanged UPDATEs do not. Database operations without a user are
explicitly labelled system operations, including admission fee seeding.
No historical events are fabricated. Existing expense audit remains intact.

Activity log → Inventory, fees & expenses audit now has a module selector.
Main Admin reads all; campus accountants read their campus finance events
using the existing accountant_can_access_campus helper. Parents and teachers
receive no new audit access. Existing POS access and MFA policy remain.
Authenticated clients cannot insert, update or delete financial_events.
Audit failure aborts the originating financial mutation.

Migration: supabase/migrations/20261021220000_fee_expense_financial_audit.sql.
Applied to the linked project and migration history recorded. Verification:

```powershell
supabase db query --linked --file supabase/verification/fee_expense_audit_stage4.sql
node --test tests/finance-audit-stage4.test.mjs
node tests/pos-reversal.browser.mjs
npm run build
```

The live verification creates synthetic admission/expense records, checks
five assertions and rolls everything back. Local PostgreSQL tests verify
repeated edits, no-op suppression, actor/source labels, campus audit isolation,
immutable client access and atomic rollback on audit failure. Browser checks
exercise module switching, pagination, filtering, errors and retry at 390/1280px.

Read-only checks (expect three enabled triggers and false client write flags):

```sql
select tgname,tgenabled from pg_trigger
where tgname in ('fee_payment_financial_event','fee_balance_financial_event','expense_financial_event');
select has_table_privilege('authenticated','public.financial_events','INSERT') as client_insert,
has_table_privilege('authenticated','public.financial_events','UPDATE') as client_update,
has_table_privilege('authenticated','public.financial_events','DELETE') as client_delete;
```

Stage 4 is not complete. Next: idempotent fee/expense entry, Main Admin-only
correction APIs and UI, migration of reachable direct-write callers, tighter
ledger mutation permissions, and reconciliation/export/parent history checks.
This foundation does not yet change existing fee/expense mutation privileges
or introduce fee/expense reversal buttons. No real payment was altered.
