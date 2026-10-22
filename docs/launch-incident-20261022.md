# Launch incident follow-up — 22 October 2026

## Confirmed state before repair

- Production and GitHub were on the prior application build; the production bundle targets the expected Supabase project.
- The expense UI had been committed in `4472108`, but migration `20261021234500` was absent from live migration history. This stage remains outstanding. Do not describe the launch as fully verified.
- Eight Junior teacher profiles have teacher roles, matching phone-derived Auth emails, enabled access, and separate assigned classes. Grade 1 and Grade 6 are separately allocated. No teacher phone duplicates were found. This does not verify passwords or a real phone sign-in.
- Mr Mabvuramiti has Lower Six / Upper Six / Upper 6 Commercials allocations. Rollback inserts using his role and the original form payload succeeded in all three labels. The reported original failure is not yet reproduced.
- Live report RPC reads passed for five admin/accountant accounts. The all-context Main Admin query reported no errors. This is not a signed-in browser result.
- Library draft/file reservation checks passed for 67 subject allocations. Existing live attachments are finalized. This does not establish a new physical upload from the affected device.

## Learner repair

- Saving disables repeat submission, supplies the teacher campus, and reuses a client admission ID when retrying the unchanged form in the same mounted session.
- Successful save clears the form, selects the saved class, searches for the saved name, and focuses the roster.
- Similar names within four edits produce an explicit warning. Name order, case and accents are normalized. Matching covers the loaded, authorized roster; it is advisory, never automatic merging.
- A confirmed replacement updates name and date of birth only. Admission number, class, fees and academic records remain attached to the same learner.
- Assigned class teachers can disable with a reason. The database checks teacher ownership and records before/after values in school_record_changes.
- A restrictive database policy limits permanent deletion to Main Admin and inactive records. Existing linked-history protections can still block deletion; no report or financial history is automatically purged.
- Migration `20261022100000` was applied and verified with rollback-only Junior/Senior records, then recorded in migration history. Tests confirmed parent rejection, teacher deletion rejection, and attributed disable audit entries.

## Account, report and upload repair

- Workspace remounts by user ID as well as role. Class selections persist under account/role/campus keys; null class streams no longer become the literal string `null`.
- Staff report reading is separated from report editing. Accountant unpaid-fee report tests pass for Junior and Senior; parents remain locked. Accountants cannot edit official report comments.
- Staff report errors show the actual request error/code or missing-context guidance rather than telling Main Admin to contact the school.
- Generic `application/octet-stream` browser file labels are accepted for supported filename extensions and uploaded with the canonical MIME type. Explicit conflicting MIME types remain rejected.

## Remaining evidence needed

The original teacher login failures and Main Admin report failure have not been reproduced in an authenticated production browser. Browser-control startup failed with a local sandbox helper error during this session. No real credentials were changed to simulate a pilot. Do not call those incidents resolved solely from mocked browser or rollback SQL checks.

## Release verification

- Learner/account repair pushed as `ca88cc5`; report/upload repair pushed as `320a129`. Production public JavaScript was checked and contains the duplicate warning and correction RPC.
- Admission browser checks passed in Grade 1, Grade 6, Form 1, Lower Six, Upper Six and Upper 6 at 390/1280px (12 cases).
- ECD A/B switching passed at 320/390/1280px. Portal account navigation tests passed; six unpaid-fee report cases passed across Junior/Senior and admin/accountant/parent.
- Thirteen file/profile/name-matching unit checks passed. Production build passed. The large existing StaffDashboard file still reports pre-existing lint errors for unused imports/functions and a synchronous state update in an effect; this is not a clean whole-repository lint claim.
- The expense mismatch noted above was subsequently repaired: exact migration applied, installed rollback verification returned all six flags true, and eight browser cases passed. No real expense or learner was created, reversed, disabled or deleted by these tests.
