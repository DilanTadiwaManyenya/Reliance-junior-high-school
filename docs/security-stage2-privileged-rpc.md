# Security Stage 2: privileged RPCs and trusted account roles

17 October 2026. This continues the security phase; it is not the academic lifecycle stage.

## Changes

- Inventoried all 69 live public SECURITY DEFINER functions and caller grants; reviewed the authorization bodies of the reporting, correction, provisioning, allocation and finance paths covered here. Anonymous callers no longer execute any of them. Trigger functions and internal admission lookup/allocation routines are not directly callable by application users; service-role registration retains access. Authenticated permissions on other existing RPCs remain intact.
- Class corrections require management access to both source and target campuses. Admission audits filter results by the caller's campus. Teacher report metadata uses learner/campus permissions, verified parent links or learner ownership instead of school-wide staff-role checks.
- Subject and coursework teacher checks include active role and campus, preventing stale or cross-campus assignments from authorising access.
- Auth profile bootstrap reads roles from server-controlled raw_app_meta_data. Caller-editable raw_user_meta_data supplies display/contact fields only. Existing profiles and memberships are not rewritten.
- Staff provisioning and student registration send trusted app_metadata roles. The three deployed functions are create-staff-account, register-student and seed_reliance_staffing. The seed is Main Admin-only. Matching legacy source aliases were updated but were not newly published.
- Student verification RPC argument names now match the database signature. Public registration's existing verify_jwt=false was preserved; protected staff endpoints retain verify_jwt=true.
- Future postgres-owned functions no longer inherit global PUBLIC execute. PostgreSQL cannot remove that built-in global default with a schema-only revoke. New functions need explicit application grants; service_role has a public-schema default grant. Existing non-definer functions were not altered.

## SQL and release order

Exact SQL: supabase/migrations/20261017110000_harden_privileged_rpc_access.sql. Deploy compatible account-provisioning functions first, then apply this migration transactionally with its migration-history entry. Do not run all historical migrations. Both steps were performed on linked project ejrtmdvnumjwikehzrrk. Ignored local snapshots of prior function definitions, ACLs and defaults are in tmp/security-stage2-before.local.json and tmp/security-stage2-functions.local.json.

Run supabase/verification/security_stage2_checks.sql read-only. Expected: migration_applied and trusted_signup_role/campus guards true; anonymous_definer_execute, client_trigger_execute, client_internal_admission_execute and definers_without_service_execute zero. Repeat scripts/verify-security-stage1.ps1 for the live aggregate role/campus probes; scripts/verify-security-stage2.ps1 checks the scoped admission audit and cross-campus/anonymous RPC denials.

## Validation

npm run test:security-rpc uses isolated PostgreSQL with pre-change live definitions (sanitised schema-only fixture), reproduces the cross-campus report and unnecessary anonymous-call paths, applies the migration twice, and tests cross-campus denials, allowed Main Admin/verified-parent reports, scoped admission audits/corrections, active teacher role, service-only admission checks, trusted role bootstrap, and future function defaults. It passed. npm run test:security-campus and targeted ESLint also passed. Deployment bundling succeeded for all three Edge Functions.

Live verification passed: zero anonymous privileged-function grants, zero direct client trigger/internal-admission grants, all service-role grants retained, and all three function-body guards confirmed. All ten Stage 1 live campus samples passed again with zero out-of-scope rows. These probes impersonate real database roles in READ ONLY transactions and roll back; they are not authenticated hosted browser tests. No live school records or Auth accounts were created as a smoke test.

## Limits and next security acceptance

Admin MFA, end-to-end staff creation/registration using dedicated test accounts, hosted negative tests, full audit coverage, rate limiting and recovery/environment checks remain open. The student signup UI references the underscore function alias while the deployed listing contains the hyphenated endpoint; existing admission-number/class validation also needs a dedicated registration acceptance stage. This delivery does not claim to fix the complete pre-existing registration flow. Report publication/fee-withholding behaviour across every reporting RPC also requires separate acceptance; academic and fee calculations were not changed.

Recovery should preserve the trusted bootstrap and least-privilege grants. Prefer a narrowly scoped correction after checking user membership/campus. Do not restore the previous user-metadata authority or broad RPC grants. No automatic rollback script reenables those vulnerabilities.
