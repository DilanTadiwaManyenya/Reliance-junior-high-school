# Teacher portal audit: 20–21 October 2026

This audit used the supplied existing Senior teacher account and read-only navigation, plus one explicitly labelled private draft upload. No marks, attendance, learners, assessments, parent publications or financial records were created/changed for testing.

## Confirmed defects and fixes

| Finding | Evidence and disposition |
|---|---|
| New teacher notes failed with row-level security errors | Reproduced in the signed-in production browser. `INSERT RETURNING` hit the read helper before it could see the new row. Fixed by a minimal insert followed by a separate authorized read; policies unchanged. Production draft and actual file upload then succeeded. |
| Admin newsletter creation used the same broken request shape | Confirmed by rollback-only authenticated SQL. The Admin insert now avoids RETURNING. Real Admin browser publication still needs its own approved test audience/session. |
| Lower Six/Upper Six were rejected by content class constraints | Existing allocations use these confirmed school labels. The narrow class check migration and newsletter choices now support them alongside Form 5/6. All 67 enabled subject allocations, including 22 sixth-form allocations, passed the create/read/reservation test. |
| Legacy announcement bell used an unsupported upsert and alert | Previously unused component replaced by a learner-preserving link to the same parent feed. Opening it does not acknowledge a notice. |

The first three fixes are pushed in `42caad5`, observed Ready on both Vercel production projects on 20 October. See `library-live-create-fix.md` for the exact request-boundary regression and sixth-form migration.

## Wider live checks completed

- Class work and Subject work expose the teacher's allocations. Grade entry without an allocation leads to the allocation chooser rather than silently choosing another subject.
- The selected sixth-form subject markbook loads the correct subject/class scope and learner count. Saving is disabled without selecting a learner. No marks were entered.
- Coursework retains that allocation and loads the current 2026 Term 3 period. No assessment or mark was created.
- Direct mobile navigation from coursework to library retained subject/form and closed the drawer. Library period fields populated after loading; an initial blank placeholder was not treated as a defect.
- Mobile inspection found no page overflow or visible controls under 40px in the inspected coursework view. The teacher drawer did not expose Admin/finance actions.
- A direct request for Staff Management under the teacher route returned to the teacher dashboard without exposing staff data.
- Switching the class-work scope updated the roster/count. Attendance controls were inspected but not clicked; no register was changed.
- The assigned-class Add learner form is deliberately present in the existing teacher workflow. It was not removed based on an assumption about role policy.
- No warning/error entries were returned by the inspected teacher audit tab's runtime log.

These observations do not establish that every teacher workflow or physical device is defect-free. Junior/ECD behavior is covered by fixtures and SQL, not this Senior browser session.

## Open admissions defect — separate finance-related repair

`seed_fee_account_for_new_learner()` still uses `ON CONFLICT (student_id, term, academic_year)` on `fee_balances`, while currency-aware uniqueness includes currency. An earlier rollback-only probe already failed with no matching unique constraint; this audit rechecked the unchanged function and currency migration. It can block the assigned teacher's Add learner workflow as well as other admissions workflows.

No real learner was submitted to reproduce it in the browser, and this library release does not change fee seeding or existing amounts. The next targeted repair should reconcile the conflict target and explicitly select the intended currency's fee band, with rollback-only admission/fee tests. Updating only the conflict key without checking the now multi-currency band lookup would be incomplete.

## Outstanding acceptance

The actual teacher draft/212 KB attachment upload succeeded and a private download link appeared. The byte-download automation timed out after link expiry; it is not recorded as passed. Later browser archive interaction also timed out. On 21 October the uniquely identified, never-published test note was archived through Supabase under its teacher's existing role checks; the finalized attachment and history were preserved, and Storage integrity checks passed. UI archive/download acceptance remains open.

Parent, Junior teacher, campus Admin/accountant and newsletter publication still need their signed-in pilot sessions and an agreed test audience. Do not infer those results from the successful Senior draft or from mocked browser tests.
