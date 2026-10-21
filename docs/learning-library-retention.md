# Library file retention and recovery

## Verified inventory, 20 October 2026

The read-only `supabase/verification/learning_library_retention_review.sql` returned **zero objects, file reservations, previous versions, unfinished uploads, orphaned objects and metadata/missing-object errors** in both `learning-library` and `school-newsletters`. There was nothing to delete. Disposable integration-test objects from earlier stages were removed by their own exact-path cleanup; SQL fixtures rolled back.

An empty inventory is not evidence that a school backup can be restored. No production file or audit history was deleted, no cleanup schedule was installed, and no retention duration for finalized school documents was imposed.

After the signed-in teacher pilot, the **21 October** review found one finalized learning-library attachment for the explicitly labelled archived pilot note. It remains stored with its history and was never published to parents. Both buckets have zero unfinished uploads, orphaned objects, missing finalized objects or metadata mismatches; the newsletter bucket remains empty. Archiving this exact test note used its teacher's existing authority after browser interaction became unavailable. No file was deleted.

## Current behavior

- Each upload gets a new immutable path. A replacement becomes current only after the database verifies actual Storage metadata.
- A previous finalized version remains stored with its metadata/audit history. Browser roles cannot permanently delete it.
- An interrupted attempt can leave an unfinished reservation, uploaded bytes awaiting finalization, or an object with no reservation. These are review categories, not proof that a file is safe to delete.
- Archive withdraws publication but retains the document and its audit history.
- Revoking access blocks new file links. Already downloaded copies and unexpired signed links cannot be recalled.

## Proposed operating procedure

Run the read-only report weekly and after an interrupted upload incident. The report flags pending reservations older than **7 days** for review; seven days is a candidate-review window, not automatic deletion authorization.

For any candidate, the authorized maintainer should identify its exact bucket/path, resource/newsletter, reservation state, age and latest object modification time. Check again immediately before action: the file must still be unfinished/inactive and not referenced as a ready version. Contact the uploader if there is uncertainty. Do not use an age threshold on active/finalized files, cascade-delete a resource, clear audits, or directly delete rows from `storage.objects`.

If cleanup is approved for specific abandoned objects, use the Storage API with a server-held credential and an explicit exact-path list, record the result and preserve the audit trail. Never expose that credential in the browser or commit it. A future automated cleanup job needs a reviewed transaction/race-handling design and a defined owner; this phase does not install an unreviewed delete job.

The school must choose a retention period for finalized academic files, newsletter attachments and previous versions, identify legal/academic holds, and approve a separate backup destination and restore test before purging any of them. Until then, retain finalized versions and audit history.

## Recovery checklist

1. Archive an incorrect publication if it must stop appearing to parents; keep evidence.
2. Check the current active file, the uploader's local original and the activity trail. Do not point parents to private historical paths manually.
3. Ask the currently authorized uploader/Admin to upload a corrected version through the normal editor. Finalization safely activates the new file.
4. For missing/corrupt finalized bytes, preserve metadata/events and escalate to the designated maintainer. Restore from an independently verified file backup or re-upload the known original; a database row alone does not restore Storage bytes.
5. Recheck the applicable teacher/parent/support sessions and repeat the inventory report. Never reset production data as a recovery shortcut.

Backups and a separate Supabase test/restore environment remain the broader open items documented in Stage 14. Do not run destructive restore drills against the linked live school project.
