# Mobile design refinement

## Stage 1 — shared dashboards and record cards

Phone layouts apply through 767 px, including short landscape screens. Admin and teacher summaries use compact paired tiles; enlarged text can reflow those tiles into one column. Recent learners become labelled cards on phones while retaining the existing desktop and print table. Junior teacher class actions use a clear primary action and paired secondary actions. Finance record actions fill their mobile card width. Parent record navigation uses compact rows with a visible navigation arrow and retains existing summaries and access restrictions.

Validation: 33 composition cases across 320, 390, 600, 667, 768 and 1280 px, including 200% text and the alternate admin dashboard; 80 staff layouts and accountant navigation/dialog checks; 72 parent layouts, payment-method controls and learner-context recovery; 12 admin record layouts including 667 px; production build. Parent, admin and Junior teacher phone screenshots were inspected. Teacher workspace (24 coursework and 12 surrounding views), draft save/discard scenarios, and 12 Finance layouts also passed. Native browser-history draft checks passed for both campuses. All six core portal tests and the final production build passed.

A previous zoom assertion sampled before layout settled; it now waits for the one-column layout and still fails if reflow does not happen. An interrupted teacher run reported ERR_NETWORK_IO_SUSPENDED; the workflow suite is rerun rather than treated as a pass.

Scope: presentation and browser fixtures. Payment, fees, stock, campus permissions and academic calculations are unchanged. Existing LearnerRecords react-refresh export lint findings also occur at the prior revision. Physical Android/iPhone, screen reader and authenticated hosted sign-off remain open as recorded in portal-mobile-stage9-acceptance.md.

## Stage 2 — shop cards and controls

Next: align catalog cards, toolbars and product-editor controls with the phone breakpoint, verify short landscape and narrow portrait layouts, and retain existing catalog, campus, stock and checkout behavior. Commit and push separately after checks.

## Workspace diagnosis

The repository root is correct and Git metadata is readable. The extra git/ directory contains an empty initialized repository with no commits or remote; it is not the application repository. Local tmp/ QA artifacts and database backups are excluded from new Git additions, while already tracked files remain tracked. Neither directory was deleted. The normal Codex sandbox still reports helper_unknown_error before launching a process; elevated terminal execution works. This is a tooling startup fault, not evidence of a React build failure.
