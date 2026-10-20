# Stage 16 - Read-only finance reconciliation

Implemented 20 October 2026. This stage adds a cross-source review screen without changing payment, order, fee, expense approval, or receipt workflows.

## Delivered

- Main Admin and accountants can open **Income & expenses** from the Finance menu. Main Admin can select all campuses or one campus; accountants are locked to their assigned campus. If an accountant has no campus assignment, the screen stops and explains the issue.
- The view reads saved fee payment entries, saved POS sales, and expense records through the user's existing Supabase client. It preserves existing RLS and adds explicit campus/date filters. Requests are paged in groups of 500 by the shared helper, capped at 50,000 rows per source, cancellable when filters change or the page closes, and bounded to 30 seconds.
- Recorded collections use each fee payment amount and the POS sale total. Approved expenses are subtracted from net recorded movement; pending and rejected expenses are listed but excluded. USD and ZWG totals stay separate.
- POS timestamps are presented and date-filtered in the school timezone (Africa/Harare). CSV export includes source IDs, scope and calculation notes.
- Parent uniform orders are excluded because an order record is not a receipt. The report is a comparison of portal records; it does not reconcile a bank statement, confirm settlement, or issue invoices/receipts.
- Invoice issuance remains unimplemented. Before building it, the school must define invoice numbering, issue/approval, correction, cancellation/credit-note and duplicate/reprint rules. No numbering or legal accounting policy was guessed.

## Verification

- `node --test tests/finance-reconciliation.test.mjs tests/portal-redirect.test.mjs`
- `npm run build`
- Targeted ESLint passes for the reconciliation component, sidebar, helper and tests. `StaffDashboard.jsx` still reports existing unused-variable and hook-effect findings outside this stage.
- No SQL migration or live database write is required. Source-table campus access continues to depend on the existing RLS policies.

## School acceptance

With a Main Admin test account, compare each campus and combined totals against saved fee payments, POS receipts and approved expenses for a chosen date range, checking USD and ZWG separately. With each accountant test account, confirm the campus cannot be changed and all listed records belong to that campus. Confirm pending/rejected expenses do not reduce net movement. Compare the CSV against the on-screen rows. Do not use this report as a bank reconciliation until it is matched to statements and cash counts.
