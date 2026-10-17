# Admin two-factor authentication: operator delivery

17 October 2026. This is security stage 3, continuing the security work before academic lifecycle work.

## Behaviour

Every account with an admin profile, active admin role or admin membership must complete authenticator verification before entering protected portal pages. A first-time admin enrols TOTP using a QR code or private setup key; subsequent password sign-ins require a six-digit authenticator code. Required password changes remain accessible before MFA setup. Parent, teacher, accountant and principal accounts without admin membership retain their existing sign-in flow.

No existing administrator's factor is generated or enrolled by this delivery. QR codes, setup secrets and entered codes are held in component memory and are not written to local storage, analytics, application audit logs or source files. The page supports failed checks, wrong codes, retry, sign-out, multiple existing TOTP factors, and cleanup of this portal's abandoned unverified factors. It never deletes a verified factor. Codes require an actual aal2 session upgrade; a successful-looking API response alone is insufficient.

## Enforcement and release order

Exact migration: supabase/migrations/20261017120000_admin_mfa_guards.sql. It creates a service/operator-controlled rollout setting, default off, plus a server-side MFA predicate used by active-role helpers and restrictive RLS policies on current protected public tables and Storage objects. Own profile, role membership and the nonsensitive security requirement remain readable for enrolment. Reporting helpers with direct verified-parent branches also check the predicate. Campus and ownership rules remain in force after MFA.

Eight deployed admin-management Edge Functions independently check signed caller claims using auth.getClaims before service-role operations. They fail closed on missing configuration or insufficient assurance. Legacy global staff reset, parent-password reset and email migration endpoints are Main Admin-only; scoped staff management retains its existing campus checks. The unrelated swift-function was downloaded into ignored tmp for inspection: it only returns a greeting and has no database/account mutations. It was not changed.

Deployment order: apply the transaction with require_admin_mfa=false; deploy the eight Edge guards; test/build and push the setup UI; verify both frontend deployments; run the live activation check below. Never enable the switch before the MFA setup page is available. Rerunning the migration preserves the existing setting.

Read-only SQL verification: supabase/verification/security_stage3_mfa_checks.sql. After activation expect mfa_required=true, tables_missing_mfa_policy=0, storage_mfa_policy=true, role_helper_checks_mfa=true and temporary_accounts_remaining=0.

## Live acceptance script — creates a temporary account

node scripts/verify-admin-mfa-live.mjs performs a provider preflight using one synthetic admin Auth account and deletes it in finally. It does not change the rollout switch. Project credentials, temporary password, QR and TOTP secrets stay in memory; only outcome messages are printed. Run only as an authorised project operator. This is not a read-only probe.

node scripts/verify-admin-mfa-live.mjs --activate first proves live TOTP enrolment/verification, then enables mandatory MFA, tests aal1 database denial and self-profile access, rejects the password-only caller through the actual Edge guard, verifies aal2 Main Admin access, and deletes the temporary account. If activation validation fails, the script restores its prior switch value. This neither enrols nor resets an existing administrator's factor. The preflight passed and its synthetic account was deleted.

## Tests

- Database tests: mandatory aal1 denial, aal2 access, own-profile setup, non-admin roles, mixed admin/teacher membership, service-side signed claim checks and missing/error configuration.
- Browser: setup, existing-factor verification, retry, wrong codes, unupgraded responses and narrow/landscape/desktop layouts (13 cases at 320/390/667/1280 px).
- Prior security stages, targeted ESLint, production build and core portal tests.
- Shared staff fixtures model an already verified session; shared browser setup now waits for the MFA boundary before asserting dashboard controls.

All 80 staff layouts passed. Three finance dialogs and staff enrolment passed after removing the layout entrance animation that trapped fixed overlays beneath the header after the new auth boundary. Existing StaffPortalLayout react-refresh export lint findings were confirmed on the prior revision; new MFA files passed lint. Rollout activation is verified separately after deployment. Live provider acceptance is distinct from existing-account, physical-device and hosted browser sign-off.

## Recovery and future changes

See docs/admin-two-factor-guide.md. Recovery is performed by an authorised Supabase project operator after identity verification; no public factor-reset bypass or school-portal MFA-disable button is provided. Keep a documented, authorised project-operator recovery contact. Password reset alone does not remove MFA.

Future protected tables must include the restrictive MFA policy; future privileged RPCs and service-role Edge operations must enforce this predicate or signed aal2 claims. This migration covers current tables/functions and the eight reviewed admin endpoints; it is not automatic protection for future additions. Broader audit completeness, dedicated test/live environments and school-wide go-live acceptance remain separate work.

References: https://supabase.com/docs/guides/auth/auth-mfa/totp and https://supabase.com/docs/guides/auth/auth-mfa .

## Verified activation

Mandatory enforcement was activated after both a8df14c frontend deployment checks succeeded. The live acceptance script passed real TOTP enrolment and aal2 verification, password-only record/Edge denial, setup-profile readability, and recovered aal2 Main Admin access. The temporary acceptance account was deleted. Read-only final SQL verifies the active setting and cleanup.

The first activation acceptance exposed a provider provisioning detail: the new Auth user had a Parent database profile despite trusted Auth metadata. Enforcement was automatically restored to its previous setting, and that test account was removed. New staff/learner service workflows now explicitly provision profiles.role, active_role and the matching user_roles membership, removing only the new account’s bootstrap Parent membership. This fixes future account creation; no existing accounts were reassigned. The corrected preflight proved the actual Admin database role before successful activation. Regression tests exercise this provisioning helper using isolated PostgreSQL.
