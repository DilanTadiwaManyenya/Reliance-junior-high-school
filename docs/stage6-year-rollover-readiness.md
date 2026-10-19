# Stage 6 — next-year rollover readiness

Inspection found no promotion or academic-year rollover workflow. AcademicReportCard currently derives its report identity/curriculum from student.class_level/class_stream. Updating the current learner roster before preserving historical enrollment context would change how older reports render. Stage 6 therefore provides an operational planning review; the following stages are in academic-lifecycle-stages.md.

## Delivered scope

Administrators open Academic services → Year rollover readiness. Main Admin can review Junior and Senior separately. Campus admins have a fixed assigned campus. The current active roster is reviewed for the next calendar year using the Zimbabwe date, independently of enrolled_year, which remains the original admission year.

The database returns page-limited rows, school-level progression suggestions, registered destination class choices and review statuses. It uses active school_classes records rather than inventing streams. Standard progression has an unambiguous same-stream destination; it is still a suggestion for school review. Grade 7→Form 1, Form 4→Lower Six and final-year completion are always review cases. Legacy Form 5/6 aliases are recognized. Missing/inactive source or target classes, unknown levels, future enrollment years and stream mismatches are flagged. Junior admins receive no Senior destination class records.

The screen includes literal name/admission search, summary counts across the filtered roster, 50-row pages, retry/refresh and CSV export of the loaded review. The export label and loaded/total count make its scope explicit. UTF-8 CSV quotes names/streams and neutralizes spreadsheet formulas. No decisions are saved, no promotion/completion is applied, and no fee, term, admission identifier, academic record or stock row is changed. Current class capacity is not a next-year occupancy projection; the UI explicitly requires school capacity and placement review.

## Security and SQL

Apply only supabase/migrations/20261019110000_rollover_readiness_preview.sql and record version 20261019110000. The new STABLE SECURITY DEFINER RPC has an explicit search path and uses has_active_role('admin') and can_manage_school_campus(), which enforce existing active membership, campus and MFA requirements. Anonymous EXECUTE is revoked. Accountants, teachers, parents, principals, unassigned admins and password-only admin sessions are denied even when calling the RPC directly. Search is a bound literal comparison; page/filter limits are validated server-side.

Run supabase/verification/stage6_rollover_readiness_checks.sql for installation/grants/MFA metadata. Run supabase/verification/stage6_rollover_readiness_access.sql for READ ONLY probes using existing live role/campus scopes. It prints aggregate counts rather than learner identities. Both preserve existing records.

Tests: node --test tests/year-rollover-readiness.test.mjs; node tests/year-rollover-readiness.browser.mjs. The database test runs the actual preview SQL and existing role/MFA helpers and verifies unchanged learner/admission/fee rows. Browser fixtures cover CSV, search, pagination, campus controls, denied role navigation, recovery and 320/390/667/1280px layout. Hosted signed-in and physical-device acceptance are separate from these fixtures and SQL role probes.

## Verified rollout — 19 October 2026

- Installed on linked project ejrtmdvnumjwikehzrrk with migration history version 20261019110000. Anonymous execution is false; the read-only/admin/campus guards and mandatory MFA checks are true.
- The live READ ONLY probe passed four authorized campus scopes and twelve denied role/campus scopes, plus password-only Main Admin denial. It emitted no learner identities and changed no records.
- All eight before/after fingerprints matched: students, academic_records, attendance, coursework_marks, junior_component_marks, junior_developmental_ratings, fee_balances and fee_payments.
- 24 database/security/core tests passed. New browser checks passed all four viewport widths, both fixed campus-admin views, connection recovery and denial of accountant/teacher/parent/principal navigation. The existing staff browser suite passed 80 layouts, accountant navigation, financial dialogs and enrolment.
- New modules and the modified sidebar pass lint. Comparison with HEAD confirms unchanged existing lint findings in StaffDashboard (five unused-variable errors and one dependency warning) and StaffPortalLayout (two Fast Refresh export errors). Those unrelated findings were not suppressed or refactored. Production build passed, with the entry JavaScript about 457 KB.
- The mobile review layout was visually inspected. Synthetic screenshots and private aggregate fingerprints remain in ignored tmp/.

Recovery is a frontend revert plus, if required, revoking authenticated EXECUTE on public.preview_year_rollover(text,text,integer,integer). There are no promotion decisions or data changes to reverse. No recovery action is executed by this stage.
