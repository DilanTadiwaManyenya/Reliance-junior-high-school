# Stage 14 — Reliability and environments

## Implemented in this stage

- Added a portal-wide offline and connection-restored notice, including at phone width. It reports the browser/device network state and never retries or queues a write. For uncertain payments, POS sales, marks or other actions, staff must inspect the result before retrying.
- Added repository-level ignore rules for new `.env` and `.env.*` files, while allowing a safe `.env.example`. After verifying the public `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` settings in Production and Preview on both Vercel projects, removed the tracked `.env` in commit `58996ea` (`Remove tracked environment configuration`). The local `.env` file was preserved. A source scan found no service-role key/JWT-looking secret in `src/` or `public/`; server-only Edge Functions read privileged keys from Supabase's server environment.
- Existing login/profile and data workflows already expose bounded timeout/failure states and explicit retries. POS checkout and year rollover preserve their same-request idempotency behavior after an uncertain response. The new notice is explanatory only and does not change those flows.

## Environment inventory

- Git branch: `master`; commit `58996ea` is deployed and Ready on both Vercel production projects (`reliance-junior-high-school` and `reliance-junior-and-high-school-ugvj`). The public Supabase URL and anon key are configured for Production and Preview on both projects. These Vercel settings do not create a separate backend: both currently target the single Supabase project listed below, so Preview is not an isolated test database.
- Supabase account listing returned one active project, `ejrtmdvnumjwikehzrrk`, in `eu-central-1`; no Supabase preview branches exist.
- This workspace has no `supabase/config.toml`, and Docker is unavailable, so a local Supabase stack and local end-to-end database restore could not be run. Existing PGlite/fixture tests are isolated synthetic data, not a separate hosted test project.
- The source uses only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the browser. `SUPABASE_SERVICE_ROLE_KEY` references are server-side Edge Functions only. Do not put a service-role key in any `VITE_` variable.

## Backup status — not verified / action required

Live Supabase dashboard inspection on 20 October 2026 confirmed the project is Healthy and on the Free plan. The Scheduled Backups page says Free does not include project backups and offers up to 7 days of daily backups on Pro. The Point in Time Recovery page identifies PITR as a Pro add-on starting at $100/month. The project overview reports `No backups` and `No branches`; no isolated Supabase test project was available in the project selector. The earlier read-only CLI check returned `walg_enabled=true`, `pitr_enabled=false`, and an empty physical-backup list. No off-site logical backup has been verified.

No billing setting was changed, no new project was created, and no learner/staff data was exported during this check. Do not treat the existing production project or a local fixture as an isolated restore target. The owner must approve a protected backup destination and an isolated target before a real-data backup/restore drill can proceed. The current workstation also has no `supabase`, `docker`, `pg_dump`, `pg_restore` or `psql` command available for a local drill.

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

Stage 14 is partial until the owner confirms backup coverage and a protected destination, and an isolated restore target is available for a restore drill. The Vercel frontend configuration and production deployment checks are verified. Keep production credentials and real learner data out of local fixture tests.
