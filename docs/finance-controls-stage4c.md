# Stage 4C — Main Admin fee-payment reversals

Main Admin opens Finance → learner account → Fees → Payment timeline, enters
a 5–1000 character reason and confirms Reverse fee payment. Campus admins,
accountants, teachers, parents and principals cannot call the reversal RPC;
the existing Main Admin and session-security helpers enforce this in SQL.

The RPC locks the payment and its matching balance, checks learner/period/
currency consistency, subtracts the original applied amount once, recomputes
the latest remaining payment date, and marks the original entry reversed.
Repeating the same reversal returns the reversed entry without another
deduction. Reversal is a ledger correction, not an automatic cash refund.
Legacy `recorded` opening balances and inconsistent/insufficient balances
require separate review rather than automatic reversal.

The transaction preserves amount, date, method, reference and collector. It
adds reversal actor/time/reason, a dedicated payment_reversed event with
before/after payment and balance snapshots, plus the generic audit changes.
An audit failure rolls back both the payment status and balance deduction.
Payment history retains a visible reversed stamp. Reconciliation excludes the
reversed collection; exported ledgers retain its original amount and reversal
details, while collection totals exclude it. Parent balances/report fee gates
continue using the updated balance; no parent audit or correction access added.

Authenticated clients now have no direct INSERT/UPDATE/DELETE permission on
fee_payments. Existing payment RPC signatures remain usable; they write as
their database owner. The UUID RPC links future submissions to payment rows
via collection_request_id. Its internal implementation is no longer callable
by clients. Replaying a reversed submission raises a review message instead
of recreating payment or presenting it as successful. Older untagged request
replays conservatively check matching reversed entries; no guessed backfill.

Applied migration: supabase/migrations/20261021233000_main_admin_fee_reversals.sql.
Only synthetic rollback data was used; no real fee payment was reversed.

```powershell
supabase db query --linked --file supabase/verification/fee_reversal_stage4.sql
supabase db query --linked --file supabase/verification/fee_payment_retry_stage4.sql
node --test tests/fee-reversal.test.mjs tests/fee-payment-retry.test.mjs tests/finance-audit-stage4.test.mjs tests/finance-reconciliation.test.mjs tests/operations-export.test.mjs
node tests/fee-reversal.browser.mjs
node tests/fee-payment-retry.browser.mjs
npm run build
```

Live rollback verification exercises actual project role helpers with existing
non-Main-Admin identities, Main Admin success, repeat safety, audit failure,
reversed-request replay and direct-write permissions. Local database tests also
cover MFA denial, opening-balance/inconsistent-ledger rejection, immutable
original amounts, and allowed fresh collection after reversal. Mobile/desktop
tests check authority, confirmation cancel, error/retry, updated balance and
retained receipt, plus the previous lost-response/reload workflow.

Read-only SQL (expect RPC true, three direct permissions false):

```sql
select to_regprocedure('public.reverse_learner_fee_payment(uuid,text)') is not null as reversal_rpc_live;
select has_table_privilege('authenticated','public.fee_payments','INSERT') as client_insert,
has_table_privilege('authenticated','public.fee_payments','UPDATE') as client_update,
has_table_privilege('authenticated','public.fee_payments','DELETE') as client_delete;
```

Stage 4 still needs expense corrections/retry protection and controlled balance
charge adjustments. Direct fee_balances write permissions are unchanged pending
the active-caller migration. This push does not claim the entire finance
permission cleanup is complete.
