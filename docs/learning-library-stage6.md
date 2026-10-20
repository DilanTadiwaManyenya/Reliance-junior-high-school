# Stage 6: Campus library oversight and parent support

Implemented 20 October 2026. Migration `20261021170000_library_support_oversight.sql` is applied and recorded on linked project `ejrtmdvnumjwikehzrrk`.

## Using the support view

- Admin: **Administration → Library oversight**.
- Accountant: **Workspace → Library oversight**, including the mobile workspace menu.
- Main Admin can select both campuses or one campus. Campus Admins and accountants stay on their assigned campus. Unassigned accountants, teachers and parents cannot enter this support view.

Filter teacher notes/newsletters by campus, publication status, grade/form (notes), title, teacher or subject. Lists and activity trails have 20 entries per page. Each note displays its teacher, campus, class, stream scope, subject, year/term, release status and current finalized attachment. Draft, archived, scheduled, expired and missing-file conditions are distinguished from parent-visible publication. Staff-only newsletters are identified as hidden from parents.

Use **Preview** for PDFs/images or **Download** for Office documents and other supported files. Nothing automatically fetches an attachment or signs its URL. Links remain private and expire after 60 seconds; the renewal prompt appears after 55 seconds without closing an already loaded preview. Changing campus/filters clears details and discards late list/file responses. Errors offer refresh/retry actions.

**Activity for …** shows who acted, their recorded role, school time, the affected area and before/after title, status, scope or file metadata. It reads trusted database-trigger events, not browser-written activity. It does not expose full historical document bodies or staff contact details. Both-campus newsletter audit details remain Main Admin-only; campus support can still open an eligible published attachment. Actor names are current display names; actor roles/timestamps are recorded with the original event.

For a parent access problem, check the note's campus, grade/form, stream, release status and active attachment. Then check the learner's current enrollment and verified parent connection using the existing learner workflow. The support view does not impersonate the parent or claim that publication proves a particular parent's entitlement. Parents still access their own selected learner through the Stage 4/5 verified-link readers.

This screen is read-only. It does not grant Admins/accountants teacher upload/edit/delete rights, let accountants publish newsletters, or alter notes, parent links, acknowledgements, payments, orders or fees. Admin newsletter editing remains in the separate Stage 5 editor. Accountants can review all authorized teacher-note states, but newsletters follow the existing published/released/unexpired read rules.

## Database contract

`school_library_oversight(campus,kind,state,level,search,offset,limit)` requires the existing active Admin/accountant role, campus authority and MFA helpers. Main Admin alone can request `all`. Every record also passes its existing content-read helper. The SECURITY DEFINER function has a fixed search path, typed/bounded arguments and anonymous execution revoked. It exposes only the author display name and current ready attachment metadata; no staff phone/email grants are added.

`school_content_trace(kind,id,offset,limit)` verifies that the content is readable to the active support role, then separately enforces the existing campus audit boundary. It returns a whitelist of historical fields instead of raw audit snapshots. Shared newsletter audit data is available only to Main Admin. Both functions are read-only; existing RLS, private Storage rules and trusted event triggers remain unchanged.

## Verification

- **40 live database check groups passed** with rollback-only fixtures and actual role identities. Coverage includes Main Admin both-campus reads, own-campus Admin/accountant reads, cross-campus list/trace/file denial, teacher/parent and disabled/unassigned-account denial, read-only teacher notes, denied support uploads, shared newsletter audit restrictions, accountant newsletter draft exclusion, search/state/grade/page bounds and anonymous denial. Tests use database JWT claims, not production browser credentials.
- All six live structural checks returned true: both functions, anonymous restrictions, recorded migration and denied client audit writes.
- **83 browser assertions passed** at 320, 390, 768 and 1440px. Coverage includes list/grade/status/search pagination, role UI exclusion, accountant workspace entry, private note/newsletter files, Office download-only behavior, link expiry/renewal, audit pagination/retry, connection errors, late list/file isolation, mobile control size and no horizontal overflow. Browser Supabase transport is mocked.
- **15 support/newsletter/parent-library helper tests** and **2 portal/teacher role regression tests** passed. The role rendering regression explicitly renders Admin/accountant oversight through the real StaffDashboard, including the accountant path before the Finance fallback.
- Focused source/test lint and the production build passed. The generated 390px screenshot was visually inspected; screenshots/build artifacts are not committed.

Repeat:

```powershell
.\node_modules\.bin\supabase.cmd db query --linked --file supabase/verification/library_support_stage6_live.sql
.\node_modules\.bin\supabase.cmd db query --linked --file supabase/verification/library_support_stage6_access.sql
node --test tests/library-support.test.mjs tests/school-newsletters.test.mjs tests/parent-learning-library.test.mjs
node --test tests/portal-render.test.mjs tests/teacher-access.test.mjs
node tests/library-support.browser.mjs
npm run build
```

Browser scripts use the existing bundled Playwright module and installed Edge channel described in Stage 4. Tests do not install dependencies or change live credentials. SQL fixtures and their audit entries roll back.

## Remaining Stage 7

Run the signed-in production teacher → parent → campus support pilot, verify deployment and private file access in real sessions, review abandoned uploads and historical file retention before any deletion, and finish role guides/go-live handover. This stage's source push, mocked browser tests and live database checks do not establish that the production session pilot has occurred.
