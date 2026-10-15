# Portal mobile audit — 15 October 2026

## Stage 1: shared navigation and controls

The initial 390px audit covered main and campus administrators, principals, accountants, parents, and account-access pages, using synthetic school records. It found parent-header overflow, clipped accountant navigation and learner-profile grids, accountant progress links returning the finance screen, small action targets, and inconsistent shared navigation.

Shared staff toolbars now allocate space explicitly for menu, class context, role switching, and logout. Tablet navigation uses a drawer instead of an inaccessible collapsed menu. The drawer has a close action, labelled state, focus containment, Escape support, restored opener focus, and background scroll locking. Shared slideovers use the same focus/scroll handling. Staff back navigation stays in page flow instead of floating over inputs. Shared portal fields and action buttons use phone-friendly text and target sizes.

Run `npm run test:portal-navigation` for all four staff roles at 320, 390, 768 and 1024px, including drawer navigation and focus/scroll restoration. Browser checks use an installed Playwright package or `PLAYWRIGHT_MODULE` pointing at a host-provided Playwright package directory; optional `PLAYWRIGHT_CHANNEL=msedge` selects installed Edge.

Tests use browser viewport emulation and a mock database. They do not modify live records or verify live backend authorization. Physical-device and hosted-deployment checks are separate.

## Stage 2: admin and finance workspaces

Accountants now have one persistent, wrapping workspace navigator on every screen. Academic progress no longer falls through to Finance. Learner profile grids shrink to fit, campus context is retained in the progress heading, and pagination controls have larger touch targets.

Payment, enrolment, fee-structure, product and receipt dialogs keep focus and background scrolling contained. Financial overlays sit above the staff toolbar, their contents scroll within the phone viewport, and footer actions remain reachable in a 320x480 viewport. `vh` fallbacks accompany `dvh` sizing: the browser audit reproduced a payment form taller than the screen in a browser that does not support dynamic viewport units. Report-setting campus panels also have stable React keys.

Run `npm run test:portal-staff-mobile` to cover 80 main/campus admin, principal and accountant page layouts at 320 and 768px; accountant navigation; and reduced-height payment, enrolment, fee-structure and staff dialogs. Principal fee views remain read-only. Tables retain local horizontal scrolling instead of forcing the whole page wider. These checks do not submit real payments or provision live staff accounts.
