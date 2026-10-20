# Stage 15 — handover and go-live

Updated 20 October 2026. This guide describes the delivered portal and the school acceptance still required. A completed software stage is not school sign-off.

## Current release and known limits

Frontend releases are pushed to GitHub master. The latest source commit is `d7f1556` (`Require campus for main admin expenses`). The latest recorded Vercel production deployment evidence for both configured projects is still on `58996ea`; deployment of newer commits has not been verified here. Verify the exact commit, migration version and hosted build before staff use a new workflow.

The active backend is recorded as Supabase project ejrtmdvnumjwikehzrrk. The account inventory found one project and no preview branch. The public Vite Supabase URL and anon key were verified in Production and Preview on both Vercel projects. The tracked `.env` was removed after that check; the local file was preserved. Vercel Preview still targets the same Supabase backend, so an isolated test environment is not established. The repo ignores new environment files. Never put a privileged key in frontend config.

Admin authenticator enforcement is paused at the owner's request. Password login, database role checks and campus restrictions remain in force. Do not enable MFA in a routine release. Re-enable only after explicit owner authorization and a tested setup, clock and recovery path; see admin-mfa-temporary-pause.md.

Open go-live items include backup and isolated restore evidence; a separate test backend; school confirmation of 63 inferred historical report contexts; approved Ministry/ZIMSEC report templates; entry and verification of any ZWG fee bands the school intends to use; and account-by-account role/campus acceptance. Finance supports USD and ZWG per record without exchange conversion. There is no invoice issuance workflow or combined income-and-expense cash reconciliation ledger.

## Roles and access

Database policies and existing role/campus helpers enforce access; navigation alone is not the security boundary. Use individual accounts, never shared logins.

| Role | Campus scope | Work and limits |
|---|---|---|
| Main Admin | School-wide, Junior and Senior | Manage school settings/staff, learners, academics, both campus catalogs and stock, POS and permitted exports. Permanent product deletion is reserved for Main Admin and allowed only with no order or POS history. |
| Junior or Senior Admin | Assigned campus only | Manage campus learners, classes, academic workflows, catalog/photos/sizes/stock and permitted reports. No cross-campus access. |
| Accountant | Assigned campus only | Finance actions and campus POS sales/receipts as granted. Cannot add/edit/hide/delete products, edit variants or adjust catalog stock. |
| Teacher | Assigned classes, subjects and campus | Record assigned attendance and academic data. No finance, staff, catalog or POS management. |
| Parent | Linked learner(s) only | View released information for linked learners. Uniform catalog follows each learner's campus. No staff tools or unrelated family records. |
| Principal | Permitted read-only scope | Review available reports; no finance actions or staff/catalog mutations. |

Missing or invalid campus assignments are denied, not guessed. Some live probes had empty source samples; stage docs distinguish those from positive fixture tests.

## Daily role guides

### Main Admin
1. Check the selected campus and school year before reviewing totals.
2. For admissions and corrections, verify identity, guardian, campus, class and admission identifier. Use the correction reason and inspect saved history.
3. Before rollover, check source year, class capacity and each report context against the school register. Review decisions and reason before applying. For an uncertain response, inspect operation history and retry the identical request. Never submit a replacement batch. Use only the guarded reversal flow when eligible.
4. Set up classes, subjects and teacher assignments before term work. Follow the approved schedule for opening periods, locking marks and releasing results.
5. Manage products and per-size stock in Inventory & POS; allocate unassigned legacy stock. Hide products with order history. Delete only when no order or POS sale exists. Historical lines retain the name and unit price captured at purchase.
6. Check role and campus assignments when staff join, transfer or leave. Do not change roles through user-editable profile metadata.

### Campus Admin
1. Confirm your assigned campus. Learners, catalog, stock and reports should remain within it.
2. Keep admission, guardian, class and campus details accurate. Confirm classes, subjects and teacher assignments before term work.
3. Follow reporting-period locks and result-release controls. Verify campus scope on exports.
4. Manage this campus's uniform products, photos, sizes and stock adjustments with a reason. Escalate cross-campus allocation, school-wide settings, deletion and rollover issues to Main Admin.

### Accountant
1. Confirm the campus shown in Finance or Inventory & POS. Stop and ask Main Admin if missing or incorrect.
2. Use existing fee/payment/expense screens and preserve references and notes. Do not rewrite old amounts to reconcile a report.
3. In POS choose campus, item, size and quantity; check stock and amount received; then verify the saved receipt. On timeout, inspect receipt history before retrying.
4. Check campus, date, status and USD label in each export. Exports are analytical files; they do not issue invoices.
5. Refer product, photo, size and stock-catalog corrections to an admin. Accountant accounts cannot edit catalog or stock.

