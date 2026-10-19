# Stage 8 — reviewed year rollover

Academic services → Reviewed year rollover is an administrator-only workflow. The original readiness preview remains read-only. Main Admin can place learners across campuses; campus admins can place only within their campus. Parents, teachers, principals and accountants cannot call the workflow RPCs. Existing active-role and MFA guards are reused.

Every selected learner needs an explicit promotion, same-level retention, same-level stream transfer or final-year completion decision. Sixth Form entry is never automatic. Completion deactivates a Grade 7, Form 4 or Upper Six/Form 6 learner and retains history; existing inactive-learner release rules still apply. All source-year report contexts must be school-confirmed and the latest context must match the current roster. Initially the 63 inferred contexts therefore block application until school verification; this phase does not certify them for the school.

The school provides a reason, validates a maximum of 100 placements, reviews projected occupancy, checks the school-approved date, then applies. This updates the current roster immediately, so it is an end-of-year operation, not a future scheduling tool. Admissions, enrolled_year, fees, payments and source marks are not rewritten. The lifecycle baseline is captured at installation; each learner advances one year per accepted operation, with future-year advancement blocked until that calendar year. Classes and staff allocations still need school setup.

## Database safeguards

The database locks the roster and class registry for the short batch transaction, checks full-row review fingerprints, source year, report verification, valid destination level/campus, final-year completion and projected capacity. Every decision is validated before any roster update. Atomic batches retain actor, reason, before/after roster, source/target years and a request fingerprint. A unique applied learner/source-year index and exact-payload batch retries prevent duplicate application after response loss. Browser changes invalidate the preview. Uncertain apply responses keep the same frozen request/ID for retry.

Main Admin can reverse a whole batch with a reason only while placements still match, no later rollover exists, no new-year context exists, and original active classes have capacity. Reversal retains the original operation and records actor/time/reason. Later teaching or subsequent placements require a separately reviewed correction; the system refuses a blind reset. Source table audit triggers continue to attribute learner changes. Browser/service roles cannot directly mutate the operation trail.

## Deployment and verification

Apply only `supabase/migrations/20261019130000_controlled_year_rollover.sql`, recording version 20261019130000 in the same transaction when using migration history. No historical migration batch is required. Manual verification:

1. `supabase/verification/stage8_rollover_checks.sql`: installation/security booleans true; rollout starts with zero batches/placements.
2. `supabase/verification/stage8_rollover_access.sql`: READ ONLY existing role/campus probes, including direct unauthorized apply and password-only admin denial.
3. `supabase/verification/stage8_rollover_rollback.sql`: temporary history confirmation, preview, retention, identical retry and Main Admin reversal. ALWAYS ROLLBACK; never remove that statement. No real placement is retained by acceptance.

Local acceptance uses `npm run test:rollover-workflow` with the browser runtime configured like the existing portal tests. Actual PostgreSQL-compatible migration tests cover history prerequisites, mismatched latest class, capacity, stale roster, duplicate payload, admission preservation, retention, cross-campus authority, completion, reversal and new-year evidence blocking. Browser fixtures cover 320/390/667/1280px, explicit preview/approval, disabled unverified rows, role navigation, read-only validation and exact lost-response retries. Production build and new-module lint pass. Physical-device and signed-in school acceptance remain separate from these fixture tests.

Live rollout on 19 October 2026: migration installed on ejrtmdvnumjwikehzrrk; installation booleans true, zero initial batches/placements. Four authorized campus scopes and twelve denied scopes passed, including password-only admin denial. Preview/retention/identical retry/reversal passed in an explicitly rolled-back transaction. Before/after counts and fingerprints matched all 12 original source tables tracked in Stage 7. No real learner placement was retained. The access probe's initially ambiguous local variable was qualified and the corrected file passed.

## School acceptance

Confirm historical context against registers first. In the proper test environment choose a small reviewed group, validate capacity, apply at the approved rollover date, verify current class and old reports, repeat the same batch request to demonstrate no duplication, then review a Main Admin reversal before new-year teaching. Do not create live test promotions outside the rollback script. If applying fails, refresh/review stale data; after an uncertain connection retry the exact batch and check its reference in recent history.

Operational recovery is guarded Main Admin reversal for eligible operations. Never delete batches/entries or drop the history tables to undo a placement. Term open/close and mark locking remain Stage 9; report export/configuration, test/live separation, backup restore evidence and handover remain later acceptance items.
