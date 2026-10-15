# Portal recovery — 15 October 2026

## Completed stages

1. Completed the recovered Senior whole-form and stream-specific class-teacher controls. Added a matching database permission function, with campus isolation and exact Junior class matching.
2. Added bounded profile loading, recoverable profile errors, retry/sign-out controls, deferred auth-event queries, and login submission recovery.
3. Aligned staff navigation, dashboard actions, finance restrictions, headers, and onboarding with the active role. Enabled the role selector for accounts with multiple roles, handled switch failures, and reset workspace state when roles change. Fixed the missing ECD-only flag that crashed Junior teacher dashboards.

## Verification

- `npm run build` passes; the existing large-bundle warning remains.
- `npm run test:portal` checks profile success/fallback/failure/timeout, rendered ECD and Grade dashboards, active-role navigation, principal read-only finance, profile recovery, and isolated PostgreSQL teacher access restrictions.
- `npm run test:shop` checks checkout, rollback, retries, stock accounting, and role policies using isolated PostgreSQL.
- Targeted lint passes for the authentication and smaller navigation components. Existing lint issues remain in FeesDashboard, StaffDashboard, and StaffPortalLayout; this stage introduces no new diagnostics and fixes four existing errors.
- Tests do not authenticate against live school accounts or change live records.

## Live rollout still required

GitHub commits are separate from Supabase deployment. The public client key is insufficient to inspect migration history, apply SQL, or deploy Edge Functions.

Using authenticated Supabase management access for project `ejrtmdvnumjwikehzrrk`:

1. Inspect linked migration history and reconcile any pending historical migrations before applying changes.
2. Apply `supabase/migrations/20261015100000_allow_whole_form_class_teachers.sql` after reviewing it. Do not replay unrelated migrations blindly.
3. Deploy `create-staff-account` and `manage-staff-account` together with the frontend assignment changes.
4. Confirm the hosted frontend deploys the new commits. Check a stream-specific Senior teacher, a whole-form Senior teacher, an ECD teacher, a Grade teacher, and a multi-role staff account. Confirm principal finance remains read-only and learners from another campus stay inaccessible.

No live SQL or Edge Function deployments were performed during this recovery.