### Teacher
1. Work only in assigned classes and subjects. Request an allocation correction if a class or learner is missing.
2. Record attendance for the selected class/date and confirm it saved. An unmarked day is not an absence.
3. Enter marks for the right subject, term and assessment; save and verify them. Unsaved values are not recorded results. Respect locked periods.
4. Export only assigned data. Escalate historical placement corrections to an administrator.

### Parent
1. Sign into your own account and select the linked learner.
2. Review announcements, attendance, released reports and fees on that learner's profile. Existing fee-release rules may restrict a report.
3. Uniforms follow the selected learner's campus. Choose size and quantity, review the order and submit it for school verification. The shop records an order; it does not charge an external payment service.
4. If a learner is missing, assigned to the wrong campus or sees the wrong catalog, stop and contact the school office. Do not access another family's account.

## Corrections, connection loss and support

For a correction, identify the record and its campus/year/term. Use the correction workflow and reason field where available, then check history. Audit coverage applies to specific operations and tables; not every login, read or table has a complete school-wide audit trail.

If a request times out or the browser goes offline, wait for connection restored and inspect the saved learner, receipt, order or operation history before retrying. Do not assume it failed or create a second payment, sale, mark batch or rollover. The portal does not queue writes or retry automatically. Use the same request ID only where that workflow explicitly supports idempotent retry.

For lockout, wrong campus, missing menu or a suspected cross-campus record, stop the action and report the account role, assigned campus, screen and approximate time to Main Admin. Do not send passwords, authenticator keys, reset links, learner exports or database dumps in chat. MFA is currently paused, so administrator sign-in does not require authenticator setup.

Preserve incorrect fee, payment, receipt, order, attendance and academic records with their history. Escalate to the designated school owner/Main Admin. Never clear production history to fix a test or reporting issue.

## Deployment and rollback

1. Push a reviewed stage commit to GitHub master. Check both Vercel deployments and confirm the hosted revision before announcing the release.
2. Treat Supabase schema and Edge Function deployments separately. Confirm the project reference, inspect the exact reviewed migration and verification queries, apply only that migration in its documented order, then reconcile migration history. Never replay historical/reset migrations or run a blanket database push without inspecting pending changes.
3. For a frontend defect, revert the frontend commit or push a reviewed correction and verify both deployments. For schema changes, prefer a narrow forward fix. Roll back only when stage instructions describe a safe rollback and confirm no school data depends on the change.
4. Never restore known broad campus/RPC policies, clear audit trails, or drop rollover history. After release, run focused tests, SQL verification and small role/campus checks with test identities. Do not create real payments, promotions, sales, fees or learner records as smoke tests.

## School go-live checklist

Record tester, date, role/campus, result and evidence without learner-identifying data.

| Check | Status |
|---|---|
| Main Admin, campus admins, accountant, teacher and parent sign in and see only permitted workspace/campus | Pending school account acceptance |
| Junior parent sees Junior catalog only; Senior parent sees Senior catalog only; linked learner/report scope is correct | Pending school account acceptance |
| Accountant completes a campus POS sale; product, variant and stock management remain unavailable | Automated/RLS checks documented; repeat with school test account |
| Admission, guardian, learner correction and approved promotion are checked; old report context remains intact | Pending; 63 inferred contexts need register confirmation |
| Teacher attendance and marks are checked for assigned class/subject and locked-period behavior | Automated and role checks documented; school acceptance pending |
| Fees, instalments, arrears, expenses and receipt print are compared with school records | Export/fixture checks passed; accounting acceptance pending |
| Exports/print are checked on phone and desktop with correct campus, dates, currency and selected rows | Automated evidence in stage docs; school acceptance pending |
| Vercel production/preview Supabase settings are verified; tracked public-only .env is removed only after settings are confirmed | Complete 20 Oct 2026; both projects configured and production deployments Ready on `58996ea`; local `.env` preserved |
| Encrypted backup destination, schedule, retention and owner are recorded; isolated restore succeeds | Pending; no restore evidence |
| Separate test environment is approved; test users cannot affect live records | Pending; only one Supabase project found |
| Currency scope is approved and amounts remain separate by currency | Approved: USD + ZWG per record, with no conversion; currency-aware fields and calculations delivered in Stage 13. Any ZWG fee bands still need school-entered values and verification. |
| School-approved Ministry/ZIMSEC templates and mappings are reviewed before compatibility is claimed | Pending; templates not supplied |
| MFA decision and recovery owner are recorded; setup/recovery is tested before enforcement if re-enabled | Paused by owner; do not re-enable without authorization |
| Main Admin confirms campus assignment for active staff/accountants and processes leavers | Pending school roster review |

Do not call the portal fully production-ready until the school has reviewed pending items and accepted the remaining risks.

## Stage record

Stage 15 handover guidance is prepared here and in the repository README. Vercel configuration and production deployment evidence were recorded on 20 October 2026. Delivery stages 13–14 and school-owned go-live checks remain partial; keep them open until evidence is recorded.
