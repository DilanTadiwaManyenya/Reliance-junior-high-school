# Bulk learner frontend and backend verification

The Main Admin roster uses the existing `correct_assigned_learner(uuid,jsonb)` RPC to disable active learners and `manage_disabled_learner(uuid,text,text)` to delete selected disabled learners. No new migration or Edge Function is required for this stage. Existing migration files are not evidence of deployment.

## Verify the live backend before enabling use

Run `supabase/verification/bulk_learner_backend.sql` in the intended Supabase project's SQL Editor. It is read-only and returns schema metadata, function definitions and policies, not learner records.

Check both functions exist, are SECURITY DEFINER with a fixed public search path, allow authenticated execution and deny anonymous execution. Inspect the deployed definitions for signed-in authorization, campus/role checks, minimum reason length and row locking. Deletion must retain fee-payment, POS-sale, uniform-order and rollover history checks. Confirm students RLS remains enabled and the restrictive lifecycle-only DELETE policy denies direct authenticated deletion. Do not change policies merely to make a failing request succeed.

Expected source definitions are in `20261022100000_controlled_learner_corrections.sql` and the latest replacement `20261023100000_allow_campus_admin_learner_delete.sql`. Earlier versions restrict deletion to disabled learners and Main Admin; the frontend deliberately disables learners before deletion and exposes bulk actions only to Main Admin, so those restrictions remain compatible. Do not replay historical migrations without comparing the live definitions and obtaining approval for any destructive database change.

No SQL migration or Edge Function deployment has been performed or verified by this stage. If checks fail, review the exact failed check and deployed definition before preparing a targeted fix.

## Preview acceptance

Use Main Admin on the dev deployment. Confirm other roles and campus administrators cannot see bulk controls. Choose an enrolment year, Form 1 and White; check the names and admission numbers before selecting all. Enrolment year is the learner's enrolled_year, not a historical academic-year roster snapshot.

Use disposable test learners in an isolated backend for writes: confirm cancellation performs no RPC, disabling retains records, permanent deletion requires the typed learner count and a reason, protected-history records are blocked, and a lost response stops the batch without automatic retries. A Vercel Preview does not itself isolate the Supabase database. Do not use real learner records to test deletion.
