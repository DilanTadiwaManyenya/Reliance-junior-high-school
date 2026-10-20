# Learning library: Stage 4 parent access

Implemented on 20 October 2026. The parent reader migration was applied and recorded on linked project `ejrtmdvnumjwikehzrrk`. This stage adds no finance, payment, order or newsletter publishing changes.

## Parent workflow

Parents can open **Learning library** from their dashboard card or the shared parent navigation. Both links carry the current learner into `/portal/library?learner=…`. The library also links back to that learner's dashboard.

The learner selector loads only verified parent connections. An explicitly unlinked learner URL displays an unavailable message rather than silently falling back to another child. Inactive learners retain dashboard historical-record access, but the current-class library is unavailable.

Within the selected learner's library, parents can filter by subject, year and term, with 20 resources per page. Cards show the teacher's display name, subject, period, publication date in Africa/Harare, file name and size. Year filters select materials for the learner's current class; they do not infer historical enrollment or individual elective choices.

Files and signed URLs are not fetched automatically. Parents request PDF/image previews or prepare downloads explicitly. Office files offer downloads rather than an unsupported embedded preview. Links expire after 60 seconds; the UI stops offering the old link after 55 seconds and permits renewal. Already loaded previews remain on screen after link expiry, so reading is not interrupted by a timer. A loaded/downloaded copy cannot be revoked by later expiring its link.

Changing learners unmounts the old resource view and cancels pending list/file requests. Filter changes invalidate the displayed result immediately. Late responses cannot populate another child's view. Link/list failures show retry actions, not a false empty feed; parent-link failures close the library until the connections can be loaded again.

## Database access contract

`parent_learning_library(p_student_id, p_subject, p_year, p_term, p_offset, p_limit)` is a stable SECURITY DEFINER reader with a fixed search path. It explicitly checks the existing active parent role, a verified link to that exact student, active learner status and a concrete campus. It does not accept client-provided campus/class scopes.

The result includes only published, currently released resources matching the selected learner's campus, class level and stream, with active finalized attachments. It also calls the existing resource-read helper as defense in depth. Filters are typed parameters; limits are 1–50 and offsets 0–10,000. Options and totals come from that same selected-class scope. No profile/table SELECT grants were added for parents. The sole joined staff field returned is the teacher's display name, with a fallback if the staff profile was removed; phone, email and internal teacher ID are excluded.

The function is callable by authenticated clients but rejects non-parent roles and unlinked parents. Anonymous execution is revoked. Actual file signing still passes through the existing private Storage policies; the RPC does not sign files or bypass Storage access checks. Archived resources disappear from both the feed and parent resource-read authorization.

## Verification

- **48 live database assertions passed**, using existing role identities and rollback-only resource/link fixtures. Coverage includes selecting two children across campuses, wrong streams, drafts/future releases, subject/year/term filters, page bounds, archive removal, revoked links, unrelated parents, staff roles, anonymous execution and staff-contact exclusion.
- **68 routed browser assertions passed** at 320, 390, 768 and 1440px. Coverage includes learner/branding changes, filters/pagination, no automatic file transfer, previews/downloads, expiry without closing loaded previews, renewal, network retries, Office download-only behavior, inactive/unlinked learners, dashboard return paths, late list/file response isolation and mobile geometry. Browser Supabase transport is mocked.
- Parent/teacher helper tests pass, including new selected-learner response checks, cancellation and school-timezone formatting. Existing parent learner-context, dashboard/report/shop return-path browser tests pass.
- Focused lint and the production build pass. The mobile screenshot at `tests/artifacts/parent-library-stage4-mobile.png` was inspected locally; generated screenshots are not part of the source commit.

Repeat the database test with:

```powershell
.\node_modules\.bin\supabase.cmd db query --linked --file supabase/verification/learning_library_stage4_access.sql
```

Repeat local tests with:

```powershell
node --test tests/parent-learning-library.test.mjs tests/learning-library.test.mjs
node tests/parent-learning-library.browser.mjs
node tests/parent-learner-context.browser.mjs
npm run build
```

Browser tests accept `PLAYWRIGHT_MODULE` and `PLAYWRIGHT_CHANNEL`. Verification used the existing bundled Playwright package and installed Edge browser; no dependency installation was required.

Stage 3 separately verified physical Storage upload and teacher-role finalization. Stage 4's database tests verify actual parent read authority, and its browser tests verify the UI with mocked signing. A fully signed-in production parent download on a real device has not been performed by the agent and remains a pilot acceptance check.

## Next stages

Stage 5 adds Admin newsletter publishing and the targeted newsletter feed. Stage 6 adds campus-scoped Admin/accountant library oversight. Stage 7 covers the remaining live pilot, cleanup/retention and handover work.
