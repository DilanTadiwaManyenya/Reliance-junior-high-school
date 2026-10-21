# Finance controls — Stage 1 discovery and implementation strategy

Inspected source and linked live Supabase on 21 October 2026. This stage changes documentation and adds a read-only verification query only. No migration, transaction, stock, fee, expense, account or audit record was changed.

## Confirmed findings

| Area | Current behavior | Required work |
| --- | --- | --- |
| POS checkout | Campus-aware, request UUID prevents duplicate checkout, locks stock, snapshots name/price/cost/size and deducts product or variant stock atomically. | Preserve these guarantees for reversal and partial payments. |
| POS reversal | No matching reverse/refund/void sale function found live; sale has no reversal state, actor, reason or timestamp columns. Client INSERT/UPDATE/DELETE on sale headers/lines is revoked. | Add a Main Admin-only server operation and linked reversal record; never implement by deleting sale history. |
| Partial uniform payments | UI and live checkout both reject payment below total. Receipt shows Total, Received and Change, with no balance. | Add a payment ledger, settlement state and outstanding balance; later payments attach to the original sale. |
| Meaning of amount_paid | Existing checkout accepts tender above total and receipt computes change from it. | Do not blindly reinterpret historical amount_paid as money retained, or backfill tender as payment without accounting for change. Keep tender, applied payment and change distinct. |
| Parent linkage | POS persists customer_name, but no learner/parent FK. UI learner selection is absent from the checkout RPC payload. Parent history reads separate parent_uniform_orders with learner linkage. | Persist and validate a learner link for credit sales; expose only verified linked-learner receipts to parents. Avoid charging/stock-deducting twice when reconciling a parent order with a POS sale. |
| Portal activity | audit_logs powers Parents/Students/Staff tabs. Students is a hard-coded category. Browser delivery is deliberately best-effort and does not prove a financial change committed. Feed loads latest 500 events before client filtering; no pagination. | Separate actor filter from module filter, remove unsupported Student category, filter/page on server and distinguish navigation from committed changes. |
| Student accounts | Live aggregate counts: 0 student-role profiles, 0 student-role memberships, 0 student-role activity events. | Remove misleading tab without deleting history or assuming a student account exists. |
| Shop audit | Database triggers capture product INSERT/UPDATE and sale INSERT into shop_audit with before/after JSON. Variant changes synchronize product totals but have no dedicated variant audit trigger. | Capture explicit size/stock movement, line, payment and reversal events in the same transaction. Preserve previous history. |
| Expense audit | Live school_expense_audit captures INSERT/UPDATE with full before/after detail in finance_audit. Activity feed separately logs submission/review descriptions. | Surface authoritative expense audit with amount/currency, campus, expense date, event time, actor and approval/correction chain. |
| Fee payments | Currency-aware function atomically increments fee balance and inserts payment; it has no request UUID. Table grants and campus ALL policies allow permitted finance staff direct mutations. No dedicated fee-payment/balance change-audit trigger found live. UI activity targets fee_balances using the learner ID rather than fee-balance ID. | Highest-priority hardening: authoritative audit and controlled write/correction functions; idempotent payments; correct linked identifiers. Do not silently rewrite historical balances. |
| Audit campus | audit_logs visibility derives from actor's current profile campus, rather than transaction-campus snapshot. Main Admin actions may therefore not appear in the relevant campus's view, and later actor-campus changes can alter historical visibility. | Store event-time transaction campus and actor identity/active role snapshots; keep Main Admin cross-campus access. |

Live helper `is_main_school_admin()` already checks active admin role plus profile campus `all`. Reuse it. Campus POS helper already limits campus admins/accountants appropriately. No new role hierarchy is needed. Existing MFA policies are not changed by this project.

## Implementation stages and gates

### Stage 2 — reliable audit foundation and POS reversal

