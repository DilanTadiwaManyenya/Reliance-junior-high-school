# Learning library and newsletters: Stage 2

Applied to linked Supabase project `ejrtmdvnumjwikehzrrk` on 20 October 2026. This is the database/storage foundation, not the teacher or parent upload interface.

## Live foundation

- Seven new RLS-protected tables: `library_curriculum_subjects`, `learning_resources`, `announcements`, `announcement_targets`, `announcement_reads`, `portal_content_files`, `portal_content_events`.
- Two private buckets: `learning-library` and `school-newsletters`, each limited to 10,485,760 bytes. Allowed MIME types cover PDF, DOC/DOCX, PPT/PPTX, JPEG/PNG/WebP. Product image storage is unchanged.
- Reuses the existing active-role, campus, accountant and teacher-allocation helpers. Adds restrictive MFA policies without changing the current MFA rollout setting.
- Junior curriculum contains 69 class/subject pairs, derived from the current `CurriculumData.js` grade-specific report subjects and ECD curriculum. Browser users can read the permitted curriculum but cannot edit it.
- Teachers manage notes only within a current allocation. Admins, principals (through the existing read helper) and accountants have campus-scoped read access, not note management. Main Admin can trace both campuses.
- Only Admins manage newsletters. A campus Admin cannot create an `all`-campus newsletter or target another campus. Main Admin uses explicit Junior and Senior target rows for a shared newsletter.
- Parents can read published resources for active learners with verified links, matching campus/form/grade and stream. Unverified links, expired newsletters and drafts are excluded. No individual elective enrollment is inferred.
- Resource author/scope snapshots cannot be edited, and do not cascade away when staff/allocations are deleted. Current scope authorization is rechecked for every write. Resources are archived rather than deleted by browser users.
- Database triggers record trusted before/after changes. Browser roles cannot insert, edit or delete audit events.

## File API contract for Stage 3 onward

The Stage 1 design's separate attachment tables are implemented as one `portal_content_files` table with an exclusive resource/newsletter parent. This avoids duplicating authorization and replacement logic.

1. Create the parent resource or newsletter as a draft. For resources, pass the selected allocation scope, academic year and term; use current reporting-period defaults in the upcoming UI.
2. Insert a file reservation with exactly one of `resource_id`/`announcement_id`, plus `extension`, `original_name`, `mime_type` and `size_bytes`. Do not set `ready` or `active`. Return its generated `bucket_id`, `object_path` and `id`.
3. Upload the bytes to that exact bucket/path with `upsert: false` and the declared MIME type. Storage policies permit upload only to a reserved path the uploader is currently authorized to manage. File extension and declared MIME must match the table allowlist.
4. Call `finalize_portal_content_file({ p_file_id })`. It checks the stored object size/MIME, locks the parent to serialize replacements, and atomically activates the new file while retiring the old metadata version. A missing or mismatched object leaves the old file active.
5. Publish the resource after finalization. Publishing notes without an active finalized file fails. For newsletters, add explicit audience targets before publishing. Return a newsletter to draft before changing its audience.
6. Read file metadata through RLS and request a short-lived signed URL (target 60 seconds) through Storage. Do not save signed URLs or replace them with public links. Previously issued links can last until expiry after access is revoked.

Finalized objects have no browser UPDATE/upsert/DELETE policy. Only pending uploads can be removed by their authorized uploader. Replacement retains old file metadata and objects. Before enabling cleanup, add a trusted Storage-API cleanup process for abandoned reservations older than 24 hours; finalized-version retention needs a school retention decision. No direct SQL deletion of storage object metadata and no cleanup scheduler were introduced in this stage.

## Repeatable verification

Run the migration once, then these scripts in SQL Editor or via CLI:

```powershell
.\node_modules\.bin\supabase.cmd db query --linked --file supabase/verification/learning_library_stage2_checks.sql
.\node_modules\.bin\supabase.cmd db query --linked --file supabase/verification/learning_library_stage2_access.sql
```

Live results: structural checks passed; 69 Junior curriculum pairs; both buckets private and 10 MB; all seven tables have RLS and restrictive MFA guards; no anonymous resource SELECT, client file activation/update/delete or audit INSERT grants.

The final access run passed **171 assertions** under real existing active-role identities. It covered teacher creation and edits, invalid Junior subjects, oversize reservations, forged ready flags, missing-upload publication/finalization, preservation of an active file after failed replacement, read-only support roles, cross-campus drafts, verified/unverified parent links, wrong forms/campuses/streams, allocation deletion, campus Admin audience restrictions, Main Admin multi-campus publication, newsletter expiry, anonymous reads and audit forgery. All temporary resources, audit events and changes to existing learner/link/allocation rows were rolled back; structural checks confirmed no probe records remained.

These are database role tests, not browser or physical file-transfer acceptance tests. Actual upload, MIME response headers, signed-link expiry and mobile retry behavior will be verified with the upload UI. No principal account is currently available for an end-to-end principal identity test; principal read behavior follows the existing campus helper and was not claimed as tested with a live principal identity.

## Separate issue discovered, not changed

An initial rolled-back test attempted a fresh learner insert. Existing `seed_fee_account_for_new_learner()` failed because its `ON CONFLICT (student_id, term, academic_year)` no longer matches a unique constraint. The admission rolled back and no learner was created. Subsequent library tests reused existing learners inside a rollback-only transaction. Record this as a separate admissions/finance follow-up; this stage does not change fees, payments or orders.

## Next stage

Stage 3 adds the teacher upload/edit/archive interface inside Senior subject allocations and Junior class allocations, using the reservation/upload/finalize flow above. Parent library, Admin newsletter publishing and support dashboards follow their planned stages.
