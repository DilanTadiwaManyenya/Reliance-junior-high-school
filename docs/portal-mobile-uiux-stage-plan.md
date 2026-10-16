**Whole-portal mobile responsiveness, UI/UX and visual polish plan**

Prepared 16 October 2026. Status: Stages 1–8 are implemented, tested and pushed; stage notes record exact scope and limits. Stage 9 adds the route/section/overlay acceptance register, breakpoint checks and print correction. Physical-device, screen-reader and authenticated hosted sign-off remain open; see portal-mobile-stage9-acceptance.md. The Stage 8 production sign-in measurement provides a scoped baseline; other representative authenticated performance baselines remain outstanding. This plan covers Main Admin, Junior/Senior admins, Junior/Senior accountants, Junior/Senior/ECD teachers and parents. Principal screens receive regression checks because they share staff components.

**Purpose and scope**

Make every permitted portal task readable, reachable and dependable on a phone while retaining desktop productivity and the school's navy/red/gold identity. Adapt information and interaction patterns rather than shrinking desktop screens. Work through one tested, pushed stage at a time. This phase does not change fees, payment calculation/provider logic, academic calculations, role grants, campus allocations or database history. Main Admin-only product deletion and existing role/campus/student restrictions remain server-enforced.

**What the repository already contains**

- StaffPortalLayout provides URL-backed section/class/subject navigation, a mobile drawer and active-role isolation. PortalLayout/PortalHeader serve parents; AccountantWorkspaceNav provides a separate five-workspace navigation.
- Staff modules cover overview, learners, records/mark entry, staff, classes, imports/exports, report settings, grade bands, progress reports, finance, expenses, inventory/POS, activity and settings.
- Accountant navigation currently labels Finance, Learner profiles, Academic progress, Expenses & Cashbook and Point of sale. Existing test expectations still contain the older Inventory & POS label: Stage 0 must reconcile intended navigation with assertions before accepting a baseline.
- Teacher paths differ materially: Junior class curriculum, Senior subject/form/stream allocations and ECD developmental records require separate scenarios.
- Parent routes include dashboard, uniforms, announcements and academic/coursework/attendance/behaviour/sport/award/insight record pages. Authentication includes login, staff login, signup, recovery, set-password and first-login flows.
- portal.css, portalPolish.css, portalResponsive.css, teacherWorkspace.css, parentPortal.css, parentResponsive.css and inventory.css contain multiple layers of role-specific rules. Several responsive rules use !important. These are candidates for a controlled ownership/cascade audit, not evidence that every declaration is defective.
- Existing tests cover staff navigation, staff mobile screens/dialogs, parent layouts, teacher coursework and portal workflows, plus the catalog/POS editor suite. Coverage is uneven across viewports and semantic assertions. Code inspection is not a fresh test run and is not a physical-device review.
- Recent production builds reported a large main JavaScript bundle, approximately 1.45 MB before gzip. Stage 0 must remeasure before assigning a performance budget.

**Portal-wide mobile design contract**

| Area | Proposed standard | Verification |
| --- | --- | --- |
| Width and reflow | Work at 320 CSS px without page-level horizontal scrolling. Isolate essential two-dimensional tables/mark grids inside labelled scroll regions. | Measure document/card bounds; check zoom and long content. |
| Layout tiers | Start with compact <600px, intermediate 600–899px, tablet workspace 900–1199px and desktop >=1200px. Use content-driven component exceptions with documented reasons. | Include 599/600, 899/900 and 1199/1200 boundaries. |
| Typography | 16px body and form controls; about 14px supporting text; restrained 22–28px mobile page titles. Do not shrink text to force columns to fit. | Check actual computed size, text enlargement and name wrapping. |
| Touch | Project target >=44x44 CSS px; prefer 48px for main actions and adequate gaps around destructive controls. | Check real target bounds and accidental-neighbour taps. |
| Spacing | Shared 4/8/12/16/24/32px scale; consistent card padding, field gaps, radius and elevation. | Shared component examples and screenshot comparison. |
| Contrast and state | Aim for WCAG 2.2 AA; readable text contrast, visible focus, icon/text status cues as well as colour. | Automated checks plus manual inspection; no blanket compliance claim. |
| Navigation | One clear primary navigation per role; consistent menu, page title, back behaviour and account actions. Always make current role/campus/learner context understandable. | Refresh, deep links, browser Back and role/campus/learner switching. |
| Forms | Labels remain visible, appropriate inputmode/autocomplete, clear required/optional fields, inline errors and a useful error summary. | Focus invalid field; verify reduced keyboard-height viewport and long errors. |
| Overlays | Prefer a phone-sized sheet/full-height dialog for complex forms. One intentional scroll area, reachable actions, safe-area spacing and no footer covering inputs. | Focus trap/restore, Escape/backdrop rules, keyboard opening and rotation. |
| Data lists | Cards for simple entity/action lists; true tables for comparisons. Never remove important data merely to fit the screen. | Same information and permissions on mobile and desktop. |
| Actions | One clear primary action per task; separate secondary and destructive actions. Pending, success and failure messages stay near the action. | Duplicate taps, cancellation, server rejection and uncertain network outcomes. |
| Loading/data | Stable skeletons, deliberate empty/error/offline states, visible retries and limited initial data. | Slow-response, failure, empty and large-data scenarios. |
| Images | Preserve the current 5 MB input limit, crop editor, WebP compression and full-image frames. Lazy-load noncritical photos. | Verify output size, geometry, no layout jump and replacement cleanup. |

