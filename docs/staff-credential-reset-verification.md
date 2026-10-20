# Staff credential reset repair verification

Verified against linked project ejrtmdvnumjwikehzrrk on 20 October 2026.

## Reproduced failure

The Auth Admin GET for Mr Muronda returned HTTP 500 with `Database error loading user`, even after missing email identities were repaired. His account and Mr Ngwarayi's account had NULL Auth string fields from direct SQL provisioning.

## Applied repair

Migration 20261021130000 normalizes only NULL confirmation, recovery and pending-change string fields on staff Auth accounts. It preserves IDs, existing token values, passwords, identities and role assignments. Applied live and recorded in migration history.

## Verified results

- Auth Admin GET succeeds for both affected accounts after the repair.
- Auth Admin PUT with an empty JSON object returns HTTP 200 and the expected account ID for both accounts. These checks supplied no password, email, metadata or access changes.
- `supabase/verification/staff_auth_token_fields.sql` returns zero malformed staff accounts.
- `update_teacher_credentials` is ACTIVE, version 6.
- Reviewed the Staff Management save handler and shared Edge Function response parser: the submitted staff ID, phone and password reach the function; returned errors are displayed.

## Verification limit

A real password reset through the signed-in Main Admin form has not been performed by the agent. The user must submit their chosen password to confirm the complete browser flow. Passing the read and empty-update checks does not by itself prove that final submission succeeds.
