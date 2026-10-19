# Stage 7 — historical reporting context

## Delivered behavior

Official report books select a saved year/term context rather than the learner's current class. Each context preserves campus, level, stream, admission identifier/year, class membership, curriculum, actual report grading rules and teacher names/signature initials. Junior and Senior ranking RPCs use the saved cohort and its captured active status. A later class move, withdrawal or staffing change cannot silently turn an old Junior report into a Senior report or change its comparison cohort.

Academic services → Historical reports lists 50 contexts per page with period/campus/name filters. Main Admin can review either campus; campus admins review only their campus. Accountants and principals have read-only history within their existing campus permissions. Verified families access their linked learner's historical periods from the report book. Teachers retain the existing allocated mark-entry paths; this does not create unrestricted teacher access to official report history.

An administrator can confirm up to 100 loaded contexts with an 8–500 character reason, or correct one context using a registered class. Cross-campus corrections require Main Admin. A class correction clears staffing; current assignments are copied only when the operator explicitly verifies that they are historically correct. Each review records actor, reason and changed fields in school_record_changes. Direct context writes are unavailable to browser roles and service_role; the guarded review RPC performs corrections. Reports with retained history require learner deactivation rather than permanent learner deletion.

## Honest legacy limitations

The previous schema had no historical enrollment evidence. Initial contexts therefore use the existing roster and are explicitly legacy_inferred, with a visible verification notice on screen and in print. They require school register review; migration is not evidence that the past class or staffing is correct. The initial live backfill created 63 inferred contexts, with zero automatically confirmed.

Rules are frozen from CurriculumData.js and GradeCalculator.js as actually rendered today. This does not claim that the separate grade-band administration feature is already connected to all report calculations. This stage preserves the existing scoring algorithms, including Junior component completeness counting. Future configuration and term registry work remain separate. Source marks/comments can still be corrected under existing permissions and audit rules: this is context retention, not a digitally sealed PDF archive. Next-term dates/fee schedules keep their existing configuration behavior.

## SQL deployment and manual verification

Apply only `supabase/migrations/20261019120000_historical_report_contexts.sql` in the linked project's SQL editor. It is one transaction and can be reapplied without overwriting captured or confirmed contexts. Do not run all older migrations: some contain historical data operations. The CLI deployment also records version 20261019120000 in supabase_migrations.schema_migrations in the same transaction.

Run these files manually, retaining each SELECT result:

1. `supabase/verification/stage7_historical_reports_checks.sql`: all installation booleans true, capture_trigger_count = 8, missing_period_contexts = 0; inspect inferred/confirmed totals.
2. `supabase/verification/stage7_historical_reports_access.sql`: read-only impersonation of existing role/campus scopes; expected count matches and password-only admin is denied. It also exercises the SECURITY INVOKER report bundle under actual source RLS/grants, including existing fee/result-release policies.
3. `supabase/verification/stage7_historical_reports_rollback.sql`: temporarily moves one marked Junior learner to an active Senior class and reviews its old context inside a transaction, then always ROLLBACKs. All four output checks must be true. Do not remove ROLLBACK or use this as a promotion action. Requires existing Main/Junior/Senior administrators and a marked Junior learner.

The report bundle is SECURITY INVOKER, so it does not bypass source-table result/fee policies. Additional historical staff SELECT policies retain old-campus access; restrictive period policies prevent a new campus gaining old marks through current learner ownership. Existing role helpers and mandatory admin MFA are reused. The insert-policy helper is VOLATILE so it sees contexts created by the BEFORE trigger in the same statement.

## Verification on 19 October 2026

- Migration/history installed on ejrtmdvnumjwikehzrrk. Installation booleans true, eight capture triggers and zero missing contexts.
- Eight live role/campus probes passed; password-only admin denied. Live rollback acceptance preserved class/rules/staff/rankings, admission and old/new campus boundaries; context review produced an attributed audit entry. All temporary changes rolled back.
- Before/after count and content fingerprints matched for 12 original tables: students, academic_records, attendance, coursework_marks, coursework_assessments, junior_component_marks, junior_developmental_ratings, report_card_comments, sports_records, student_awards, fee_balances and fee_payments. Private backups/evidence remain in ignored tmp/.
- Database acceptance covers Junior→Senior and O-Level→A-Level simulations, old cohort stability, grade rules, same-statement new-period teacher inserts, literal bulk-update campus denial, mixed-campus review rollback, invoker fee gate, MFA/grants and migration reapplication. Browser fixtures cover both transitions at 320/390/667/1280px, printed provenance, admin review, accountant/principal read-only history and failed-read recovery.
- Existing report-print check passed 45 role/class scenarios, using a matching campus accountant. Parent learner navigation/late-response isolation passed. Production build passed. New modules pass lint; pre-existing findings in AcademicReportCard, JuniorReportBook and StaffLearnerProfile were compared with HEAD and are unchanged (only line locations moved). Whole-repository lint is not claimed clean.
- Staff regression passed 80 page layouts, five accountant navigation routes, three financial dialogs and staff enrolment. The new historical-report route is also covered by its dedicated accountant/principal browser checks.

## School acceptance

Open an inferred report on a phone; compare class/stream and teacher names with the signed register. Confirm with a reason, or correct the one report class. Use staffing refresh only when current assignments match that historical period. Check the notice and change history, then reopen from the linked parent account. Use the rollback SQL to demonstrate a class move safely; no permanent promotions are delivered by Stage 7.

Recovery requires a coordinated frontend/database rollback by the operator, preserving report_period_contexts and its audit trail. Do not drop the table or disable its guards after real class moves. The previous summary definitions are saved privately before rollout; restoring them would reintroduce current-roster rankings and is not a safe long-term solution. Stage 8 will add reviewed promotions, retention and completion with stale/double-apply protection.