WCAG AA target-size minimum is generally 24 CSS px with specified exceptions; 44px is our stronger project target. Reflow requirements allow exceptions for essential two-dimensional content. These distinctions must remain accurate in reports.

**Stage 0 — complete inventory, baseline and prioritisation**

Deliver a route/section/overlay register with role, campus, permission, device width, primary task, shared component owner and test coverage. Include sections reached through query parameters, nested class/subject workspaces and account/auth routes. Audit CSS import order, inline width/min-width, fixed heights, sticky elements, scroll containers and duplicated breakpoints.

Run the existing relevant suites first. Investigate failures such as stale navigation labels rather than weakening assertions to obtain green tests. Capture baseline screenshots and measured overflow, clipping, touch size, modal reachability, render errors and task failures. Use synthetic long names, long messages, zero/large lists, inactive learners and slow responses. Categorise P0 blocked/unsafe tasks, P1 difficult reading/navigation and P2 visual inconsistency. Measure representative authenticated dashboard/markbook/finance/shop loads with documented device, cache and network conditions.

Exit: an explicit screen checklist, ranked defect list, baseline evidence and component migration order. Unverified physical-device behaviour is labelled unverified.

**Stage 1 — shared responsive design foundations**

Consolidate design tokens and shared Button/Card/Badge/SectionHeading/form-field/notice patterns. Introduce reusable responsive page header, filter panel, entity card/list, table wrapper and dialog/action-footer recipes where existing components cannot cover them. Retain native accessible controls where they work well. Create a small fixture/style reference to verify states before replacing screens.

Assign style ownership: base tokens, component rules and role/page exceptions. Migrate one family at a time; remove an old override only after its replacements pass. Do not add a new global !important layer or hide overflow to conceal a width defect. Preserve print rules separately from screen rules.

Exit: shared component states fit 320/390/768/1280px, controls meet the touch target, and an existing desktop screen still works. Subsequent stages consume these patterns.

**Stage 2 — navigation, account context and authentication**

Polish StaffTopBar, PortalSidebar, AccountantWorkspaceNav, PortalHeader and role switching. Prototype a compact header plus accessible drawer/menu pattern; avoid stacking a tall header, repeated tab bars and another fixed bottom bar. Keep accountant tasks and parent navigation role-appropriate while sharing visual/focus behaviour. Put frequent task shortcuts on role home pages; move less frequent options into an explicit menu rather than an overflowing row of tiny buttons.

Keep Main Admin all-school/campus selection distinct from active-role switching. Campus staff see their assigned campus; parents see the selected learner. Preserve existing URL hierarchy, direct-link refresh and correct Back targets. Guard unsaved edits before a scope change and clear unrelated cached screen state according to the existing data model.

Include login/staff login, signup, phone/country input, forgot/set-password, first login, show-password, account/profile settings, notifications and announcements. Support safe areas, dynamic viewport heights, text enlargement and reduced motion without disabling zoom.

Exit: every authorised workspace is reachable on a small phone, active context remains clear, no inaccessible off-screen logout/menu item exists, and changing role/campus never exposes another scope's data.

**Stage 3 — admins: dashboard, school operations and academic administration**

Cover Main Admin and both campus admins separately. Rework overview into a few useful metrics plus primary actions; put secondary analytics below the task area. Learner/staff registers use searchable mobile rows/cards with full names, status, campus/class and one clear detail action. Filters collapse into a labelled panel with applied count and reset; preserve selection/back context.

Polish learner profiles, enrolment/edit forms, staff full names/credentials/role assignments, class/stream controls, teaching allocations, record entry and activity views. Never place credential reset, role change or deletion beside a routine tap without clear separation and appropriate existing confirmation.

Academic administration includes report-term settings, grade bands, progress reports, report preview and imports/exports. Import flows show file selection, validation results and clear completion status; do not promise cancellation after a server operation has started unless it is supported. Reports have a readable phone summary/preview and preserve their established printable layout. Shared finance work follows in Stage 4; shop-specific work follows in Stage 7.

