# Stage 12 — academic and attendance exports

Implemented 20 October 2026. No database migration, marks write, grading calculation, result-release rule, fee calculation or promotion is part of this stage. Administrator MFA remains paused.

## Workflows

Academic progress → Historical academic export (administrators and principals): choose year, term, historical class/stream and permitted campus; prepare a batch, then CSV, Excel or printable extract. Selection uses `report_period_contexts`, not a learner's current class. Each report is read through the existing SECURITY INVOKER `read_report_period` function. Main Admin can select both campuses; assigned managers retain database campus policies. Other roles are not offered this batch workspace.

The batch contains Report contexts, Subjects, Components, Development and Report comments, plus Export details in Excel. It preserves captured learner/admission name, historical campus/class/stream, year/term and provenance. Subjects include stored score, percentage, exam mark, term mark, recorded grade and comment; components include scores/possible marks; developmental ratings and original report comments are separate sections. These are stored values, without recalculating old grades against current settings. A legacy/inferred context remains labelled for school verification.

An individual historical report card offers CSV/Excel for its selected year and term alongside the existing official print layout. The parent release check uses the same existing `totalOwing` helper and `adminAccess` override as the report card: no download controls while the card is fee-locked. The database reader also retains restrictive source-table result policies. Parent downloads use their already authorised report bundle; no broader read endpoint is added. A promotion to Senior does not relabel an old Junior report.

Teacher markbooks → Prepare saved marks export: Senior exports only the selected allocated subject, selected year/term and currently assigned learner IDs. Junior exports saved components and developmental ratings for the selected assigned class/year/term. Existing RLS still decides which rows can be read. These files explicitly label current learner class information; they do not pretend to reconstruct historical placements that teachers cannot read through the historical-context policy. Current drafts are excluded. Preparing a new scope discards the previous extract; successful mark saves invalidate the prepared teacher extract. Source reads use pages of 500 and ID batches of 100; at most 1,000 assigned learners per preparation.

Course Work → selected assessment: CSV/Excel and printable extracts use `savedMarks`, with assessment ID/title, subject, class/stream, date, term/year and possible marks. A missing saved mark remains blank/Not recorded; a saved zero stays numeric zero. Editing an input without saving never changes the download. This export follows the assessment learner list already loaded by the existing workspace; it does not expand teacher access or treat unsaved marks as recorded results.

Learner profile → Attendance: export the loaded week/month as CSV/Excel or a printable extract. Each file states exact start/end dates and includes recorded date/status/late minutes/note. It filters the requested dates again before export, never adds unmarked days as absences, and never infers a term calendar. Changing learner/range hides the previous export until that range has loaded successfully. Attendance stays under the existing learner/teacher/campus policies. These are individual attendance extracts; this stage does not add a school-wide attendance reconciliation workflow.

## Completeness, errors and printing

Batch context reads page deterministically and fail explicitly beyond 200 contexts, asking for a narrower class/stream. Report reads run four at a time, with a 30-second preparation timeout, cancellation on scope change/unmount, and retry. Any failed report rejects the whole batch; no partial file is offered. Role/campus changes remount the batch workspace and discard prepared data. Multi-request batches are not an atomic database snapshot; prepare again after concurrent edits.

CSV and Excel reuse the verified local export functions from Stage 11. Identifiers remain text, numeric scores remain numbers, formula-like text is neutralized in CSV and literal in XLSX, and no service key or external upload is used. Workbook generation is lazy-loaded. Downloads in progress are cancelled on unmount before a workbook can be offered.

Screen previews contain up to 100 rows per section. Print temporarily renders every row on A4 landscape, repeats table headings and removes the rest of the portal from print flow. The context section records historical placement; printed mark sections repeat admission/name and mark columns to avoid repeating eight context columns on every line. CSV/Excel retain every context column per mark. After printing, the title, portal layout and bounded preview are restored. The batch is a recorded-data extract, not a merged set of official report books. Official individual report cards retain their existing A4 portrait layout, captured grading rules and original print action.

## Verification and SQL

No SQL installation is required. To repeat live checks manually, run `supabase/verification/stage12_academic_export_access.sql` in Supabase SQL Editor. It is a READ ONLY transaction using existing role identities and JWT helpers; output contains counts only. It compares authorised historical context counts, exercises report bundles against visible source rows, checks teacher attendance campus isolation, confirms the report reader is SECURITY INVOKER, and verifies MFA stays paused. Live result: 8 role/campus scopes, 10 bundles matching authorised source, both boolean checks true. No school records were changed.

Automated checks:

- `node --test tests/academic-export.test.mjs tests/historical-reports.test.mjs tests/reporting-periods.test.mjs`: captured placement, raw marks/zero/missing values, components/comments, attendance range, saved coursework; existing historical promotion/result-fee gates and all marks-lock write guards.
- `node tests/academic-export.browser.mjs`: real batch CSV/XLSX/PDF at 320/390/768/1280px, 1,007 marks, 100-row previews/all-row print, scope invalidation, retry after failed report read, parent historical Junior placement, attendance workbook/PDF and unsaved coursework exclusion.
- `node tests/academic-teacher-export.browser.mjs`: assigned teacher learner/subject/year/term scope, no foreign subject/campus row, numeric zero, no business writes, parent downloads absent while fee-locked.
- `python tests/academic-export-files.verify.py`: every mark present in actual files, 61-page landscape PDFs with repeated headings, formula safety, zero marks, parent historical class/provenance, attendance date coverage and single-page attendance PDF. First batch page, continuation and attendance PDF rendered using Poppler and visually reviewed.
- Existing teacher draft/save-failure/native-history guards, finance mobile and historical-report browser checks passed. All 45 existing official report PDFs were generated and verified as nonblank, single-page A4 portrait reports without download controls. Newly added/refactored files lint clean; existing touched teacher/coursework components retain their baseline lint findings. Production build passed.

Synthetic downloads and screenshots stay under ignored `tmp/stage12-exports/`; they are not committed school records. No marks, result approvals, fees, attendance or reporting periods were changed in the live database.

School acceptance: prepare an old year/class batch, compare stored marks and original comments; download one parent's old Junior report after promotion; verify a fee-locked parent has no download buttons; as a teacher export one subject and confirm another subject is absent; type an unsaved coursework mark and confirm it is absent from the download; export attendance week/month and compare dates/statuses; print a large extract and check the final learner/mark. Use existing records for comparison rather than modifying real marks for testing.

Next: Stage 13, Zimbabwe currency/grade configuration and official-template mapping. The 63 inferred historical contexts still require school register confirmation; this stage does not certify them.
