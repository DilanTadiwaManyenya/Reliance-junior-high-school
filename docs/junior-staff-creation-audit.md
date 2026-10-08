# Junior school staff creation — Stage 1 audit

## Current creation path

The Admin portal's Staff screen calls the `create-staff-account` Edge Function.
It creates the Auth user, profile, and `staff_accounts` record, but does not
accept or persist a campus value.

## Existing campus support

- `profiles.campus` supports `junior`, `senior`, and `all` for staff.
- `staff_accounts.campus` supports `junior` and `senior`.
- `teacher_class_assignments.campus` supports `junior` and `senior`.
- Accountant RLS already scopes learner and fee access through the assigned
  campus.

## Duplicate implementation risk

`create_staff_account` is a separate Edge Function that already accepts a
campus value, but the portal does not call it. Stage 2 will make the active
`create-staff-account` function campus-aware rather than switching paths,
avoiding an unreviewed change to account-creation behavior.

## Stage 2 requirements

1. Add a required campus selector to the Admin staff form.
2. Pass and persist the selected campus through the active Edge Function.
3. Filter teacher class choices by campus.
4. Reject cross-campus teacher assignments server-side.
