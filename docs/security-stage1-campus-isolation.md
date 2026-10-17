# Stage 1: database security and campus isolation

17 October 2026. Scope: the confirmed legacy RLS bypasses and related database privilege hazards. This stage does not implement MFA or certify every authentication path.

## Delivered

- Removed five permissive legacy policies: the all-campus accountant academic read, three staff/admin fee-balance rules, and the all-campus admin/principal learner read. Existing campus-aware and verified-parent/learner policies remain.
- Accountant campus access uses the existing active-role membership helper, requires an explicit Junior/Senior campus, and denies missing/all-campus assignments. Existing staff-account campus precedence is retained. No memberships were reassigned.
- Restored the existing campus-aware teacher ownership helper, including Senior whole-form access; teacher enrolment must also match the submitted learner campus to its class level.
- Set explicit search paths on the two admission-verification functions without changing their lookup results or public registration availability.
- Revoked client TRUNCATE on existing public tables and future tables created by postgres. TRUNCATE bypasses RLS; normal application CRUD/RPC grants remain.

## Apply and verify

Exact SQL: `supabase/migrations/20261017100000_close_legacy_campus_access.sql`. It is transactional and rerunnable. Apply only this reviewed migration; do not replay historical data-reset migrations or run an indiscriminate db push.

The linked project is `ejrtmdvnumjwikehzrrk`. This migration was applied there transactionally with its schema_migrations history entry. A local pre-change policy/function/grant snapshot is retained in ignored tmp/security-stage1-before.local.json. No learner, payment, stock, fee amount or account membership rows were modified.

Run the read-only `supabase/verification/security_stage1_checks.sql` in SQL Editor. Expected: migration_applied=true, remaining_legacy_policies=0, client_truncate_grants=0, definers_without_settings=0. The function definitions are returned for inspection.

With the CLI authenticated, run `powershell -File scripts/verify-security-stage1.ps1` from the repository root. It impersonates existing account scopes inside READ ONLY transactions and rolls back. It emits aggregate counts and campus names, not personal identities. These are database RLS probes, not a hosted browser login/session test.

## Validation

`npm run test:security-campus` reproduces the old leaks before applying the migration in isolated PostgreSQL, applies the migration twice, then tests Main Admin, Junior/Senior admins and accountants, a teacher, a linked parent, a read-only principal, unassigned/all-campus accountants, inactive accountant role, cross-campus writes/enrolment, preserved whole-form teacher access, anonymous/client TRUNCATE denial and future-table privilege defaults. It uses the project's actual role/campus helpers. It passed.

All six existing shop/campus database regression tests passed. Targeted ESLint passed. No frontend code changed; a new frontend build is not required to validate SQL authorization.

Live configuration verification passed. Ten live role/campus samples passed: Junior/Senior accountants and admins saw only their campus; Main Admin saw both; the unassigned admin/accountant saw no learners, academic records or fees; sampled parent and Junior/Senior teacher scopes did not leak records. Each returned zero out-of-scope learner, academic and fee records. Some samples had no available records, so those results do not prove populated parent/teacher workflows; the isolated tests exercise positive linked-parent and teacher cases. No principal account was available for a live sample; principal read-only behavior was tested locally. Effective client TRUNCATE access was also zero.

## Boundaries and recovery

One admin and one accountant have no effective campus assigned. Their access is denied rather than guessing a campus; an authorised school owner must confirm their intended assignments separately. Main Admin remains school-wide.

Rollback should not restore the known broad policies or client TRUNCATE grants. For an access regression, first inspect the intended user's active role, membership and campus, then prepare a narrowly scoped correction. The local snapshot allows reviewing prior definitions without automatically restoring unsafe grants.

Remaining security acceptance includes a comprehensive RPC/grant audit, hosted signed-in negative tests, admin MFA, complete change auditing and recovery/environment verification. This delivery closes the specified database gaps; it is not a claim that the entire system is security-certified.
