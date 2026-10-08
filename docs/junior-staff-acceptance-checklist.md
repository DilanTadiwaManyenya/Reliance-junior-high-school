# Junior staff creation acceptance checklist

Complete these checks in the deployed portal after deploying the
`create-staff-account` Edge Function.

## Main Admin creation

- [ ] Sign in as a Main Admin with the active role set to Admin.
- [ ] Create a Junior Admin; confirm `Junior` appears in the staff directory.
- [ ] Create a Junior Accountant; confirm `Junior` appears in the staff directory.
- [ ] Create a Junior Teacher and choose an ECD or Grade class.
- [ ] Confirm Senior classes do not appear after selecting Junior campus.
- [ ] Select Senior campus and confirm ECD/Grade classes no longer appear.
- [ ] Attempt a cross-campus teacher class submission; confirm the Edge Function rejects it.

## Campus access

- [ ] Sign in as the Junior Teacher and confirm only their assigned Junior learners are available.
- [ ] Sign in as the Junior Accountant and confirm Junior learner fees are available.
- [ ] Confirm Senior learner fee records are not available to the Junior Accountant.

## Audit and recovery

- [ ] Open Activity Log and confirm new accounts say `Created junior <role> account`.
- [ ] Use the existing credential reset action for a created account.
- [ ] Confirm an Admin account must be actively operating as Admin before it can create staff.
