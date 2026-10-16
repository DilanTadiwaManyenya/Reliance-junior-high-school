# Portal mobile acceptance register — Stage 9

Date: 16 October 2026. Implementation baseline: `cd32dc5` (Stage 8); shop permission/catalog baseline: `562baeb` (Stage 7). Stage 9 adds breakpoint acceptance and a print-only correction. Evidence below comes from local synthetic fixtures and production preview. A Vercel success status confirms deployment, not authenticated device acceptance.

## Route, section and overlay coverage

Each grouped row lists the covered surfaces; a layout pass does not imply every administrative mutation was exercised. Owner names are source components. Commands resolve through package.json. Screenshots/PDFs are local under tmp and are deliberately excluded from Git.

| Surface / primary task | Role and campus | Owner | Automated evidence and practical limit |
| --- | --- | --- | --- |
| `/portal`, choose parent/staff entry | Public | PortalEntry | Production route opens; navigation/auth suite. No authenticated hosted sign-off. |
| `/portal/login`, `/portal/staff-login` | Public parent/staff | PortalLogin | 320/390/768 short layouts, password visibility, phone prefix, keyboard sizing, reduced motion; delayed/rejected chunk recovery. Production JS budget. |
| `/portal/signup`, `/portal/forgot-password` | Parent/public | PortalSignup, ForgotPassword | Parent/auth layouts and password-help routing. Real SMS/email delivery not tested. |
| `/portal/set-password`, `/portal/first-login` | Signed-in forced change / staff | SetNewPassword, TeacherFirstLogin, ProtectedRoute | Short auth layouts and forced-change redirect coverage. No real account password changed. |
| Staff header, drawer, Back, role chooser | Admin/principal/teacher/accountant | StaffPortalLayout, StaffTopBar, PortalSidebar | 16 role/width cases at 320/390/768/1024; focus trap/restore, scroll lock, role-switch failure and success. |
| Accountant Finance, learner profiles, academic progress, cashbook, POS navigation | Junior/Senior accountant | AccountantWorkspaceNav | Four widths plus five workspace routes; campus identity retained. |
| `/portal/staff` overview | Main Admin; Junior/Senior admins; principal | StaffDashboard, StaffOverview | Staff 80-layout suite; quick actions and principal restrictions; synthetic summaries. |
| `/portal/admin-dashboard` alternate dashboard | Main Admin | RoleDashboard | New 320/1280 layout and runtime-error checks. Chart reading/keyboard exploration needs manual review. |
| `section=roster`, search and open/edit learner | Admin/principal; teacher assigned context | StaffDashboard, MobileRecordTable | Labelled mobile cards at 320/390; desktop table at 1280; search/edit/print. Teacher roster in workspace suite. |
| Learner profile Summary, Academics, Attendance, Sport, Behaviour, Fees | Admin/accountant campus scope | StaffLearnerProfile, AccountantLearnerProfiles | Deeper workflows at 320/768; profile write restrictions retained. Academic PDF verification is separate. |
| `section=staff`, directory search/manage | Main/campus admin, principal | StaffDashboard, MobileRecordTable | Mobile and desktop records/actions and principal restrictions. Every credential-reset variation has not been submitted. |
| `section=classes`, register/staff/settings | Junior/Senior admin | ClassManager | Staff layouts and deeper campus class views at 320/768. No live class reassignment. |
| `section=entry`, mark entry / report editing | Admin; assigned teacher | StaffDashboard, grade entry components | Staff layouts, teacher entry navigation. All older markbook mutation combinations are not covered. |
| `section=fees`, balances/payment dialog | Admin, campus accountant; principal view | FeesDashboard | 12 role/width populated checks at 320/390/768/1280; every financial field and fixture totals; principal no-write. Pending payment cannot dismiss/duplicate. No live payment. |
| `section=expenses`, expense/cashbook forms | Main/campus admin/accountant, principal view | ExpensesCashbook | Staff layouts; 320 expense descriptions/profile access; workflow navigation. No real expense submitted. |
| `section=progress-reports` | Permitted admin/accountant/teacher | ProgressReports | Staff role layouts and mobile table cards; principal restrictions tested. Teacher-specific allocation combinations remain a manual audit item. |
| `section=report-settings`, `grade-bands` | Permitted admins | ReportTermSettings, GradeBands | Staff 320/768 layout coverage. Every settings mutation is not submitted. |
| `section=bulk-import`, `activity`, `settings` | Permitted admin/manager | StaffDashboard, BulkLearnerExport, ActivityLog | Staff layout coverage. Real import, export payloads and all settings saves are not acceptance-tested. |
| `section=inventory`, Overview/Products/reports/settings/help | Main/campus admin; campus accountant POS/receipts only | InventoryPOS | Shop/workflow mobile and desktop checks, synthetic RLS tests. Accountants cannot mutate catalog; Main Admin deletion and history guards remain tested. |
| Product add/edit, photo crop/compress/replace/remove, sizes | Permitted catalog admin | ProductPhotoEditor, ProductVariants | Catalog 390/1280 photo geometry/byte budgets and size stock; 320/390/768 x 480 footer, focus and field checks. Real phone camera picker pending. |
| POS cart, held campus baskets, checkout retry, receipts | Main Admin / campus admin / campus accountant | InventoryPOS | Same-ID recovery, retired-request rejection, receipt campus isolation, immutable snapshots and stock rollback. Browser test uses fixture transactions only. |
| `/portal/teacher`, subject/class allocation and coursework | Junior/Senior assigned teacher | CourseWork, JuniorCourseWork | 24 coursework scenarios across 320/390/600/768/1024/1440; 12 surrounding workspace views; invalid score, failure retention, retry and discard guards. |
| ECD developmental markbook route | Junior ECD teacher | Teacher workspace / developmental markbook | ECD navigation test. Full developmental-record entry and native browser Back draft handling remain unverified. |
| `/portal/dashboard`, learner selection/context | Parent, linked Junior/Senior learners | ParentDashboard | 72 parent layouts; late-response isolation, invalid learner fallback, empty/locked states, failed-read retry and same-learner return paths. |
| `/portal/uniforms` | Parent selected verified learner campus | ParentUniformCatalogue, ParentUniformShop | Active campus products, missing image placeholder, size/stock, synthetic four payment methods, campus-forgery rejection and history snapshots. No live order/payment. |
| `/portal/announcements` | Parent | Announcements | 320/390/768 layouts and return navigation. |
| `/portal/learner/:id/academics` | Linked parent / staff profile | ParentRecordPage, AcademicReportCard, JuniorReportBook | Parent ECD, Junior, Senior and A-level layouts; report locks; 45-PDF export/content verification below. |
| `/portal/learner/:id/coursework`, attendance, behavior, sports, awards, insights | Linked parent | ParentRecordPage, LearnerRecords | Each view at 320/390/768; back context and isolation. Screen-reader chart alternatives need manual audit. |
| Shared form, table, dialog/button/notice states | All roles | Portal foundation components | 320/390/768/1280 fixture checks; validation associations, disabled state, 44 px buttons, modal focus and reflow. |
| 599/600, 899/900, 1199/1200 boundaries | Main Admin, Junior accountant, Junior/Senior teacher, parent | Shared shells/layouts | New 30 boundary layouts plus two alternate-dashboard layouts; no document overflow, clipping or runtime errors. These are representative, not every campus/task permutation. |
| Public website routes and missing route | Public | App route chunks | Production smoke opens all public route chunks and missing-page view; private unauthenticated staff route redirects to login. |

