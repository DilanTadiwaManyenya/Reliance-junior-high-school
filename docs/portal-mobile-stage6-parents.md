# Mobile Stage 6 — parent learner context and safe return paths

The parent dashboard visibly identifies learner campus/class and stores the selected verified learner ID in the URL. Record, shop and compact-header Back actions preserve that learner. Invalid/unlinked URL IDs fall back to a verified connection; no URL value grants access. No learner details or records are persisted in local storage.

Dashboard records are associated with the requested learner and late responses are ignored after switching/unmounting. Another learner's previous data is hidden immediately during a switch. Failed reads show a retry action rather than presenting empty fees as a successful response. Link-load errors remain visible, including in the no-connection state. Existing verification, inactive learner history, fee-gated reports and unrestricted coursework rules are preserved. Parent entrance motion respects reduced-motion preferences.

Passed: 72 parent/auth/record layouts at 320/390/768px, four synthetic uniform payment methods, password-help routing, print controls and parent route guards. The new context suite covers cross-campus switching, late response isolation, record/shop/header return paths, failed-read retry and invalid learner IDs. Targeted lint and production build passed. All data in browser checks is synthetic; real-device and authenticated hosted acceptance remains in Stage 9.

Stage 7 follows with shop/POS media and long-form presentation. No live orders, fees or payments were changed.
