# Stage 9 — reporting periods and database marks locking

Academic services → Terms & marks locking lets Main Admin manage either campus and campus admins manage only their own. Every create, close, reopen and current-period change needs an 8–500 character reason. Existing active-role and MFA helpers apply. Principals, accountants, teachers and parents cannot manage periods. Staff read only the term metadata permitted by their campus; event history is administrator-only.

Closing prevents INSERT/UPDATE/DELETE in academic_records, junior_component_marks, junior_developmental_ratings, report_card_comments, coursework_assessments and coursework_marks. The database checks both OLD and NEW periods on updates, so changing the year, learner or assessment cannot escape a closed source period. Mark transactions share-lock the registry row; close/reopen takes an exclusive row lock. Direct API and trusted database writes still run these triggers. Scope/ownership policies remain in addition to period checks.

One open period per campus may be current. Creating or reopening does not make it current automatically. Closing the current period clears that designation. Stale revision checks reject concurrent administrative decisions. Each transition retains actor/name/time/reason and before/after period state in an immutable-to-client event table, including clearing the previous current term.

New Junior/Senior coursework assessments now default to the registry's current year/term. Missing or unavailable current configuration blocks creation with an explanation; existing assessments retain their recorded periods. A school can deliberately select a different current term than the calendar estimate. Other calendar defaults, fees, term dates and result-release/payment rules are deliberately unchanged; a closed period can be viewed and printed under the existing release/access rules. Attendance, behavior, sports and awards are not marks-lock targets in this phase.

## Deployment and exact manual verification

Apply only `supabase/migrations/20261019140000_reporting_terms_and_marks_locks.sql`, recording version 20261019140000 in the deployment transaction. Existing reporting contexts and assessment periods begin OPEN to preserve editing behavior. Current Zimbabwe calendar terms are initially current. Reapplying must not reopen closed terms or overwrite administrator choices.

Run manually:

1. `supabase/verification/stage9_reporting_period_checks.sql`: booleans true, locked_table_paths = 6, two initial current campus periods, zero automatically closed periods.
2. `supabase/verification/stage9_reporting_period_access.sql`: READ ONLY actual role/campus metadata scope plus direct management/MFA denials.
3. `supabase/verification/stage9_reporting_period_rollback.sql`: temporarily closes both 2026 Term 3 campus periods, tries six mark paths, reopens with attributed reasons and permits an edit, then ALWAYS ROLLBACKs. Keep ROLLBACK; this is acceptance, not a real end-of-term closure.

Live rollout on 19 October 2026 installed on ejrtmdvnumjwikehzrrk. All installation checks passed: six guarded tables, no direct client writes, anonymous management denied, zero closed and two current periods. Eight role/campus metadata probes, five non-admin management denials and password-only admin denial passed. The rollback check denied all six closed write paths, allowed an edit after reopening and verified attribution. Before/after counts and fingerprints matched all 12 original source tables from Stage 7. No real closure or test marks were retained.

## Tests and school acceptance

`npm run test:reporting-periods` covers actual migration behavior, all write paths, closed-source period-move attempts, migration reapplication, stale revisions, scoped control, current-term uniqueness and immutable event grants. Browser fixtures test close/reopen review at 320/390/667/1280px, registry defaults differing from the calendar in both coursework modules, fail-closed creation without a current period and denied management navigation. The existing teacher suite passes 24 coursework scenarios, 12 surrounding workspace views and ECD navigation. New modules pass lint and production build passes; unrelated existing repository lint findings are not claimed resolved.

The combined security/registration/history/lifecycle database run passed 21 tests. Both teacher draft suites passed Junior/Senior failed-save retry, invalid-mark handling, discard cancellation, native Back/Forward and pending-save protection. HEAD comparison confirmed unchanged existing lint findings in CourseWork (4) and JuniorCourseWork (8); the new registry component/hook have none.

In the test environment create/open the intended next term, set it current, create an assessment as the assigned teacher and verify its year/term. Close that period as the campus admin, try mark save and direct API edits (both must fail), reopen with a correction reason, save and inspect the event trail. Check the other campus is unaffected and old reports still render. Signed-in hosted and physical-device school acceptance is separate from fixture and SQL role testing.

Recovery for an accidentally closed term is the guarded reopen action with a reason, then optionally set current. Never drop guards or erase period events to permit an edit. Restore procedures must preserve contexts, lifecycle operations and period events together. Backups/restore evidence, separate test/live setup, Zimbabwe configuration and full handover/go-live acceptance remain follow-on work; this stage does not certify those items.
