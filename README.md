# Reliance Learning Centre

Reliance is the school portal for learner administration, academics and reporting, attendance, fees, staff access, uniforms, inventory and point of sale.

## Start here
- [Stage 15 handover and go-live guide](docs/stage15-handover-go-live.md)
- [Remaining delivery stages](docs/remaining-delivery-stages.md)
- [Stage 14 reliability and environments](docs/stage14-reliability-environments.md)
- [Campus isolation](docs/security-stage1-campus-isolation.md)
- [Inventory and POS](docs/inventory-pos.md)
- [Learning library and newsletter role guides](docs/learning-library-user-guide.md)
- [Library release and school pilot checklist](docs/learning-library-stage7.md)

Stage documents record SQL rollout, checks, tests, limits and recovery. An implemented stage does not mean school acceptance is complete.

## Local development
Use a supported Node.js version. From the repository root, run npm install, copy .env.example to .env and set the public Supabase URL and anon key provided by the project owner, then run npm run dev. Run npm run build for a production bundle.

Only browser-safe VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY belong in frontend configuration. Never put a service-role key or other privileged secret in a VITE_ variable or browser code. Do not commit live data, exports, credentials or database dumps.

Focused checks are listed in package.json, including npm run test:portal and npm run test:shop:campus. Fixture tests do not prove hosted sign-in, production policies or school acceptance.

## Data and deployment
Use named accounts and least-privilege campus assignments. Frontend pushes to master trigger connected Vercel builds. Supabase migrations and Edge Function deployments are separate: verify the linked project, review the exact migration/function, then run its verification checks. Never replay historical or reset migrations or push an unreviewed batch.

Backups, a separate restore/test target and official Zimbabwe report templates remain open as described in Stage 14 and Stage 15. Finance supports USD and ZWG per record without conversion; school accounting acceptance and approved currency-specific fee bands remain separate.
