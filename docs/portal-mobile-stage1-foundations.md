**Mobile portal Stage 1 — shared design foundations**

16 October 2026. Scope: shared visual/accessibility primitives and reference fixtures. This stage does not redesign role navigation, dashboards or individual workflows; those remain later stages in portal-mobile-uiux-stage-plan.md. The user requested Stage 1 directly; the complete Stage 0 audit is not represented as completed.

**Delivered patterns**

- portalFoundation.css defines portal-scoped spacing, colour, surface, radius, touch and focus tokens. Shared controls target at least 44px. Mobile form controls in the new field pattern use 16px text. Cards/notices wrap long content; shared interactive elements have visible keyboard focus. Existing school colours remain.
- Button forwards link props and preserves native form submission semantics. Disabled links have no destination and do not run caller actions. Card/Badge/SectionHeading forward appropriate caller props and provide stable shared classes. Portal card/button hover does not move controls under a finger/pointer.
- FormField associates a visible label, optional hint and validation error with a single native control through stable IDs and aria-describedby/aria-invalid. Required fields remain native-required. It is an adoption primitive for later page stages, not a claim that every existing form has migrated.
- PortalPageHeader, ActionBar and FilterPanel provide wrapping page actions, primary/secondary grouping and a native keyboard-accessible collapsible filter panel.
- DataTable keeps all columns and provides a labelled keyboard-focusable local scroll region. It does not replace comparison tables with incomplete mobile summaries.
- SlideOver uses unique title/description IDs, honours reduced-motion preference and retains existing focus trapping/restoration. A fixed viewport-sized panel contains a single scrolling body; close/save controls remain reachable in reduced-height tests.
- PortalNotice supports caller semantics, readable information/error/success/warning states and alert semantics for errors.

**Style ownership and scope**

| File/group | Responsibility |
| --- | --- |
| index.css | Existing public website/base styling; not redesigned in Stage 1. |
| portalFoundation.css | Shared portal tokens and ui-* component patterns. Screen rules are separated from print. Imported after existing responsive layers and before reportPrint.css in production and equivalent fixtures. |
| portalResponsive.css / parentResponsive.css | Existing role shell/layout rules, retained until the corresponding staged migration. |
| staffPortal.css / teacherWorkspace.css / parentPortal.css / inventory.css | Existing role/module-specific layouts and controls. |
| reportPrint.css | Existing report/print layout; not restyled in this stage. |

No global overflow-hiding workaround or new !important layer was added. Existing unrelated overrides were not removed blindly. Public component typography/sizing isolation is explicitly checked. New field/header/filter patterns are intended for portal use within a portal shell.

**Reference and repeatable checks**

- Reference fixture: tests/fixtures/foundation/index.html. With the local Vite server running, visit /tests/fixtures/foundation/index.html. Synthetic example data only; no backend writes.
- npm run test:portal-foundation runs the reference browser checks. It is included at the start of npm run test:portal-mobile.
- Reference widths: 320, 390, 768 and 1280px, plus 480px reduced viewport height. Tests cover minimum targets, disabled actions/links, native submission, validation associations, local table focus, public-site isolation, dialog action visibility/hit testing, unique IDs and focus restoration.
- Screenshots: tmp/mobile-foundation-review/components-{width}.png. The 320px and 1280px reference screenshots were visually reviewed. Screenshots are local review artifacts, not production records.
- Staff regression expectations were updated from the obsolete Inventory & POS label/generic inventory heading to the existing Point of sale label and Junior school POS heading. No accountant navigation or permissions were changed by that test update.

**Verification and rollout**

The focused four-width reference suite passed. The six core profile/render/teacher-access tests passed. Final targeted ESLint/build and broader staff/parent/teacher mobile results are recorded below after completion. Production build retains the previously known large-bundle warning; performance splitting remains a later stage.

No database migration, live record cleanup, payment calculation, academic calculation, role grant or campus allocation is part of Stage 1. Browser regression submissions use isolated fixture backends. Physical Android/iOS keyboard and screen-reader checks are not claimed; the reduced-height viewport is an automated approximation. Hosted authenticated smoke testing is distinct from the local fixtures.

Next planned stage: navigation, account context and authentication (Stage 2), followed by role-specific adoption and polish.

Verification detail: all 80 staff layout cases passed in the first run. Its later navigation assertion exposed the stale POS title; after correcting that expectation, the focused navigation/dialog mode passed all five accountant routes, three financial dialogs and staff enrolment. All 72 parent layouts and four uniform payment-method fixture submissions passed. The teacher target check now requires a computed minimum of at least 44px and allows only 0.01px of measured-rectangle rounding (an animated ancestor reported 43.99988px); the target was not reduced.

Completed checks: four reference widths; 80 staff layouts plus five accountant navigation routes, three financial dialogs and staff enrolment; 72 parent/account/report layouts plus four uniform payment methods and route/print controls; 24 teacher coursework combinations, 12 surrounding workspace views and the ECD route. Six core portal tests, targeted ESLint and production build passed. Existing bundle-size warning remains.
