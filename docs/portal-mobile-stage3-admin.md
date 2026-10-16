# Mobile Stage 3 — admin registers and operations

The admin learner register, staff directory and shared academic-progress learner list reflow into labelled cards below 600px. All fields and existing actions remain in one DOM/data path; wider screens and print retain table layout. Explicit table/header/row/cell roles preserve the intended relationships during reflow. Teacher attendance/markbook tables are not changed by this stage.

Dashboard shortcuts keep learner search, classes (admins only), fees and staff within reach. The principal no longer receives an unavailable Classes shortcut or misleading Main Admin/campus-management wording. Principal restrictions are unchanged. Learner searches now have an explicit empty state. Staff manage and credential actions have separate large targets; no new destructive action is added.

The existing class drill-down, staff credentials, learner forms, report settings, grade bands, export and activity interfaces remain under their existing permissions and workflows. No learner data, academic marks, backend access or financial calculations are changed.

Verification: the dedicated admin suite covers mobile card reflow/search/edit actions, full names and metadata, principal restrictions and desktop/print tables at 320/390/1280px. The staff layout suite covers 80 role/campus/section layouts at 320/768px, plus five accountant routes and existing finance/enrolment dialogs. The profile-focused workflow suite covers 24 learner-profile tabs, 15 desktop role views and pending-payment dismissal/single-request protection. Local screenshots were reviewed; the stale swipe hint on card registers was removed. Targeted lint and production build passed. The enrolment assertion now waits for the slide-in animation and allows 0.01px measurement rounding (observed width 320.000015px for computed 320px). All 80 layouts passed; the dialog subset passed separately after this assertion correction.

Stage 4 follows with accountant and shared finance/expense presentation. Final physical-device, screen-reader and authenticated hosted acceptance remains in Stage 9; local fixture results are not a claim of live-account or device sign-off.