Exit: create/find/edit a learner, review staff credentials, open a class, adjust permitted academic settings and reach a report/export without page overflow or lost context. Principal read-only/shared screens do not gain controls.

**Stage 4 — accountants and shared finance/expenses UI**

Prioritise find learner -> inspect balance -> enter allowed payment -> verify result -> view/download receipt, using the existing backend flow unchanged. Ensure amounts/currency and learner identity remain legible above the keyboard. Improve balance summaries, fee structures, payment history, receipts, learner profiles, expenses/cashbook and academic-progress navigation.

Use readable transaction cards with a detail view on phones and tables where comparison matters. Keep date/payment-method/status filters understandable, with clear totals and no hidden columns that change financial meaning. Show precise pending/error/retry states. Never create a new payment request automatically after an uncertain response or turn an unconfirmed payment into a success screen.

Accountants retain their existing permitted workspaces. Within shop they get campus POS/receipts only, with no catalog, photo, stock-adjustment or permanent deletion controls. Shared admin finance/expense views use the same patterns under their existing permissions.

Exit: synthetic/isolated payment and expense workflows, validation and receipt display pass on phones; duplicate submission/idempotency protections and finance totals remain unchanged. Hosted checks do not create real payments.

**Stage 5 — teachers: daily teaching tasks**

Treat Junior class teaching, Senior subject/form/stream allocation and ECD records as separate flows. Keep the selected class/subject/stream/term visible and unambiguous. Prioritise learners, attendance where available, markbook and coursework over decorative dashboard metrics.

For attendance and simple records, use clear learner rows and large controls. For marks, retain a genuinely useful comparison grid with sticky identity/header and an explicit local horizontal scroll region, or provide an alternative one-learner editor where practical. Never hide which learner a mark belongs to. Keep long names, maximum mark, missing/absent status and validation legible; choose numeric input modes appropriately.

Separate save-in-progress, saved and failed states. Preserve unsaved entries during supported navigation and warn before discarding changes. Do not add silent offline mark syncing in this polish phase. Include comments, behaviour/sport/award records and academic/report preview wherever already permitted. ECD developmental ratings must remain suitable for their existing assessment model.

Exit: select an assigned scope, find a learner, enter/validate/save permitted records and recover from a failed save without losing or duplicating data. Unassigned classes/subjects remain unavailable.

**Stage 6 — parents: learner-first home and records**

Put learner selection and learner identity at the top of the experience. Show concise summaries and obvious routes to academic reports, coursework, attendance/insights, behaviour, sport, awards, announcements and uniform shop. Avoid repeatedly showing the same identity/fee summary before every action.

Use readable timelines/cards, clear term/year controls and accessible status messages. Preserve existing verification, inactive-learner history, fee-related report access and unrestricted coursework rules exactly as currently implemented. Report pages need a phone-readable presentation and an obvious download/print path; screen adaptation must not distort the school report PDF/print output.

Cover parents with no linked learners, awaiting verification, multiple learners across campuses, inactive learners, no records and server errors. Switching learner resets unrelated record/cart state and ignores late responses. Avoid introducing persistent local caches of sensitive learner/payment information.

Exit: a parent can select either campus learner, open each record area, understand an empty/blocked state and return to the same learner without data flashes or repeated navigation.

**Stage 7 — shop, POS, media and long-form workflows**

Build on the completed photo/crop work. Admin product/size/stock forms get well-grouped sections, reachable actions, visible crop/size feedback and clear Hide/Show versus Main Admin-only permanent deletion. Accountants retain campus POS only. The actual product ownership and stock model stay unchanged.

On phones, provide clear product search, variant/stock selection, cart summary, quantity controls and existing payment/receipt steps. If a compact sticky cart/action is used, it must respect the keyboard/safe area and not cover product content or dialogs. Preserve separate campus baskets, pending same-ID recovery, retired-test-request rejection and parent selected-learner campus filtering.

Review every long overlay, not only the photo editor: stock adjustments, variants, staff credentials, learner editing and fee/expense forms. Use a consistent focus/scroll recipe. Test very long product names, missing/broken images, upload errors, zero stock and slow compression.

Exit: existing catalog/campus/POS tests plus mobile photo editing and long-dialog tasks pass; no permission, stock, history or payment-rule changes are introduced.

**Stage 8 — accessibility, performance and low-data hardening**

Accessibility and data-use checks apply at every earlier stage; this is the final cross-portal pass. Audit focus order/visibility, labels and error associations, screen-reader announcements, contrast, text zoom, reduced motion, chart text alternatives and sticky elements that could obscure focus.

Use the Stage 0 measurements to choose route/component lazy loading for heavy report/chart/shop work, lighter image/font delivery, stable layout reservations, bounded lists and fewer unnecessary data refetches. Assess existing pagination/query semantics before changing data loading; any needed server/API change is separately scoped and documented. Do not add offline write queues, service-worker caching of private records or new telemetry that uploads learner details.

