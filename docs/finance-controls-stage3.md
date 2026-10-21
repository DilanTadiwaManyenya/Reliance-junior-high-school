# Stage 3 — uniform partial payments and parent receipts

School policy confirmed by the user: uniforms may be handed over before full payment. Completing checkout therefore issues/deducts stock once, records issued_at and leaves any remaining balance on the same receipt. A positive initial payment and a selected active learner from the sale campus are required for credit. Fully paid walk-in sales remain supported; zero-payment credit is not enabled.

## Staff workflow

1. Select the campus/product/size and learner. Enter money actually received. A $25 jacket with $20 received shows $5 due; choosing no learner keeps partial checkout disabled.
2. Complete checkout after issuing the items. Receipt shows total, paid to date, balance, initial change, issue time and the individual payment history. Existing lines keep their saved product name, size and price.
3. Open Sales & receipts → Receipt status → Outstanding balances. Open the original receipt and use Record balance payment. A later $5 settles it without another sale or stock deduction. Over-tender is split between amount applied and change.
4. If confirmation is lost, use Recover pending receipt payment. Request ID and original amount/method/reference persist in the account/campus-specific session slot. Retrying retrieves the same payment even after reload; do not collect the money again. Main Admin must return to the original campus/workspace when recovering a campus-specific pending operation.

The database validates scope, active learner/campus, positive two-decimal payment, receipt status and remaining amount. Sale row locks serialize payments/reversal, and unique request IDs prevent retry duplication. Client roles cannot directly insert/update/delete pos_payments. Payments against reversed/settled receipts are rejected, except a retry of an already-recorded request returns its original result.

## Parent workflow and privacy

The uniform shop now shows Uniform receipts and balances alongside existing order history. Parents see only the selected verified linked learner's recent 20 POS receipts and payment histories. Switching learner clears that history through the keyed component. A curated server function returns saved item names/prices, total, paid, balance, status and payment dates/methods; it omits staff IDs and internal reversal reasons. No parent read policy was added to raw staff POS tables.

Parent orders remain distinct from completed sales. No order is auto-converted or charged again, and no receipt is linked by guessing a customer name. Staff must select the learner at checkout to make the receipt available to that family. Historical unlinked walk-in receipts are not automatically assigned.

## Money and reporting

- New receipts have a pos_payments ledger, paid_total, generated balance_due, learner ID and issue timestamp. Payment events record before/after paid and due values, amount applied, tender, change, method/reference, actor, currency, campus and server time.
- Existing amount_paid means original cash tender, including change. No ledger backfill fabricates payments from it. Existing fully paid receipts retain their original tender and are counted at their sale total.
- POS collection summaries use payment entries on their payment date; old receipts use their original fully paid total. Reconciliation similarly reads the payment ledger for tracked receipts and avoids also counting their gross sale total. USD and ZWG remain separate with no conversion.
- Sales revenue/stock/cost/margin remain sale-value measures; they are not cash collection. Exported receipt headers include paid and due amounts, with an additional payment-entry sheet. Later payments in another month belong to that later collection period.
- Main Admin-only whole-sale reversal still restores stock once, retains every payment and cancels the outstanding obligation (due becomes zero). It does not refund money. Individual payment correction/refund workflows are later-stage controls; application users cannot edit the ledger to conceal a mistake.

## Verification completed

Actual project helper/stock SQL tests cover 25/20/5, campus/learner validation, positive/precision validation, issue once, later payment plus change, idempotent checkout/payment, no duplicate stock movement, parent isolation, whole-sale reversal and preserved payment history. Forced payment-audit failure rolls back both initial checkout and follow-up payment effects.

Browser fixtures at 390px and 1280px cover partial checkout, missing learner prevention, parent balance visibility and child switching, lost payment-response/reload recovery, final change and unchanged stock. Stage 2 reversal/audit browser tests passed again. Existing catalog/campus/parent acceptance passed at 390px. Operations export acceptance passed for 1007-row cashbooks at 320/390/768/1280px, fee filters/retry and stock/POS/order downloads. Focused lint and production build passed.

Live rollback-only verification passed before migration and against the installed functions. Existing full-payment/reversal compatibility was also verified. Synthetic admissions, trigger-created fee rows, links, products, receipts, payments, stock changes and audit events rolled back. No real financial transaction was recorded, collected, refunded or reversed during verification. Browser fixtures are not a signed-in cash-collection pilot or a multi-client load test.

## SQL / deployment

Migration: supabase/migrations/20261021210000_pos_partial_payments.sql. It is applied to the linked project; do not replay it there. For another environment review/run that complete file, then run the rollback checks:

```powershell
supabase db query --linked --file supabase/verification/pos_partial_payments_stage3.sql
supabase db query --linked --file supabase/verification/pos_reversal_stage2.sql
```

Read-only SQL Editor checks:

```sql
select to_regclass('public.pos_payments') is not null as payment_ledger_live,
 to_regprocedure('public.record_pos_payment(uuid,numeric,text,uuid,text)') is not null as payment_rpc_live,
 to_regprocedure('public.parent_pos_receipts(uuid)') is not null as parent_receipts_live;
select column_name,is_generated from information_schema.columns
where table_schema='public' and table_name='pos_sales'
 and column_name in ('student_id','payment_tracking','paid_total','balance_due','issued_at');
select has_table_privilege('authenticated','public.pos_payments','INSERT') as client_insert,
 has_table_privilege('authenticated','public.pos_payments','UPDATE') as client_update,
 has_table_privilege('authenticated','public.pos_payments','DELETE') as client_delete;
-- Expect three live flags true, five columns with balance_due generated,
-- and all three direct client mutation flags false.
```

Next: controlled fee/expense corrections, stronger finance auditing and payment-correction controls, retaining Main Admin-only reversal authority.