1. Define an append-only financial event structure with event ID, module/action, record links, request/correlation ID, actor/active role/name snapshots, campus, currency, effective business date, server timestamp, reason and before/after fields. Keep existing audit tables readable; do not erase or fabricate earlier history.
2. Add sale state and linked reversal metadata. Reverse through one database function using is_main_school_admin(), mandatory reason and row locks. Exactly one reversal per sale, safe retry and no duplicate stock restoration.
3. Restore the exact sold product/size quantities even if hidden; handle legacy missing/deleted references by failing safely for review, not restoring to a guessed item. Guard product/variant allocation changes so restored stock cannot cross campus silently. Sale, stock and audit must commit together or roll back together.
4. Reversed sales stay inspectable and clearly stamped; exclude them from active sales, margins, trend and collection totals. Protect exports and reconciliation too. Original checkout request must remain consumed after reversal.
5. Refund settlement is distinct from reversing a record. A cash refund needs an explicit recorded settlement; electronic money is not returned by changing database rows. Block contradictory cashbook totals and unexplained refund status.

Initial reversal scope: full POS sale correction. Fee-payment reversal and expense correction need their own ledger rules; do not reuse stock-restoring POS logic. The user's Main Admin-only reversal requirement applies to any later reversal function too. Partial returns are a separate feature.

### Stage 3 — uniform balances and receipts

Add immutable payment entries linked to sale, learner, campus, collector, method, reference, currency, date/time and unique retry key. Keep sale-line price/name snapshots. Derive paid, balance and settlement status from valid entries; never accept an arbitrary browser balance. A $25 sale with $20 applied shows $5 due. A later $5 payment settles that sale without creating a new sale or moving stock again. Tender above due produces change; it must not create a negative debt. Preserve current USD/ZWG separation with no conversion.

Credit must have a validated learner/payee link; retain immediate full-payment walk-in support. Proposed gate: require a positive initial payment; zero-payment credit needs an explicit school policy. Hand-over policy (issue uniform immediately versus hold until paid) must be settled before releasing partial checkout. Represent collection/fulfilment explicitly so payment and stock cannot contradict each other. No such policy is enabled in Stage 1.

### Stage 4 — fees and expenses

Introduce request IDs for fee entry, audited balance adjustments and Main Admin-only correction/reversal functions. Restrict direct client mutation only after identifying and migrating every legitimate caller, including enrolment, fee structure, imports and service workflows. Preserve allocation by learner/period/currency and re-evaluate arrears/report access after corrections. Audit before/after balances and original payment links. Reconcile existing payment-ledger totals against balances read-only first; differences require review, not automatic backfill.

For expenses, preserve submitted/reviewed entries; distinguish rejection before payment, correction of an entry, and reversal of an actually paid expense. Define cashbook effects and prevent reversing the same entry twice. Never delete approved history to correct spending.

### Stage 5 — activity and role screens

Provide Inventory/POS, Fees and Expenses module filters, actor/name, learner/payee, receipt/reference, campus, currency, action, date range and paginated search/export. Display exact Harare business dates alongside server timestamps. Financial audit is authoritative; click activity is supplementary and labelled accordingly. Track meaningful navigation, receipt views, exports and restricted attempts. Do not record every keystroke, passwords or secret values. A client cannot reliably prove every click occurred.

Main Admin gets reversal controls and both-campus oversight. Accountants keep their campus POS/fee/expense permissions without reversal or product management. Campus admins remain campus-bound and cannot reverse. Parents see only verified linked learners' sale/payment/balance history, with reversed receipts identified; no staff audit or other family's receipts. Add no Student account category.

### Stage 6 — acceptance and deployment

Use synthetic transactional SQL tests with rollback plus browser fixtures before any real-account pilot. Cover Main Admin allow, campus Admin/accountant/teacher/parent deny, direct API attempts, cross-campus access, double-click/retry/concurrent reversals, hidden products, size stock, linked parent orders, sale/refund totals, $25/$20/$5 settlement, overpayment/change, failed networks, mixed-currency rejection, and mobile receipt printing. Verify transaction, stock, audit and report totals together. Push each tested stage, apply only its reviewed migration, verify live schema/role behavior, and confirm deployment. Never clear real history as a test.

## Repeatable Stage 1 inspection

Run `supabase db query --linked --file supabase/verification/finance_stage1_inventory.sql --output json`. It is BEGIN READ ONLY / COMMIT and returns schema, triggers, policies, relevant function definitions, client grants and aggregate Student-role counts. No names, credentials or transaction detail rows are exported. Local raw results are kept in ignored tests/artifacts/finance-stage1-live.json. This is structural inspection, not a successful reversal or role-action test.
