# Mobile Stage 8 — page loading and recovery

Pages and layouts now load on demand. Opening sign-in no longer downloads staff dashboards, parent reports, shop workflows or unrelated public pages. Role checks and authentication remain immediate, outside the lazy page imports. Activity logging and existing route destinations are unchanged.

A shared, motion-free loading status announces page downloads. A route error boundary focuses a readable error message and provides an explicit Reload button after a failed chunk download. Reload is user initiated; this does not queue or retry transactions. Authentication loading also has an announced busy status. No private-record caching, service worker, offline writes or telemetry was introduced.

## Production lab measurements

Measured `/portal/login` on local Vite production preview, Edge headless, 390 x 844, fresh browser contexts, three samples per build, no CPU/network throttling, external Google Fonts blocked. Baseline source: Stage 7 `562baeb`. Gzip sizes below are calculated with Node gzip, not observed transfer sizes.

| Measure | Before | After |
| --- | ---: | ---: |
| JavaScript downloaded for sign-in | 1,454,851 bytes | 467,766 bytes |
| Calculated gzip JavaScript | 404,850 bytes | 136,794 bytes |
| DOMContentLoaded median | 255 ms | 425 ms |
| DOMContentLoaded sample range | 220–401 ms | 113–466 ms |

JavaScript bytes decreased 67.9%. The final timing median was slower, while an earlier after-build run measured 116 ms. Timing samples are noisy; these three local runs do not establish real-network performance, page-ready timing, LCP, INP, CLS or mobile field compliance. The final production test enforces a 600 KB uncompressed sign-in JavaScript budget and rejects unrelated staff/report chunks. All generated JS chunks are below the previous 500 KB build warning threshold. Initial global CSS remains substantial; report crests remain large and are candidates for further measured work.

## Checks

`npm run test:portal-loading` builds production, tests a held page download, tests a rejected page download, verifies keyboard focus and visible focus styling, checks error-message reflow at 200% text on 320 px, restores service and exercises explicit Reload. It also opens public routes and confirms an unauthenticated staff URL returns to sign-in. Its final step records three production sign-in samples and checks the byte budget.

Existing navigation checks cover role/campus navigation, focus restoration, reduced-motion authentication layouts and 200% text for five role/auth scenarios. Staff, parent and teacher regression suites cover changed shared-route consumers. Core access/render tests and targeted lint remain required. Local fixtures cannot establish hosted authentication, physical mobile keyboards, screen-reader pronunciation, full contrast compliance or complete chart alternatives; these remain explicit Stage 9 acceptance items.

No payment, fee, stock, academic or permission logic changed. Deployment status is verified for the pushed source commit separately from authenticated hosted acceptance.

Recorded results: core 6/6; navigation 16 role/width cases, accountant routing and 18 short auth layouts plus five 200% text cases; staff 80 layouts and admin records; parent 72 layouts plus learner-context isolation; teacher 24 coursework and 12 surrounding layouts plus ECD. The draft retry suite had one DOM-detachment timeout in the combined run and then passed both campuses in isolation. Production loading/recovery/public-route and byte-budget checks passed; targeted lint and build passed.

All 45 report PDFs were generated. PDF content verification found an extra blank page after a Senior report. Reproducing with the Stage 7 App source also produced two pages, establishing that this predates the loading split. Content remains on page one; the single-page acceptance check is pending a Stage 9 print correction. This is not recorded as a passing PDF verification.

Follow-up: Stage 9 isolated the PDF blank page to decorative artwork overflow and corrected its print boundary. All 45 one-page PDF content checks subsequently passed; see portal-mobile-stage9-acceptance.md.
