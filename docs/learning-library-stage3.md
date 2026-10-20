# Learning library: Stage 3 teacher interface

Implemented on 20 October 2026 against the existing Stage 2 foundation. No database schema, finance, payment or order changes in this stage.

## Teacher workflow

- Senior: open Subject allocations, choose a subject/form allocation, then **Open learning library**. The sidebar also exposes Learning library in the subject workspace.
- Junior, including ECD: open **Learning library** from an assigned class card or the sidebar, then choose one of that class's server-approved curriculum subjects. The existing class selector remains available.
- Enter a title, optional description, academic year and term. The current open reporting period supplies defaults when available; no month-based term guessing.
- Choose PDF, Word, PowerPoint, JPG, PNG or WebP, up to 10 MB. The form displays file name and size before saving, and reports invalid type/size errors.
- **Save draft** keeps notes private. **Publish notes** first saves the draft, reserves a new private path, uploads without overwriting, finalizes through the database, and publishes only after success.
- **Edit notes** changes title/description or replaces the attachment. Author, class, stream, subject, year and term remain fixed on saved resources. Replacement failures preserve the existing active file and retain the selected replacement for retry.
- **Archive notes** removes them from parent-visible database results. **Restore to draft** permits review before republishing. There is no permanent delete action.
- Saved notes use status filters and 20-item pagination. File contents do not load automatically. **Prepare download** obtains a private link valid for 60 seconds; the UI removes it after 55 seconds so users can request another.

## Reliability and navigation

The browser assigns a stable resource UUID before saving. A manual retry checks that ID before inserting, preventing duplicate notes if the first creation succeeded but its response was lost. File versions always use new reservation paths. Failed operations report saved-detail status rather than claiming the entire workflow succeeded. A successful upload is retained for publication retry without uploading the same file again.

List/curriculum/period requests are bounded and show retry or manual period-entry states. Mutating requests have a 45-second wait limit; a timed-out network request may still finish server-side, so the message explicitly tells the teacher to check saved notes before retrying. No automatic mutation retries are added.

Unsaved text, selected files and pending saves use the existing navigation/history guard, with library-specific wording. This covers the sidebar, class/subject controls, Back/Forward and page unload. Existing coursework callers retain their original warning text and behavior.

## Verification completed

- Eight helper tests passed: file limits/MIME, reserve-upload-finalize order, failed upload, finalization errors, stable-ID retry, scope immutability, private download links and archive-only state changes.
- Nine existing portal tests passed for profile loading, redirects, role rendering and teacher scope; ECD/sidebar rendering assertions also check the new library entry points.
- 105 browser assertions passed across Junior/Senior at 320, 390, 768 and 1440px, plus ECD subject selection and cancelled draft navigation. Coverage includes publication, failed replacement, retry without duplicate note creation, publication retry without duplicate upload, archive/restore, download-link lifetime, invalid files and recoverable list errors. The browser transport is mocked; these are not signed-in production acceptance tests.
- Existing Junior/Senior coursework draft and native Back/Forward protection browser tests passed after the shared guard change.
- A real disposable PDF payload uploaded to private Supabase Storage. A rollback-only SQL transaction impersonated an actual allocated teacher's database role, reserved its metadata, finalized it against the real object metadata and published it successfully. Explicit boolean assertions passed. SQL resource/audit fixtures rolled back, and the exact disposable object was removed through the Storage API. The byte transfer used a server test credential; a teacher's browser-authenticated Storage request was not tested end to end.
- Focused lint passes for the new library modules and the changed sidebar/draft hook. `StaffPortalLayout.jsx` retains its two pre-existing React Fast Refresh context-export lint errors, confirmed against the previous committed source. No unrelated layout refactor was introduced.
- Final production build passed. Mobile screenshots were inspected locally under `tests/artifacts/library-stage3-*-mobile.png`.

## Repeat tests

```powershell
node --test tests/learning-library.test.mjs
node --test tests/portal-profile.test.mjs tests/portal-redirect.test.mjs tests/portal-render.test.mjs tests/teacher-access.test.mjs
node tests/learning-library.browser.mjs
node tests/teacher-draft.browser.mjs
node tests/teacher-history-draft.browser.mjs
npm run build
```

Browser tests accept `PLAYWRIGHT_MODULE` for an existing Playwright package and `PLAYWRIGHT_CHANNEL` for an installed browser. Verification here used the bundled runtime package with the installed `msedge` channel; no packages or browsers were installed.

The optional `tests/learning-library-live-upload.ps1` requires the existing Supabase CLI login and linked project. It obtains the server credential in memory, never prints it, creates only a unique disposable test object, runs SQL from a temporary file with explicit assertion checks, and removes its test artifacts. It never changes user credentials. Run it deliberately, not as a default production health check.

## Remaining stages

Stage 4 adds the parent's learner-specific library page and navigation. Publishing teacher notes is implemented now, but the parent library screen has not yet been added. Admin newsletter upload UI and Admin/accountant support views remain in Stages 5 and 6. Parent delivery and a fully signed-in teacher/parent acceptance flow must be verified as those interfaces land.
