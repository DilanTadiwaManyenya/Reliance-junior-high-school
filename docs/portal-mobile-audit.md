# Portal mobile audit — 15 October 2026

## Stage 1: shared navigation and controls

The initial 390px audit covered main and campus administrators, principals, accountants, parents, and account-access pages, using synthetic school records. It found parent-header overflow, clipped accountant navigation and learner-profile grids, accountant progress links returning the finance screen, small action targets, and inconsistent shared navigation.

Shared staff toolbars now allocate space explicitly for menu, class context, role switching, and logout. Tablet navigation uses a drawer instead of an inaccessible collapsed menu. The drawer has a close action, labelled state, focus containment, Escape support, restored opener focus, and background scroll locking. Shared slideovers use the same focus/scroll handling. Staff back navigation stays in page flow instead of floating over inputs. Shared portal fields and action buttons use phone-friendly text and target sizes.

Run `npm run test:portal-navigation` for all four staff roles at 320, 390, 768 and 1024px, including drawer navigation and focus/scroll restoration. Browser checks use an installed Playwright package or `PLAYWRIGHT_MODULE` pointing at a host-provided Playwright package directory; optional `PLAYWRIGHT_CHANNEL=msedge` selects installed Edge.

Tests use browser viewport emulation and a mock database. They do not modify live records or verify live backend authorization. Physical-device and hosted-deployment checks are separate.
