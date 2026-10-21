# Stage 2 — Main Admin POS reversal and financial audit

## Delivered

`20261021200000_main_admin_pos_reversals.sql` is applied to the linked database and recorded in migration history. It adds completed/reversed sale state and immutable-to-application financial events; no existing receipt or stock quantity is backfilled or deleted.

Main Admin opens Inventory & POS → Sales & receipts → Open → Main Admin reversal. A reason of 5–1000 characters and a confirmation are required. Campus admins/accountants see the original receipt without reversal controls. The database function independently enforces the existing `is_main_school_admin()` helper and existing `portal_mfa_satisfied()` setting. Paused MFA stays paused; this stage does not change that setting.

`reverse_pos_sale(uuid,text)` locks the sale and stock rows, restores each original product/variant quantity and writes the reversal, stock snapshots and audit atomically. A repeat request returns the already-reversed sale without another stock change or duplicate reversal event. The original checkout UUID remains consumed, so retrying the checkout cannot recreate it. Hidden stock is restored without automatically showing a hidden product/size. Missing/moved products, changed size labels, a product changed from unsized to sized, legacy campus-less receipts or missing sale lines stop for review.

Receipt headers/lines, original price/cost/name/size snapshots, seller and original tender remain intact. Reversed receipts show who reversed them, when and why; all receipt exports retain status/reversal metadata. Active sales, units, margin, product leaders, trends and export summary totals exclude reversals. Reconciliation retains them as excluded records with a settlement warning.

**Reversal is not a refund.** No cash or electronic money is moved. The UI, printed reversed receipt and reconciliation explicitly require a separate settlement review. Refund payment execution and partial returns are outside this stage. Do not treat active sales totals as a bank/cash reconciliation proof, particularly across reporting periods.

## Audit foundation

Database triggers record new POS headers and exact sale lines with stock-before/stock-after values in `financial_events`. Reversal events include original/reversed headers, original lines, exact stock changes, actor ID/name/active role, transaction campus/currency, timestamp and reason. Audit failure fails the transaction. Previous shop_audit remains readable and receives a reversal event. No historical event is fabricated for older sales.

Activity log → Inventory & POS audit shows these authoritative events, with type filters, 50-event pages, refresh and failure/retry handling. Campus access is enforced by RLS using transaction-campus snapshots; Main Admin sees both campuses. Parent/teacher roles cannot read it. Application roles cannot insert, edit or delete the event table. The misleading Students actor tab is removed; no account or history was deleted.

Portal click logs remain supplementary; exhaustive click tracking, fees/expense controlled corrections, finer audit search/export and parent uniform balances remain later stages. POS reversals do not modify separate parent_uniform_orders because the current schema has no reliable sale/order link. Do not infer a match from customer text.

## Verification

- Existing SQL role harness plus new reversal checks: Main Admin allowed; both campus admins/accountants, parent, teacher, invalid-campus admin, switched active role and anonymous denied. Required admin verification respected. Direct sale mutation and audit update/delete denied.
- Stock tests: hidden size restored once, receipt lines preserved, duplicate reversal and original checkout replay safe. Forced audit-write failure rolls back stock and sale status.
- Reconciliation/export tests: reversed originals retained and labelled, active totals exclude them, currencies remain separate.
- Dedicated browser suite at 390px and 1280px: Main Admin confirmation/cancel, required reason, safe server error/retry, reversed receipt; campus admin/accountant control absence; audit pagination/type filtering and load failure/retry. Mobile ledger overflow was corrected.
- Live rollback-only SQL passed before application and again against installed functions. Synthetic products, receipts, stock changes and audit events all rolled back. No real financial transaction was reversed.
- Production build and focused lint passed. These tests do not claim a real cash refund, real simultaneous-client load test or a signed-in Main Admin reversal of a production receipt.

The existing catalog browser suite needed semantic Campus selectors and current USD labels because the prior positional/currency expectations were stale; this does not change product business rules. The Campus field now has an explicit accessible name.

## Exact SQL / verification steps

For another environment, review and run the full migration file first; do not replay it on the linked environment where it is already applied. Then run:

```powershell
supabase db query --linked --file supabase/verification/pos_reversal_stage2.sql
```

The query explicitly rolls back all fixtures and returns five true booleans for role denial, exact restoration, hidden size preservation, replay safety, and original/audit retention. It requires a real Main Admin identity and non-Main-Admin testable identities; it fails rather than silently skipping those identities.

Read-only structural checks for SQL Editor:

```sql
select to_regclass('public.financial_events') is not null as audit_table_live,
       to_regprocedure('public.reverse_pos_sale(uuid,text)') is not null as reversal_live;
select column_name from information_schema.columns
where table_schema='public' and table_name='pos_sales'
  and column_name in ('status','reversed_at','reversed_by','reversal_reason');
select policyname, permissive, cmd, qual from pg_policies
where schemaname='public' and tablename='financial_events';
select has_table_privilege('authenticated','public.financial_events','INSERT') as client_insert,
       has_table_privilege('authenticated','public.financial_events','UPDATE') as client_update,
       has_table_privilege('authenticated','public.financial_events','DELETE') as client_delete;
-- Expect both live flags true, four columns, scoped read/security policies,
-- and all three client mutation privileges false.
```

Next stage: partial uniform payments, validated learner linkage and receipts showing paid/balance, with later payments tied to the same sale. Credit/collection rules must be settled before enabling that checkout behavior.
