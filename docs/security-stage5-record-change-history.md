# Stage 5 — reliable learner, marks and attendance correction history

The existing activity feed accepts best-effort browser events. A browser can omit those events, and they do not preserve a complete correction delta. The new Record changes view in Activity log reads a separate database-authored trail.

## Coverage and identity

AFTER-row triggers capture committed INSERT, UPDATE and DELETE operations on students, academic_records, attendance, coursework_marks, junior_component_marks and junior_developmental_ratings. They store the changed fields and before/after values, learner/record identifiers, context and server time. Same-value and timestamp/editor-only updates do not create noise. Field allowlists prevent new schema columns being copied without review. Corrections that fail or roll back also roll back their audit events.

Actor ID comes from auth.uid(); name and active role are snapshotted from the profile. Browser-supplied recorded_by is not trusted as audit identity. A service/database operation without a user JWT is labelled as such rather than attributed to a human. Actor and learner IDs have no foreign keys so deletion does not erase history. Database owners/operators retain their normal privileged powers; the trail is immutable to application clients, not an external tamper-proof archive.

## Access and display

Existing is_main_school_admin(), can_read_school_campus() and portal_mfa_satisfied() helpers enforce access. Main Admin reads the school trail; campus administrators/principals read their own campus. Teachers, accountants and parents cannot read it. Cross-campus transfer details require access to both old and new campuses. Unresolved-campus cascade-deletion events are Main Admin-only. Campus snapshots belong to the changed record, so moving the actor later does not move old history between campuses.

Authenticated clients receive SELECT only and no direct trigger-function execution. Anonymous users have no access. Service credentials have SELECT only on the history table; the owner-executed trigger writes it. The table includes the restrictive admin MFA policy.

Activity log → Record changes shows expandable before/after cards, learner-name and record-type search, date filters in Zimbabwe time, 50-record pages, refresh and recoverable loading errors. Later pages retain the first page's server timestamp boundary; Refresh starts a new view. This UI provides no edit or delete action. Sensitive changed learner details are visible only within the database-enforced management scope.

## Focused rollout and checks

1. Apply only supabase/migrations/20261019100000_school_record_change_history.sql. No historical migration batch or data reset is required. Record it as version 20261019100000 in supabase_migrations.schema_migrations.
2. Run supabase/verification/security_stage5_record_history_checks.sql. Expect six enabled triggers, RLS/MFA and client_immutable true, anonymous_read/client_capture_execute/service_history_mutation false.
3. Run supabase/verification/security_stage5_record_history_transaction.sql. It changes one learner name inside a transaction, validates the actor/delta and existing role/campus scopes, proves aal1 admin denial, then explicitly rolls everything back. A failure aborts the transaction.
4. Publish the frontend and open Activity log → Record changes as a verified administrator. Narrow by learner or dates, expand a change and compare Before/After. Historical corrections before activation cannot be reconstructed; this starts a forward-only trail.

Tests: node --test tests/school-record-history.test.mjs and node tests/school-record-history.browser.mjs, plus existing security and portal layout regressions. The SQL test executes the actual migration and existing role/MFA helpers, not just string assertions. Browser fixtures verify pagination, filters, retry and 320/390/667/1280px layouts without changing live records.

Verified 19 October 2026 on linked project ejrtmdvnumjwikehzrrk:

- The focused migration and version 20261019100000 history entry are live. Six triggers are enabled; RLS and restrictive MFA are enabled. Anonymous read, client capture execution and direct service history mutation are false; client_immutable is true.
- Live rollback probe captured the correct authenticated Main Admin and before/after values. Existing authorised Junior managers could read the event; other campus/role scopes were denied; aal1 Main Admin was denied. The probe rolled back and left zero audit events.
- Eight before/after data fingerprints match exactly: all six source tables plus fee_balances and fee_payments. No learner, marks, attendance or finance record was changed by rollout or verification.
- 22 security/registration/core portal tests, five new browser acceptance scenarios and all 80 existing staff layout checks passed. The staff browser suite also passed its accountant navigation, financial dialog and enrolment checks. Targeted lint and production build passed; the JavaScript entry remains about 457 KB.
- The 390px expanded before/after card was visually inspected. Private QA screenshots and database metadata/fingerprints remain in ignored tmp/. Hosted signed-in administrator acceptance and physical-device testing remain separate from these fixtures and SQL RLS probes.

If capture must be suspended by a database operator, disable the school_record_change_history trigger on the six listed source tables and revert the frontend commit. Keep school_record_changes and its read restrictions intact so collected history is preserved. Re-enable the same triggers after resolving the failure; suspension creates a documented audit gap. No suspension or history deletion is performed by this delivery.

This stage does not implement academic year/term rollover, promotion, marks locking or finance auditing. It does not claim to backfill earlier corrections or verify a human behind a service-role maintenance request.
