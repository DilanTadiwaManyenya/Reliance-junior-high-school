# Staff name save recovery — 16 October 2026

The hosted manage-staff-account endpoint answered an unauthenticated POST with its expected authentication error during diagnosis. It is deployed and reachable from this machine; this does not verify an authenticated browser save or explain every browser transport failure.

The shared Edge Function helper now recognizes Supabase FunctionsFetchError (including the exact error shown in the screenshot) and uses its existing single retry. If both attempts fail, the message asks the administrator to reload the staff list and confirm whether the save succeeded before submitting again. Server validation errors remain visible and are not retried.

The staff form and Edge Functions support Mrs, but profiles_working_title_check previously allowed only Mr and Ms. Apply supabase/migrations/20261016100000_allow_mrs_staff_working_title.sql to align the database constraint. This migration does not change staff identities or allocations.

The frontend fix was pushed to master in commit 22918e8. After the user completed Supabase CLI authentication, the title migration was applied to linked project ejrtmdvnumjwikehzrrk in a transaction and recorded in migration history. A follow-up query verified the live constraint allows Mr, Ms, and Mrs and the migration is recorded. No staff identities or allocations were changed. Hosted frontend deployment and an authenticated browser save have not been verified. The unrelated pending 20261015100000 migration was left unapplied.

After rollout, use an authorized administrator account to save a verified full legal name, reload the staff list, and verify the working name, legal name, and signature initials. Check Mrs as well as Mr and Ms.
