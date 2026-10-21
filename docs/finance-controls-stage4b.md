# Stage 4B — retry-safe fee collection

The fee collection screen now submits a UUID with the original learner, term,
year, amount, date, method, reference, currency and expected fee amount.
An advisory lock serializes retries; a private request ledger commits with the
payment and audit. Reusing the same UUID returns the existing balance without
adding another payment. Changed payloads or another collector cannot reuse it.
First-account creation is serialized for callers using this new overload.
Existing role/campus helpers and the current MFA policy still apply.

Before submitting, the browser saves recovery details in user-scoped session
storage. A lost response or 15-second confirmation timeout retains them.
Reloading the same browser tab offers Retry saved payment with the exact original
payload. New collection is blocked until resolved. Confirmed success clears
recovery details. Explicit database validation exceptions permit correction;
uncertain outcomes remain blocked. The dialog cannot close while submitting.
Session storage is not a permanent receipt archive: closing the tab or clearing
browser data removes local recovery information; reconcile an uncertain payment
against the ledger before entering a fresh collection.

Migration applied to the linked project and history recorded:
supabase/migrations/20261021230000_idempotent_fee_payments.sql.
No real school payment was entered during verification.

```powershell
supabase db query --linked --file supabase/verification/fee_payment_retry_stage4.sql
node --test tests/fee-payment-retry.test.mjs tests/finance-audit-stage4.test.mjs
node tests/fee-payment-retry.browser.mjs
npm run build
```

Live rollback checks: repeated authenticated Main Admin submission produces one
payment and one payment audit event; changed payload rejected; request ledger
not directly accessible. Local PostgreSQL tests also cover denied parent scope,
precision, request-ledger failure rolling back the balance, and recovery storage.
Mobile/desktop tests simulate committed payment with lost response, reload,
blocked new collection, identical retry and cleanup; pending dialog checks cover
Escape, Cancel and a single submission.

Read-only SQL checks:

```sql
select to_regprocedure('public.record_learner_fee_payment(uuid,text,integer,numeric,date,text,text,text,uuid,numeric)') is not null as retry_rpc_live;
select has_table_privilege('authenticated','public.fee_payment_requests','SELECT') as client_read,
has_table_privilege('authenticated','public.fee_payment_requests','INSERT') as client_insert,
has_table_privilege('authenticated','public.fee_payment_requests','UPDATE') as client_update,
has_table_privilege('authenticated','public.fee_payment_requests','DELETE') as client_delete;
-- Expect true for RPC and false for all four direct permissions.
```

Build and new-file lint pass. FeesDashboard has six pre-existing lint errors
and one warning (unused declarations, effect-state rules, memo dependency);
baseline and changed versions have identical counts. These are not reported
as clean checks.

Stage 4 remains in progress: Main Admin-only fee/expense corrections, expense
entry retry protection, controlled balance adjustments, migration of active
direct-write callers and tighter finance write permissions. Legacy fee RPC
signatures remain compatible but do not provide retry protection; the updated
portal collection screen uses the new UUID signature. No mutation grants have
been tightened prematurely, and no reversal controls are added by this push.
