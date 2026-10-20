# Stage 11 — finance and operations exports

Implemented 20 October 2026. No migration, payment, fee, expense approval, stock adjustment, checkout or order calculation change is needed. Administrator MFA stays paused.

## Download paths

Finance → Download records: saved fee balances and fee payment ledger, across all dates/statuses within existing database access. Balances include term/year, learner/admission number, campus, fee, paid and net balance. Payments include payment date, method, instalment plan, reference and original notes. Historical ledger entries labelled as recorded in their original notes remain distinguishable. Saved balances do not infer a fee record for learners without one.

The fee table's existing Export report/Export selected actions now produce safe CSV with period/scope metadata. Excel report/Excel selected export the same current filtered/selected learner projection, including the existing dynamically configured fee for learners without a saved balance. The source fee-balance read is paginated; fee calculations are unchanged. These table exports cover the learners supplied to this view, whereas Download records reads every authorised saved record directly.

Expenses & Cashbook → Download records: the expense ledger, with date, campus, category, supplier, description, USD amount, method/reference, status, submitter and approval trail. The screen and export now page beyond the API row limit. Pending, approved and rejected totals are kept separate. This is the existing expenditure cashbook; it is not a newly invented combined income/cash reconciliation ledger.

Inventory & POS → Download records: stock/sizes, POS receipts and parent order history, with CSV and genuine XLSX. Campus admins retain stock/POS access; parent order exports are offered only to Main Admin and campus accountants, matching existing order policies. Accountants are offered sales/orders only; they receive no product-management controls. All-date downloads explicitly include all statuses. The existing stock/receipt/P&L CSV actions retain their current screen filters and now include currency/scope metadata and formula protection. Stock CSV includes campus, active status and per-size stock. Receipt CSV includes saved sale lines.

Stock exports have one row per variant, including hidden sizes; unsized products have one row. They do not add parent stock to its variants. POS receipts keep sale totals distinct from cash tendered, and provide a separate saved-line section/sheet with historical product name, size, unit price, quantity, line total and original cost (blank means unknown). Parent orders similarly export their saved JSON lines, without resolving names/prices from today's catalog. Pending and rejected parent orders are not counted as verified collections.

Each full download includes school, report, USD currency, campus authority, all-date/all-status scope, generation timestamp, source count and relevant reconciliation totals. CSV contains labelled sections and details; XLSX contains a report sheet, saved-line sheet where applicable, and Export details. These files are analytical extracts, not issued invoices or replacement official receipts. No separate invoice issuance module/table was found; adding one is outside this export-only stage. Existing POS receipt printing remains the route for an individual receipt.

## Reliability and print

Read-only browser requests retain existing RLS and add the assigned campus filter; no service key or privileged export function is introduced. Queries use deterministic ID ordering and pages of 500; a failed page produces an error and no partial file. More than 50,000 source records fails explicitly. Full exports have a 30-second timeout, busy protection, cancellation on unmount and retry buttons. XLSX is generated locally through the already installed lazy-loaded library. Text cells preserve identifiers/leading zeroes and cannot become formulas. CSV neutralizes formula-like text even following whitespace/control characters, while actual negative numeric balances stay numeric.

Paged extracts can reflect concurrent edits between requests; their details say to refresh after edits. They are not an atomic database snapshot. All-date export filters do not follow the independent fee-table month/search controls; labels explicitly state that distinction.

A real PDF check found one POS receipt repeating on three pages because fixed positioning repeated it while hidden portal layout still occupied space. Receipt printing now marks its ancestry, removes unrelated layout from print flow, and uses normal document flow on A4 portrait. Page setup/title are installed only during receipt printing and restored afterward. The verified single-item receipt is now one page, showing $15 total, $20 received and $5 change. No amounts or receipt-generation logic changed. Long receipts can continue onto further pages.

## SQL and verification

No schema changes to apply. Run these files manually in SQL Editor if rechecking deployment:

1. `supabase/verification/stage11_operations_export_checks.sql`: all eight source tables must have RLS enabled; snapshot/payment columns and foreign-key relationships must exist.
2. `supabase/verification/stage11_operations_export_access.sql`: read-only impersonation of existing role identities using current JWT helpers. It raises on cross-campus finance exposure, incomplete authorised payment ledgers, or teacher/parent visibility of POS/expenses. Live result: 9 campus/completeness checks, 3 non-finance identities denied, MFA still paused true. Only counts leave the transaction.

The Supabase CLI returns only the last SELECT when given several; use SQL Editor to see every result in the structural check file. No real invoices, payments, orders, expenses, promotions or source rows were written during verification.

## Automated and school acceptance

- `node --test tests/operations-export.test.mjs`: formula safety, identifiers, 1,007-row pagination, failure/abort/explicit limit, fees including credit balances, status totals, unknown costs, per-size stock and historical names/prices.
- `node tests/operations-export.browser.mjs`: actual CSV/XLSX downloads at 320/390/768/1280px, all 1,007 cashbook records, failed-connection retry, displayed fee totals by finance role, stock/POS/order files and permitted report choices. No business-table writes.
- `node tests/operations-export-print.browser.mjs`: actual filtered/selected fee workbooks and receipt PDF; print title/body-state restoration.
- `python tests/operations-export-files.verify.py`: openpyxl/CSV/pypdf check every generated cashbook row, amounts, literal text, stock sizes, old order names, fee subsets and receipt content/page count. Receipt PDF rendered with Poppler and inspected visually; mobile export panel also inspected.
- Existing campus POS, parent campus order and security database tests passed. Existing finance mobile and 89 workflow/layout views passed. New/refactored JS lint passed; FeesDashboard has the same pre-existing lint findings. Production build passed.

School acceptance: compare a filtered fee CSV/Excel and selected learner export against the fee table; compare saved balances and payment ledger separately; reconcile cashbook statuses; export both campuses as Main Admin and one campus as accountant; compare stock sizes and hidden sizes; rename a product and confirm old sale/order lines retain the original name/price; print a receipt and confirm one copy with correct tender/change. Disconnect during export, verify no partial file, then reconnect and retry. Do not alter real financial transactions solely for this acceptance test.

Next stage: 12, academic and attendance exports/printing.