Aim for Core Web Vitals good thresholds: LCP <=2.5s, INP <=200ms, CLS <=0.1 at the mobile 75th percentile where valid field data exists. Use repeatable lab checks for development and label them as lab measurements, not field compliance. Baseline device/network/route conditions determine realistic first-stage budgets; slow-network task recovery is required even when a numerical target is not achievable on that connection.

Exit: measured before/after bytes/timings, no new accessibility blockers, no sensitive shared-cache exposure, and critical actions remain understandable on slow or interrupted connections.

**Stage 9 — full acceptance and controlled rollout**

Use a screen-by-screen acceptance register with role/campus, primary task, viewport, screenshot, test command/result, defect status, source commit and hosted verification status. Fix shared regressions before declaring a role complete. Verify desktop and print alongside mobile.

Run high-priority role tasks at 320/390/768/1280px and representative/edge layouts at 360/414/600/900/1024/1440px, breakpoint boundaries, portrait/landscape and reduced 390x480px keyboard-like viewport. Reduced viewport emulation does not replace a real mobile keyboard test. Include text zoom and 320px-equivalent reflow checks.

Use Chromium automation and WebKit where available. Complete real Android Chrome and iPhone Safari checks for scrolling, keyboards, file/photo selection, downloads, print/share paths, safe areas and pinch zoom. Keyboard-only and screen-reader checks supplement automation. If devices/accounts are unavailable, record that limitation instead of claiming sign-off.

Exit: all inventoried routes/sections/overlays have a result; no unresolved P0/P1 defect blocks release; role/campus isolation and critical financial/academic workflows pass; deployment source revision is verified. Publish residual P2 items rather than silently omitting screens.

**Existing regression commands to extend**

- npm run test:portal — core role/profile/render checks.
- npm run test:portal-navigation — staff navigation/focus.
- npm run test:portal-staff-mobile — staff role/campus layouts and key dialogs.
- npm run test:teacher-mobile — teacher coursework layouts and marking flows; extend to remaining teacher tasks.
- npm run test:portal-parent-mobile — parent/auth/record layouts and relevant submissions.
- npm run test:portal-workflows — cross-role module/overlay flows; reconcile stale labels with current intended UX.
- npm run test:portal-mobile — orchestrates the mobile suites above.
- npm run test:shop:campus and npm run test:shop:browser — catalog/campus/POS guards and editor/display workflows.
- npm run test:report-print — preserve printable academic output.
- Targeted lint and npm run build for each relevant stage; expand checks when a shared change warrants it.

Do not repeat every expensive suite for an isolated label adjustment; select checks from actual changed consumers. Shared shell/style changes require broader role coverage. Test with fixtures/dedicated nonfinancial records; no live payment, history deletion or campus reassignment is part of this plan.

**Delivery rule for every stage**

Record the planned scope and baseline, implement a small reviewable slice, run relevant checks, inspect representative screenshots, commit and push that stage, and verify both configured hosted deployment statuses for the exact source commit. Authenticated hosted smoke checks are distinct from local fixture tests. Report what changed, tests/results, commit, deployment and remaining items. If a backend change becomes necessary, provide exact scoped SQL, live verification and recovery notes; do not apply unrelated pending migrations. Proceed to the next stage after the current stage's required checks pass. Preserve unrelated workspace edits and keep private screenshots/backups out of commits.

Stage 2 navigation/account/authentication foundations are implemented and verified; see docs/portal-mobile-stage2-navigation.md for scope and results. Stage 3 admin register/dashboard improvements are implemented and verified; see docs/portal-mobile-stage3-admin.md. Stage 4 finance/expense presentation and campus display corrections are implemented and verified; see docs/portal-mobile-stage4-finance.md. Stage 5 coursework feedback/draft protection is implemented and verified; see docs/portal-mobile-stage5-teachers.md. Stage 6 parent learner context/loading/return paths are implemented and verified; see docs/portal-mobile-stage6-parents.md. Stage 7 shop and long forms is implemented and verified; see docs/portal-mobile-stage7-shop.md. Stage 8 route loading, accessible recovery and production byte budgets are implemented; see docs/portal-mobile-stage8-performance.md. Stage 9 local acceptance coverage and residuals are recorded in docs/portal-mobile-stage9-acceptance.md; final manual/device sign-off remains open. Module-specific form safeguards and shortcuts continue in their role stages. Complete the outstanding Stage 0 screen inventory/performance baseline alongside scoped work before final Stage 9 acceptance. This plan does not imply a simultaneous portal-wide rewrite.

**Standards references**

- W3C reflow: https://www.w3.org/WAI/WCAG22/Understanding/reflow.html
- W3C minimum target size: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- W3C text contrast: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
- Google Core Web Vitals guidance: https://web.dev/articles/vitals
