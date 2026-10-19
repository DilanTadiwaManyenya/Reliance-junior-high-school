# Academic lifecycle delivery after security stages 1–5

## Stage 6 — rollover readiness

Deliver a read-only administrator review of the current active roster, suggested next levels, active destination classes and transition/setup exceptions. Support Main Admin and assigned campus admins, search, pagination and an export for school review. This can go live without changing a learner, opening a term or generating fees.

## Stage 7 — preserve historical class context

Before applying promotions, capture each learner's class, stream and campus for each academic year/reporting period. Make report headers, curriculum, grades, teacher allocations, rankings and access rules use the selected historical context. Admission numbers remain permanent identifiers; enrolled_year remains the admission year. Clearly distinguish inferred legacy context from confirmed school records. An old report must not become a new class's report after a learner moves.

## Stage 8 — controlled promotion and year rollover

Add school-reviewed promotion, retention, completion and transfer decisions, with an explicit destination class/stream. Main Admin handles Junior→Senior transitions. Sixth Form entrance and final-year completion require school decisions. Preview totals and capacity before applying; reject changed/stale source rows, double application and unauthorized campus changes. Apply eligible decisions atomically with a permanent operation trail and a reviewed correction workflow. Existing reports, admissions and fee histories remain intact. Fee creation needs a separate explicit school policy, never an automatic duplicate charge.

## Stage 9 — terms and marks locking

Use a campus/year/term registry with controlled open/close/reopen actions and recorded reasons. Enforce closed-period writes in the database for all affected report/mark paths, including assessments, individual marks, Junior components and development ratings. Reopening requires the existing administrator/campus/MFA checks and an audit event. Move current-period defaults to the registry deliberately rather than changing calendar-derived defaults in unrelated modules at once.

## Following acceptance

Complete end-to-end report exports, Zimbabwe configuration, live/test separation, backup/restore evidence and role-specific handover/go-live checks against the user's original audit. These are separate acceptance items, not implied complete by an individual stage. Each implementation stage includes focused SQL, live verification, appropriate automated checks, its own commit/push and both hosted deployment results.
