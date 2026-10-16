# Mobile Stage 2 — navigation, account context and authentication

Stage 1 was already deployed before this stage began.

## Delivered

- A shared account strip keeps the signed-in name and active role visible when the compact header hides desktop account details. Staff also see their assigned campus or all-campus access. This describes account access; existing workspace campus/class selectors still control the current view. Parent learner selection stays in the existing learner workspace rather than being inferred from the parent's profile campus.
- Accountant navigation becomes a labelled, native disclosure on phones/tablets. All five existing workspaces remain available. Selecting one closes the menu and restores focus to its summary; desktop keeps the full navigation row. Resizing across the breakpoint updates the disclosure state.
- Staff logout has an explicit accessible name. Role switching has an explicitly named selector, pending semantics and a readable error surface. Existing sidebar focus trapping, role-based navigation, teacher class/subject separation and class drill-down Back hierarchy remain intact.
- Authentication screens use safe-area padding, dynamic viewport height, readable fields and 44px actions, including password visibility controls. Password controls have stable IDs, a control association and exposed pressed state. Sign-in uses current-password autocomplete. Existing new-password autocomplete remains on setup forms.
- Reduced-motion settings disable authentication entrance animation, sidebar sliding and the staff main entrance movement.

## Scope boundaries

No new permissions, routes, campus assignments, database policies, payment requests, order calculations or fee behavior were introduced. This stage reuses the existing menus and learner/class selectors. Individual module forms, task shortcuts and module-specific unsaved-edit safeguards remain part of their respective admin/finance/teacher/parent stages; this is not final portal-wide accessibility certification.

## Verification

Passed locally:

- 16 staff navigation configurations (four roles at 320/390/768/1024px), including mobile drawer focus, Escape, route selection and scroll restoration.
- Accountant workspace navigation at 320/390/768/1280px and across breakpoint changes; all five routes in the existing staff suite.
- Successful and failed active-role switching; admin navigation does not remain available after switching to teacher.
- 18 authentication layouts (six routes at 320/390/768px, 480px viewport height), password visibility/control association, autocomplete and reduced motion.
- 72 parent/account/report layouts, four uniform payment methods, password-help return routing, print controls and parent route guards.
- Three finance dialogs and staff enrolment at the reduced phone viewport.
- Five representative 200% text reflow checks (admin, accountant, teacher, parent and login), plus screenshot review of account/workspace navigation and sign-in. The review found and corrected a wrapping country prefix.
- Six core role/profile/render/access tests; targeted lint and production build. The layout retains its existing mixed-export Fast Refresh lint warnings; linting that file with only that rule disabled passes. The existing large-bundle build warning remains for the performance stage.

New suites: tests/portal-account-navigation.browser.mjs and tests/portal-text-zoom.browser.mjs, included in npm run test:portal-navigation.

 Browser checks use synthetic local fixture accounts and records. They do not prove authenticated hosted behavior or replace live RLS tests from the catalog phases.

## Manual smoke check after deployment

1. At 320–390px, sign in with each permitted role. Confirm name/role/campus, readable controls and accessible logout.
2. Open the staff drawer, choose Account settings, close with Escape and confirm focus returns. Check Main Admin class/campus controls separately from role switching.
3. As each campus accountant, open Workspace and visit Finance, Learner profiles, Academic progress, Expenses & Cashbook and Point of sale. Confirm only the assigned-campus data and existing POS permissions.
4. As a parent with learners on different campuses, open each learner's records/shop through the existing selector and confirm the learner identity/campus remains correct.
5. Check sign-in, signup, recovery, password setup and teacher first login with the keyboard open. Toggle password visibility and use password-manager autofill. Test a failed role switch without leaving the current role.
6. Check desktop navigation after resizing the same window. Review 200% text, reduced motion and printed reports.

Outstanding Stage 0 performance inventory and final device/hosted acceptance stay on the overall plan. Stage 3 covers admin dashboards and school/academic operations.
