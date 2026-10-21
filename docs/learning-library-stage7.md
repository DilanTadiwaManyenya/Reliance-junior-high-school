# Stage 7: Release checks and handover

This checklist distinguishes automated delivery from signed-in school acceptance. No payment, fee, order or learner data changes are part of this stage.

## Release evidence

On 20 October 2026 both Vercel production projects showed commit `4210655` Ready:

- `reliance-junior-high-school`: [deployment](https://vercel.com/dilantadiwamanyenyas-projects/reliance-junior-high-school/UZEbJdu5bnh6QmN5AUSpmQZP2Wf1), completed 22:09:55 Africa/Harare.
- `reliance-junior-and-high-school-ugvj`: [deployment](https://vercel.com/dilantadiwamanyenyas-projects/reliance-junior-and-high-school-ugvj/F1pfqQFvPPXJYbyN81p3MntHKNvc), completed 22:10:04 Africa/Harare.

These are observed Stage 6 deployment revisions. The follow-up fix `42caad5` was also observed Ready on both projects: main project deployment `HNxSRo2ranGsYYEBygcEepUxzmbm` at 22:37:31, second project `AXjQXmggEdmDx9LiZhd2UeFuEjLD` at 22:37:24, Africa/Harare on 20 October. Check both projects again after the final handover push. The user completed the required first-login password change directly in the browser. No password is recorded here or in test artifacts.

The initial Storage inventory was empty in both private content buckets. After the production teacher pilot, the 21 October recheck found one finalized `learning-library` attachment belonging to the archived test note, zero unfinished/orphaned files and zero missing-object/metadata errors. The newsletter bucket remains empty. No school files were removed. This is not independent backup/restore evidence.

The unused legacy announcement bell has been replaced with a parent navigation link to the same selected-learner newsletter feed. It no longer performs an unsupported read-receipt upsert, displays notice text in an alert or acknowledges a notice just for opening it. There is no inaccurate unread-count badge or extra automatic file fetch.

## Repeatable automated release pack

```powershell
# Local helper/role tests, all four feature browser suites and build:
.\scripts\verify-learning-library.ps1

# Also run linked-project read-only/rollback-only SQL checks sequentially:
.\scripts\verify-learning-library.ps1 -LiveDatabase

# Optional: unique disposable real-Storage probes, with exact-path cleanup:
.\scripts\verify-learning-library.ps1 -LiveDatabase -PhysicalStorage
```

The script stops on failure, rejects empty SQL result sets/failed boolean checks, checks finalized-file integrity, verifies the exact linked project before live queries, and writes a local report under `tests/artifacts/learning-library-release-checks.json`. It performs no installs, schema deployment, password changes or cleanup of school content. Browser tests use mocked transport; SQL checks use real role identities/JWT claims with rollback-only fixtures. The optional physical probes use a server test credential held in memory; they are not a substitute for a signed-in browser upload.

## Production school pilot — record each result

Use designated test accounts and a school-approved test class/audience. Do not publish test messages to a real parent cohort without that audience being agreed. Do not create fees/payments/orders or new learner records for this pilot. Record tester, time, role/campus, content identifier and outcome without credentials or learner-identifying exports.

| Check | Acceptance requirement | Current status |
|---|---|---|
| First-login account | User sets the required new password and enters assigned teacher workspace | Complete: user changed password; assigned teacher workspace opened |
| Senior teacher | Choose allocated subject/form, upload a small benign file, save draft, preview, publish to agreed test audience | Real draft and 212 KB public-crest upload passed after fixing creation; private link appeared; byte download unconfirmed; test note archived; no parent publication performed |
| Junior/ECD teacher | Choose assigned class and supported subject; repeat upload/publication | Pending signed-in pilot |
| Parent | Verified active test learner sees matching published notes and can preview/download; draft and other-campus/class/stream notes absent | Pending signed-in pilot |
| Multi-child parent | Switch learner; school branding, library and newsletters retain the selected learner without stale files/results | Pending signed-in pilot |
| File replacement | New file becomes current after success; failed attempt leaves old file; expired link can be renewed | Automated/Storage probes documented; signed-in pilot pending |
| Newsletters | Campus Admin publishes to agreed test audience; release/expiry/archive and explicit acknowledgement work | Pending signed-in pilot |
| Support | Own-campus accountant/Admin reads note/file/activity without edit controls; Main Admin reads both sides | Live SQL and browser fixtures passed; signed-in pilot pending |
| Allocation/promotion | Lost allocation removes editing; changed learner class/stream/campus no longer authorizes previous-scope notes | Rollback-only role tests; no real promotion is performed for a pilot |
| Cleanup | Review orphan/pending/old-version inventory without deleting school content | Complete: only the preserved archived-pilot attachment remains; no orphan/integrity errors or deletion |
| Retention/backup | School appoints owner, approves finalized-file retention and verifies independent file restore | Pending school decision/restore evidence |

Use [daily role guides](learning-library-user-guide.md) and [retention/recovery procedure](learning-library-retention.md) for handover. General school go-live requirements remain in [Stage 15](stage15-handover-go-live.md); this feature release does not close unrelated backup, test-environment, accounting or report-template acceptance items.

If the browser pilot is interrupted, preserve the draft and its exact identifier, archive any agreed test publication through its owner, and record what was actually verified. Do not label the whole pilot complete from mocked tests, empty inventories or a Ready deployment alone.

The release pack passed **25 helper/role tests, 331 feature browser assertions**, the production build, **171 foundation role assertions, 48 parent-reader assertions, 39 newsletter groups, 40 support groups**, live structural/retention checks and the new real request-boundary regression across **67 allocations (22 sixth form)**. Additional teacher regressions passed 24 coursework viewport/scenario combinations, 12 surrounding teacher views, the ECD route, and Senior/Junior invalid-mark, failed-save, retry, discard and native Back/Forward protections. Generated reports/screenshots in `tests/artifacts` are deliberately excluded from this source commit.

The signed-in teacher browser showed the private download link, but the automated byte-download attempt timed out after the link expired. Subsequent browser interaction also timed out, so archive completion was verified through linked Supabase instead: only the exact uniquely identified unpublished pilot note was archived, under its existing teacher-role authorization. The attachment was preserved and the note was confirmed never published. This does not count as a successful UI archive/download test. Browser automation limits are recorded separately from portal defects.

See [teacher live audit](teacher-portal-live-audit.md) for the confirmed defects, fixes, inspected teacher flows and the separate open admissions/fee-seeding defect. Stage 7 automated delivery and guides are ready; full signed-in school acceptance and approved finalized-file retention remain open.
