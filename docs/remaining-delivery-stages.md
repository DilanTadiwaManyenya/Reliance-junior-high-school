# Remaining delivery stages — 20 October 2026

Stages 1–9 are implemented. Administrator authenticator enforcement remains paused by the school owner's request (migration 20261019150000); do not re-enable it as part of unrelated work.

Each stage gets focused tests, any necessary SQL plus manual verification, its own commit/push and both deployment statuses checked. A stage's implementation does not imply school acceptance of other modules.

| Stage | Scope | Acceptance |
|---|---|---|
| 10 | Learner register exports | Complete scoped snapshot; CSV and genuine XLSX; identifiers/phones stay text; safe spreadsheet text; selected-scope preview cannot be mistaken for another scope; multi-page A4 landscape PDF/print with repeated headers and all rows. |
| 11 | Finance and operations exports | Fees/invoices/receipts/partial payments/arrears, cashbook/expenses, stock/POS/order history. Compare exported totals with existing calculations; label currency and scope; preserve campus roles. No payment, fee or order calculation changes. |
| 12 | Academic and attendance exports | Historical year/term/class reports, subject and component marks, attendance and teacher scope; batch/individual print/PDF, formula-safe spreadsheet exports and real file verification. Existing marks locks and result-release rules remain enforced. |
| 13 | Zimbabwe configuration | Inspect current currency and grade-band behavior; configure supported currencies and grade schemes without rewriting historical reports. Map ministry/exam-board requirements against school-supplied official templates before claiming statutory compatibility. |
| 14 | Reliability and environments | Inventory test/live hosting and secrets; establish isolated test data; dropped-connection recovery and mobile-data checks; document backups and perform an isolated restore drill. Evidence of a restore is required before marking backups verified. |
| 15 | Handover and go-live | Role-specific guides, permissions matrix, troubleshooting, recovery ownership, deployment/rollback instructions and a school-run acceptance checklist with unresolved items named. |

## Parallel school verification

The 63 inferred historical report contexts require school register confirmation. Software must not auto-certify these records. Reviewed promotions remain blocked until their source-year context is confirmed. Supply and verification of official Zimbabwe report templates and backup/environment account access may also need the school owner; continue independent tasks while collecting those inputs.

## Stage 10 inspection

Stage 10 is implemented; see stage10-learner-register-exports.md for exact SQL, live checks, file verification and school acceptance. Next implementation stage is 11.

BulkLearnerExport originally fetched students with one unpaged select and exposed print/PDF only. Results could stop at the API row limit. Changing controls after a preview also changed the displayed/export title while retaining the old learner list. Its print CSS contained global body visibility and @page rules, and print changed the browser title without restoration. Stage 10 addresses these concrete problems before expanding other module exports in Stages 11–12.
