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

## Stage 3: parents, reports, recovery and final breakpoints

Parent headers now wrap into clear navigation rows instead of overflowing. Back and Log out keep their text labels instead of appearing as identical arrows. Dashboard cards, learner selectors, uniform carts and report controls have phone gutters and shrinking tracks. Junior report tables scroll inside their own region; Senior report marks can also be reached and scrolled by keyboard. Screen-only rules preserve the print layout.

Password help is linked from both sign-in forms, and its return link goes back to the corresponding parent or staff form. The school-office reset procedure remains in place. Lower Six and Upper Six now use the Senior academic report instead of being classified as Junior learners. A final laptop-width check also found and repaired multi-role teacher toolbar overflow at 1280px.

| Finding | Reproduction | Result |
| --- | --- | --- |
| Parent header too wide | 390px phone produced a 414px document | Header and page stay within viewport |
| Accountant profile grid clipped | Card expanded to 651px on a 390px screen | Cards and filters shrink within the page |
| Financial dialog taller than phone | 845px form in a 480px-high viewport without `dvh` support | `vh` fallback, bounded scrolling and reachable actions |
| Accountant progress link opened Finance | Open Academic progress | Correct progress screen and campus context |
| Sixth-form report used Junior layout | Lower Six or Upper Six learner report | Senior report and crest |
| Teacher toolbar breakpoint gap | Multi-role account at 1280px produced a 1375px document | Compact toolbar covers the intermediate width |

Run `npm run test:portal-parent-mobile` for 72 parent, account-access and report layouts at 320/390/768px, all four uniform payment choices, password-help return paths, print controls and parent route guards. Unpaid report locks, inactive-learner restrictions and the absence of principal payment controls are explicitly retained in the relevant browser tests.

Run `npm run test:portal-workflows` for deeper inventory tabs and settings, product/receipt dialogs, accountant cart readiness, nested class register/staff/settings pages, all learner-profile tabs, and account headers at 1024/1280/1440px. Checkout readiness checks do not submit an actual sale. Mock parent orders do not charge any payment provider. A delayed-payment regression also checks that Escape, the close button and background taps cannot dismiss a financial dialog while its save is pending, and that only one request is made.

`npm run test:portal-mobile` runs the navigation, staff, parent, existing teacher and deeper workflow suites together. `npm run test:portal` covers the existing profile/authentication and isolated teacher-access checks, including sixth-form report rendering. Production builds pass with the pre-existing large-bundle warning. Targeted lint passes for new components and account forms; existing hook/unused-code lint issues remain in older dashboard/report components, with no new diagnostics introduced by these changes.

No Supabase migration or live record change is required for this UI work. GitHub push does not by itself verify that a hosted deployment has completed. Physical iOS/Android keyboard, browser chrome and printing should still receive a real-device acceptance pass.