## Print defect and acceptance

Stage 8 verification reproduced a trailing blank page with both the old eager App and the new lazy App. Isolation tests traced it to transformed decorative report artwork. Stage 9 clips painting at the measured report boundary in print media only. Screen overflow, typography, academic values and report content are unchanged. The report still uses the existing physical A4 width/scale and beforeprint/afterprint isolation.

Generate all 45 reports with `npm run test:report-print`, then run `python tests/report-print.verify.py` using a Python installation with pypdf (or the Codex bundled runtime). The verifier requires one portrait page and learner identity, final subjects, comments and footer content. Inspect representative Poppler renders; PDF text assertions alone are not a visual sign-off.

## Repeatable execution and evidence

Use `npm run test:portal-acceptance` for sequential core/mobile/boundary/shop/production-loading suites, then run the print/Python commands above. Set PLAYWRIGHT_MODULE and PLAYWRIGHT_CHANNEL for the available browser. Sequential Vite fixture runs are preferred: one draft retry had a DOM-detachment timeout in a combined run and passed both campuses on isolation. No test assertion was weakened to dismiss that failure.

Local evidence families: tmp/mobile-navigation-review, mobile-admin-review, mobile-finance-review, mobile-teacher-review, mobile-parent-review, mobile-shop-review, catalog-review, mobile-performance, mobile-acceptance and pdfs/report-print. Those files may contain synthetic learner details and are not published. Regenerate from the documented commands instead of treating them as permanent checked-in artifacts.

