# Stage 10 — learner register exports and print

The remaining stages are mapped in remaining-delivery-stages.md. This stage completes learner-register CSV, genuine XLSX and PDF/printing; finance/operations and academic/attendance exports are separate Stages 11 and 12. Administrator MFA remains paused at the owner's request.

## Delivered workflow

Admin → Bulk learner export: choose class/all streams, class/one stream, whole campus or (Main Admin only) all campuses. Preview once, then Download CSV, Download Excel or Print / save as PDF. Active and inactive learners are included and clearly labelled. Main Admin can export both campuses; assigned campus admins export only their campus. Other roles cannot call the export RPC or open its workspace.

All outputs share one read-only database snapshot, count, scope and generation timestamp. Unlike the original unpaged select, the function returns over 1,000 rows without API response-row truncation. More than 20,000 learners produces an explicit error asking for a narrower scope; no partial file is silently offered. A changed filter clears the preview immediately. Aborted/late responses cannot restore an older selection. Preparation has a 15-second timeout and explicit retry through Preview learner list. Empty/error responses cannot be downloaded.

Screen previews show up to 200 learners for mobile performance; CSV, Excel and print contain the whole snapshot. The register retains admission number, name, date of birth, age at snapshot date in Zimbabwe time, sex, birth certificate, class, stream, campus, guardian, phone, address and status. The XLSX has Learners and Export details sheets. Admission identifiers, phone numbers, ISO dates and certificates are explicit text cells, retaining leading zeroes and plus signs. CSV quotes multiline/quoted values, includes UTF-8 BOM, and neutralizes formula-like text even after leading whitespace/control characters. XLSX always uses literal string cells rather than formulas.

The small write-excel-file 4.1.1 dependency and its fflate dependency are loaded only when Excel is requested. Workbook generation runs in the library's browser worker. No CDN, server-side personal-data upload or permanent export copy is introduced.

Use the XLSX download when opening directly in Excel to preserve column types. CSV is plain interchange text: spreadsheet applications can infer types unless columns are imported as text. The CSV keeps the raw identifier digits and adds a protective apostrophe to formula-like values; XLSX retains literal values without that prefix.

## Print corrections

Register print uses A4 landscape, 8pt body text, tailored column widths, repeated table headers and rows that do not split across pages. Before printing all snapshot rows are rendered; after printing/cancelling, the screen returns to the 200-row preview and the original browser title. Ancestor markers isolate the register from navigation without global body-hide/page rules. Existing global register print CSS was removed.

Real PDF verification also exposed an older staff report regression: the historical-report wrapper was hidden by a legacy direct-child print selector, yielding blank admin/accountant PDFs although the earlier browser test accepted zero-sized report boxes. Legacy selectors now respect the marked print ancestors/root. The report-card browser check now requires non-zero printed dimensions before saving. This is a print-only compatibility fix; curricula, marks, grade rules and release policies are unchanged.

## Exact SQL and manual checks

Apply only supabase/migrations/20261020100000_learner_register_export.sql and record version 20261020100000 in the same deployment transaction. export_learner_register(text,text,text,text) is STABLE SECURITY INVOKER, reuses existing active-admin/campus helpers and retains native students RLS. It projects only register fields. Anonymous execution is revoked. It does not change existing tables or records.

Run supabase/verification/stage10_learner_export_checks.sql: all booleans must be true. Run supabase/verification/stage10_learner_export_access.sql: READ ONLY probes compare counts against the actual scoped learner table and check unauthorized roles/campuses. Output contains aggregate checks rather than learner identities. Existing authenticated clients cannot gain export scope by changing UI filters.

Live rollout: installed on ejrtmdvnumjwikehzrrk; metadata/grants checks true; four authorized campus scopes and twelve unauthorized scopes verified, with counts matching source. Before/after counts/content fingerprints matched the 12 source tables tracked since Stage 7. Existing records, fees, payments and MFA configuration were not changed.

## Acceptance evidence and remaining limits

`npm run test:learner-export` runs actual SQL/RLS tests and browser downloads. SQL acceptance covers 1,007 learners, active/inactive rows, scoped streams, role/campus denials, optional enabled-MFA denial, unchanged records and the 20,000-row bound. Browser tests cover 320/390/667/1280px, real CSV/XLSX downloads, complete print rows, title restoration, changed-filter clearing, delayed-response isolation and retry. The Windows test browser ignores tmp/ artifacts so download-file locks cannot crash its watcher.

After the browser run, use the bundled Python runtime with tests/learner-register-files.verify.py. It opens actual files with csv/openpyxl/pypdf, checks every learner in the 1,007-row PDF, landscape size and repeated headers, plus XLSX row counts/text types/metadata and CSV quoting/formula handling. First/last PDF pages are rendered with Poppler and visually inspected. Generated synthetic files and screenshots stay in ignored tmp/stage10-exports/.

Existing academic report PDFs are generated by tests/report-print.browser.mjs and verified with tests/report-print.verify.py across parent/admin/accountant and all 15 school levels. Signed-in hosted exports, actual mobile download/print dialogs and the school's physical printers still require school acceptance. No claim is made that all finance, ministry or exam-board exports are delivered by Stage 10.

Final automated evidence: six export/security tests passed; four browser widths passed file downloads, print restoration and stale-response handling; Python verified the real 1,007-row CSV/XLSX and every admission identifier across its 64-page landscape PDF. First/last register pages and a staff report were rendered with Poppler and visually inspected. All 45 existing academic PDFs passed one-page portrait/content/footer checks after the wrapper fix. New/refactored modules pass lint and the production build passed. npm audit still reports two pre-existing development dependency advisories (brace-expansion and source-map-js); neither is introduced by the new workbook dependency chain.

Recovery is a coordinated frontend revert and revocation of authenticated EXECUTE on the new export RPC if required. No source-data rollback is necessary. Do not remove unrelated academic history or period-lock migrations.
