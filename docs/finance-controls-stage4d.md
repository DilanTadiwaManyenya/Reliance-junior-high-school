# Stage 4D — controlled expense operations

Expense submission uses submit_school_expense(request UUID, expense JSON).
The database accepts Main Admin or the accountant assigned to the selected
campus, validates amount/date/currency and required fields, and always records
the authenticated collector with pending status. Caller-supplied approval or
actor fields are ignored. A private request ledger and transaction lock ensure
that repeating the same submission creates one expense and one insertion audit.
Changed submissions or another actor cannot reuse a request ID.

The UI saves the exact original request in user-scoped session storage before
calling the API. Lost responses and 15-second confirmation timeouts offer Retry
saved expense; reload in the same tab preserves recovery. New entry is disabled
until resolved. Closing the tab or clearing browser storage removes this local
recovery information: reconcile uncertain entries before starting a fresh one.
A replay of an already reversed expense returns that original record and does
not create a replacement. Explicit database validation failures permit edits.

Only Main Admin can approve, reject or reverse expenses. Approval is locked and
retry-safe for the same decision; an approved, rejected or reversed expense
cannot be approved again with a different decision. Reversal requires a
5–1000 character reason and confirmation, locks the original entry, preserves
amount/collector/approval details, and adds reversal actor/time/reason. Repeating
it does not create another reversal event. It is a ledger correction; no money
is refunded or transferred. Pending and rejected entries can also be marked
reversed without inventing cash movement.

The original finance_audit and Stage 4A before/after audits remain active. A
dedicated expense_reversed event carries original and corrected snapshots.
Audit failure rolls the correction back. Authenticated clients can no longer
insert/update/delete school_expenses directly. All active UI writes have moved
to the controlled RPCs; select policies and existing campus helpers are retained.
Older browser tabs must reload the updated application before submitting.

Cashbook history retains reversed entries. Pending/approved totals and category
breakdowns exclude them. Currency selection now scopes both entries and totals.
Exports include original values plus reversal actor/time/reason; reconciliation
continues to count approved expenses only. Campus admins receive no new expense
submission or correction authority. Unassigned accountants cannot enter expenses.

Migration: supabase/migrations/20261021234500_controlled_expense_operations.sql.
Applied to the linked project and verified with rollback-only synthetic data;
no real school expense was submitted, approved or reversed for testing.

```powershell
supabase db query --linked --file supabase/verification/expense_controls_stage4.sql
node --test tests/expense-controls.test.mjs tests/expense-campus.test.mjs tests/finance-reconciliation.test.mjs tests/operations-export.test.mjs
node tests/expense-controls.browser.mjs
node tests/portal-finance-mobile.browser.mjs
node tests/operations-export.browser.mjs
npm run build
```

Live checks exercise actual project role helpers: campus submission, forced
pending/actor identity, changed retry rejection, non-Main-Admin approval/reversal
denial, repeated approval/reversal, audit-failure rollback, original approval
preservation and direct-write denial. Local PostgreSQL tests add invalid numeric
inputs, MFA denial, request-ledger failure rollback and export/totals assertions.
Browser tests cover Main Admin/accountant controls, confirmation cancel,
error/retry, lost response/reload, exact request replay, campus attribution,
approval and preserved history at 390/1280px. Export regressions cover 1007 rows
and 320/390/768/1280px. Fee-mobile fixtures now explicitly declare USD and expect
the existing USD labels; no production fee calculation changed.

Read-only SQL checks (three live flags true, client mutation flags false):

```sql
select to_regprocedure('public.submit_school_expense(uuid,jsonb)') is not null as submit_live,
to_regprocedure('public.reverse_school_expense(uuid,text)') is not null as reversal_live,
to_regprocedure('public.review_school_expense(uuid,text)') is not null as review_live;
select has_table_privilege('authenticated','public.school_expenses','INSERT') as client_insert,
has_table_privilege('authenticated','public.school_expenses','UPDATE') as client_update,
has_table_privilege('authenticated','public.school_expenses','DELETE') as client_delete;
```

Manual acceptance: as a campus accountant submit an expense, verify pending
status and campus; Main Admin approves it. Main Admin then enters a correction
reason and reverses it. Confirm approved spending falls by that amount, original
details remain, and the Expenses audit exposes before/after values and actor.
Verify accountant has no approval/reversal controls and cannot call those RPCs.
For actual connection-loss testing, retry the saved submission rather than
creating another request. Correct entry requires a fresh submission after the
mistaken original is confirmed reversed.

Stage 4 still needs controlled fee charge/balance adjustments and migration of
remaining direct fee_balances writers before tightening those permissions.