## Outstanding manual acceptance and residual work

| Item | Status / reason | Required check |
| --- | --- | --- |
| Authenticated hosted smoke on both deployments | Pending: deployment success alone does not establish signed-in behavior | Confirm source revision, each role/campus, learner switch, permitted forms and session recovery using dedicated test accounts. |
| Android Chrome and iPhone Safari | Pending: physical devices not available | Real keyboard/rotation, scroll, safe areas, photo/camera picker, downloads, print/share and pinch zoom. |
| WebKit automation | Unavailable in this runtime; executable not installed | Run supported WebKit installation plus physical Safari; Edge emulation is not Safari. |
| Screen-reader and full contrast audit | Pending | VoiceOver/TalkBack/keyboard; status wording, report/chart alternatives, meaningful reading order and all relevant state contrast. Automated role/focus/reflow checks are partial evidence. |
| Universal draft protection | Residual | Existing coursework guard covers supported selectors/actions and native unload. Native SPA Back and every older markbook are not fully protected. Scope a separate fix with task-specific tests. |
| Large reports/rosters/slow services | Partial | Current fixtures have long names and failed/held requests. Very large live-like datasets and authenticated slow-network dashboards need representative fixtures and budgets. |
| Images and CSS bytes | Residual | Initial CSS and large report crests remain measurable optimization candidates. Preserve print quality and brand assets. |
| Remaining form mutations | Partial | Credentials, bulk import, all settings, developmental records and older markbooks need dedicated task fixtures; layout pass is not mutation acceptance. |

Local delivery can be reviewed from this register and its source revision. Final device/accessibility/hosted sign-off remains open until these checks are completed. No claim of full WCAG compliance or mobile field-performance compliance is made.

Execution results for this delivery: Stage 8 role suites and production-loading checks passed as recorded in its notes. Stage 9 passed 32 new boundary/alternate-dashboard layouts, 12 populated finance role/width checks plus expense/profile access, six shop database/campus tests, and all 45 one-page PDF content checks. Parent Senior, parent Grade 1 and accountant Senior PDF renders were inspected. Staff reports retain a more compact layout and existing stamp/summary differences from parent reports; full visual parity is a residual review item, not a completed redesign.

Final targeted reruns: 89 deeper workflow/desktop checks; foundation at 320/390/768/1280; production build, held/rejected chunk recovery, public-route smoke and 600 KB JS budget; five 200% text scenarios. Finance controls now wrap and reserve enough select width to keep year values readable near 900 px; all 32 boundary layouts and the 12 finance role/width cases passed after this CSS change. A final accountant 900 px screenshot was inspected. Foundation screenshots now block external font requests, matching the catalog/performance fixtures; this does not establish external-font availability or final brand-font rendering.

Deployment baseline: both configured Vercel checks succeeded for Stage 8 cd32dc5. Verify both checks against the Stage 9 commit before calling this delivery deployed. Authenticated hosted and physical-device acceptance remains pending as listed above.
