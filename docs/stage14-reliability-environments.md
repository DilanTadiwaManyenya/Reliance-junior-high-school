# Stage 14 — Reliability and environments

## Implemented in this stage

- Added a portal-wide offline and connection-restored notice, including at phone width. It reports the browser/device network state and never retries or queues a write. For uncertain payments, POS sales, marks or other actions, staff must inspect the result before retrying.
- Added repository-level ignore rules for new `.env` and `.env.*` files, while allowing a safe `.env.example`. The existing `.env` is tracked, but contains only the public `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` settings. I left it tracked because Vercel environment variables could not be inspected and removing it without confirming those settings may disconnect the live portal. Confirm those two values exist in both Vercel projects, then remove `.env` from Git in a follow-up. A source scan found no service-role key/JWT-looking secret in `src/` or `public/`; server-only Edge Functions read privileged keys from Supabase's server environment.
- Existing login/profile and data workflows already expose bounded timeout/failure states and explicit retries. POS checkout and year rollover preserve their same-request idempotency behavior after an uncertain response. The new notice is explanatory only and does not change those flows.

## Environment inventory

- Git branch: `master`; the two configured Vercel deployment checks on recent pushes both pass. Vercel environment settings were not readable through an installed Vercel CLI, so verify preview/production environment variables in the Vercel dashboard before calling those separate test/live environments.
- Supabase account listing returned one active project, `ejrtmdvnumjwikehzrrk`, in `eu-central-1`; no Supabase preview branches exist.
- This workspace has no `supabase/config.toml`, and Docker is unavailable, so a local Supabase stack and local end-to-end database restore could not be run. Existing PGlite/fixture tests are isolated synthetic data, not a separate hosted test project.
- The source uses only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the browser. `SUPABASE_SERVICE_ROLE_KEY` references are server-side Edge Functions only. Do not put a service-role key in any `VITE_` variable.

## Backup status — not verified / action required

The live read-only CLI check returned `walg_enabled=true`, `pitr_enabled=false`, and an empty physical-backup list. Therefore there is no available physical backup to restore in a drill, and no off-site logical backup was verified. Supabase currently documents automatic daily backups for Pro/Team/Enterprise; for Free projects it recommends regular CLI exports and off-site storage. Check the project's plan in Supabase before assuming which backup coverage applies.

After the owner chooses the backup destination and authorizes handling the personal data in the export:

1. Ensure Docker Desktop/`pg_dump` is available, then take role, schema and data dumps. Replace the path with a restricted encrypted backup destination outside this repository:

   ```powershell
   supabase db dump --linked --role-only --file "<restricted-backup-dir>/roles.sql"
   supabase db dump --linked --file "<restricted-backup-dir>/schema.sql"
   supabase db dump --linked --data-only --use-copy --exclude storage.buckets_vectors --exclude storage.vector_indexes --file "<restricted-backup-dir>/data.sql"
   ```

   These dumps contain learner/staff records and must never be committed. Database dumps do not include Storage objects; export and protect product/learner files separately.
2. Record the backup time, source project, CLI version, file sizes and SHA-256 checksums in the restricted backup location.
3. Restore into a separate test project, never over production. Reconfigure Auth, Storage, Edge Functions, extensions, Realtime and secrets, since a database-only clone does not recreate all services.
4. Run the portal's RLS, authentication, reports, finance/POS and storage checks against the restored test environment. Record the result and elapsed restore time. Repeat on an agreed schedule.

The available Supabase CLI restore-to-new-project feature and preview-branch compute can incur charges; no project, branch, backup plan or billing setting was changed in this stage. Supabase's current docs explain [database backups and PITR](https://supabase.com/docs/guides/platform/backups), [restore to a new project](https://supabase.com/docs/guides/platform/clone-project), and [preview-branch usage](https://supabase.com/docs/guides/platform/manage-your-usage/branching).

## Checks

- `npm run test:connection-status` builds the production bundle and tests offline/reconnected states, no automatic retry, public-page scope, and 320px fit. A local 390px browser run throttled to 450ms latency / 200kbps down / 100kbps up rendered portal login in 9,674ms. This is a repeatable simulated-network check, not a real carrier-data measurement.
- `npm run test:portal` passed all 6 portal profile, access recovery and teacher access checks.
- Existing focused request failure, recovery, idempotency and reporting tests remain the safety net for database-backed operations.

Stage 14 is partial until the owner confirms the intended backup coverage/destination and enables an isolated restore target. Keep production credentials and real learner data out of local fixture tests.
