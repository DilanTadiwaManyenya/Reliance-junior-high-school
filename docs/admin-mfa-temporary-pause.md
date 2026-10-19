# Administrator authenticator requirement temporarily paused

On 19 October 2026 the school owner explicitly requested removal of the setup requirement for now after repeated invalid TOTP codes. Migration 20261019150000 sets portal_security_settings.require_admin_mfa to false. The portal now reads this existing server setting before requiring an authenticator challenge; existing database and Edge guards already use the same switch. Password sign-in and existing role/campus restrictions continue to apply. No authenticator factors or school records are deleted.

This supersedes earlier stages' requirement for aal2 while the switch remains false. The setup/verification code remains available for a future authorized re-enable. There is no automatic re-enable date. A failed/missing settings read still blocks entry and offers retry; a browser cannot toggle the setting itself.

Manual verification: run supabase/verification/admin_mfa_pause.sql. Expect authenticator_required=false, password-only role/campus checks passing and clients_cannot_change_requirement=true. Browser acceptance covers disabled enforcement at 320/390/667/1280px, settings-read failure, and the retained enabled/resume flows. Existing database/Edge MFA unit tests and production build remain required.

When the owner asks to retry MFA later, first resolve clock/setup problems and test a school administrator's full setup and recovery path. Re-enable the existing server setting only as part of that authorized rollout; do not delete factor registrations or alter campus permissions to troubleshoot sign-in.
