# Teacher workspace mobile checks

The coursework grid now uses a shrinking grid track, so long assessment names and tables cannot push the entire page beyond the phone screen. Form fields remain within their cards and use 16px text and touch-sized controls.

On phones up to 600px, each learner's name, class, admission number, mark and status stay together in one card. Tablets and desktops retain the table. Numeric mark fields support decimals and moving to the next learner with Enter; saving and campus/report-component behavior are unchanged. Coursework and other teacher workspace return actions appear above the page instead of floating over form fields.

At widths up to 1200px, the teacher toolbar has separate space for class/subject navigation, class selection and optional role selection. The mobile sidebar starts beneath the toolbar, including when extra controls require another row. Junior landing cards also shrink to fit narrow screens.

## Automated verification

Run `npm run test:teacher-mobile` with Playwright installed, or set `PLAYWRIGHT_MODULE` to an available Playwright package directory. Set `PLAYWRIGHT_CHANNEL=msedge` to use an installed Edge browser; otherwise the script uses Playwright Chromium. Optional `TEACHER_MOBILE_SCREENSHOTS` sets an output directory for review images.

The test starts and closes its own local Vite server and uses only synthetic learners and a mock database. It tests Senior stream and whole-form allocations, Junior Grade 1 and Grade 4, optional multi-role controls, and ECD's developmental-markbook route. Checks cover widths 320, 390, 600, 768, 1024 and 1440px; form containment; readable input sizes; navigation; invalid mark rejection; preserving blank marks and existing marks; decimal entry; Junior report-component behavior; and assessment creation. Twelve additional phone/tablet smoke checks cover the teacher landing pages, markbooks and learner screens, including their return navigation.

These are browser viewport checks, not physical iOS or Android device tests. No live school records or backend permissions are changed by this work. Run `npm run build` and `npm run test:portal` as additional regression checks. Existing coursework hook lint diagnostics predate this layout change; new shared marks and fixture components pass targeted lint.
