# Stage 5: School newsletters

The Admin workspace now has **Administration → Newsletters**. Main Admin can create Junior, Senior or both-campus newsletters; campus Admins manage their own campus. Teachers, parents and accountants have no publishing controls or database write/upload authority for newsletters. Teacher notes and finance are unchanged.

## Publishing

Create a title and text or optional PDF/Word/PowerPoint/image attachment (10 MB maximum). Choose explicit campus, grade/form and optional stream targets. Blank grade/form means campus-wide; blank stream includes all streams. Stream names must match enrollment spelling exactly. Saved campus and author are immutable. Both-campus records require Main Admin.

Save a draft, publish immediately or choose a future release, set optional expiry and pin important updates. Dates use Africa/Harare (UTC+2). The editor guards unsaved navigation. Return a published/archived newsletter to draft before retargeting it; parents cannot see drafts. Archive withdraws an update without deleting its audit trail. The Admin list is paginated, 20 records per page.

Each file gets a new private reservation and upload path. Replacement only activates after Supabase verifies actual Storage size and MIME metadata. Failed uploads leave the existing active attachment intact. Old and abandoned reservations remain for the Stage 7 retention/cleanup review; clients cannot delete finalized files. Text-only newsletters work without a file. Saving details, replacing a file and publishing are separate server requests: after an uncertain connection error, refresh/reopen to inspect what saved before retrying. New drafts retain a stable UUID to prevent duplicate creations on a retry.

## Parent feed

Parent navigation now includes **Newsletters** at `/portal/announcements?learner=…`. The verified learner selector is shared with the library. Newsletters and library links retain the selected learner. The database reader derives campus/class/stream from that learner and rejects unverified, inactive or unrelated connections. A family linked to both campuses still sees only the selected child's targets. Published, released, unexpired records are shown with pinned items first and 20 items per page.

Attachments are transferred only on an explicit preview/download action. PDF and image previews use private 60-second links; the UI offers renewal after 55 seconds without closing already loaded previews. Word/PowerPoint are downloaded for a compatible app. Changing learners unmounts the previous feed and discards late results. Errors show retry/refresh controls. “Mark as read” records the signed-in parent's acknowledgement, not proof that a child read the file. Opening/fetching an update does not automatically acknowledge it.

Existing staff announcements retain a read-only published text feed. Dedicated Admin/accountant library and attachment oversight is Stage 6. No email/SMS delivery or external notifications are introduced. The unused legacy bell is not mounted by this stage.

## Database and verification

Migration `20261021160000_newsletter_publishing.sql` is applied and recorded on linked Supabase project `ejrtmdvnumjwikehzrrk`. It adds two functions, using the existing campus/role/MFA helpers and existing tables/policies:

- `save_announcement_targets(uuid,jsonb)` locks an authorized draft and atomically replaces 1–50 audience targets. Any invalid/cross-campus target rolls back the whole replacement.
- `parent_school_updates(uuid,integer,integer)` is a parent-only, fixed-search-path SECURITY DEFINER reader. Exact verified active learner checks, explicit selected-child targets, publication/expiry checks and the existing read helper all apply. Anonymous execution is revoked; limits/offsets are bounded. File signing still passes through private Storage policies.

Verified locally and against linked Supabase:

- 39 rollback-only database check groups passed: publication, atomic target failure, audience locking, two-campus child selection, release/expiry/draft exclusions, acknowledgement ownership, revoked links, pagination bounds, anonymous execution and edit/upload denial across actual teacher/accountant/parent and cross-campus Admin identities. Trusted audit entries were confirmed. These use existing role identities with test JWT claims; they do not alter login credentials.
- A unique disposable object was uploaded through the real Storage API. Under an Admin database identity, the reserved path was allowed, metadata finalization and publication succeeded, and finalized upload access was denied. SQL records rolled back and the exact test object was removed. Physical upload transport used a server test credential held only in memory; this is not a signed-in Admin browser session test.
- 71 newsletter browser assertions passed at 320, 390, 768 and 1440px: publishing, campus/audience locking, private preview, explicit acknowledgement, failed/successful attachment replacement, draft/archive transitions, role UI exclusion, no horizontal overflow and no runtime errors. Supabase transport is mocked in browser tests.
- 72 parent-library browser assertions passed, including new routed newsletter learner switching and learner-preserving library navigation.
- 19 newsletter/library helper tests and focused source lint passed; production build passed.

Repeat checks:

```powershell
.\node_modules\.bin\supabase.cmd db query --linked --file supabase/verification/newsletters_stage5_live.sql
.\node_modules\.bin\supabase.cmd db query --linked --file supabase/verification/newsletters_stage5_access.sql
.\tests\newsletter-live-upload.ps1
node --test tests/school-newsletters.test.mjs tests/parent-learning-library.test.mjs tests/learning-library.test.mjs
node tests/school-newsletters.browser.mjs
node tests/parent-learning-library.browser.mjs
npm run build
```

For browser scripts use the existing Playwright module and Edge channel documented in Stage 4. No dependency installation is required.

Production pilot still required after deployment: sign in as a campus Admin, publish a genuine newsletter with an attachment, open it as an appropriately linked parent, test the second child's campus, acknowledge it, replace the file and archive it. Confirm expiry/scheduling against school time. A source push/build is not evidence that this signed-in live browser pilot has occurred.
