# Stage 4 — student registration consistency and atomic linking

Inspection found that the published `register-student` required a phone and numeric admission number, while the legacy form used an admission-based email and an unpublished underscore endpoint. Both Edge implementations also inserted class/year columns that do not exist in the live `student_accounts` table. They hard-coded 2026 and streams that excluded current classes. None of the student signup/login/dashboard routes are currently mounted in App.jsx.

## Changes

- One shared handler behind the published hyphenated endpoint and the unpublished legacy source alias. The form invokes the published endpoint. Public routing is unchanged: this stage does not launch the student portal.
- Admission-based emails without a required phone. Canonical school admission casing, including ECD, and strict calendar dates. Password limits are consistent on both sides. Existing Auth emails are not renamed.
- The learner record supplies campus, class and stream; submitted selections must match it. Current class names such as Lower Six do not need a code change. The learner's enrollment year remains untouched.
- A service-only SQL transaction locks the learner and checks the DOB, active status, class, campus and unclaimed account again. It links the learner, creates the verified account and provisions only student membership together. Client-supplied roles/campus are ignored. No payment, order, fee or existing learner data is migrated.
- Auth cleanup follows confirmed transaction failure only. If a network response is lost after commit, the linked account is retained and success is recovered. If the outcome cannot be read, the account is preserved for operator diagnosis. Logs contain fixed diagnostic codes only.

## Rollout

Apply only `supabase/migrations/20261017130000_atomic_student_registration.sql`, then deploy `register-student`, preserving its existing `verify_jwt=false` public registration setting. Do not run blanket db push. The legacy underscore source is not newly published. Run `supabase/verification/security_stage4_registration_checks.sql`; expect anon=false, authenticated=false, service=true and admin MFA=true.

## Acceptance

`node --test tests/student-registration.test.mjs` exercises the real completion SQL using an isolated PostgreSQL-compatible database, including HTTP validation, ECD/no-stream/Sixth Form, role spoofing, rollback, concurrent attempts and lost-response recovery. These synthetic fixtures do not touch live learners. Run security regression tests, targeted lint and the production build as well.

Verified on 19 October 2026:

- Registration acceptance and security stages 1–3: 15 tests passed. Core portal regression: 6 tests passed during this stage. Targeted lint and production build passed.
- Live completion routine installed; migration history contains `20261017130000`. Execute grants are anon=false, authenticated=false, service=true. Mandatory admin MFA remains enabled.
- Published `register-student` version 8 retains `verify_jwt=false`. `node scripts/verify-student-registration-live.mjs` passed method, malformed-input, invalid-calendar-date, nonexistent-learner and anonymous completion denial checks without creating any accounts.
- `supabase/verification/security_stage4_registration_transaction.sql` passed against the real schema, including profile/membership/campus provisioning and duplicate-claim rejection. The explicit rollback left zero temporary Auth accounts and zero temporary learners.
- Before/after counts are unchanged: 63 learners, 38 Auth users, zero student accounts and 60 fee-balance rows. No real learner was registered by acceptance testing.

Student portal navigation and real-device student sign-in are not accepted or launched by this stage. Registration remains a public identity-verification endpoint based on school admission details; CAPTCHA/rate limiting is a separate abuse-control requirement. Existing student accounts using older email identifiers require an explicit identity migration before any future student-portal launch.
