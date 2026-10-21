# Senior teacher navigation and mobile review — 21 October 2026

## Stage 1 — return paths

The live Senior library showed no in-page return action because its button inherited `.coursework-back`, hidden by shared teacher CSS. Give it its own class and include it in the existing unsaved-draft navigation guard. Add Subject allocations to the Senior teacher sidebar in both workspaces. Selecting that menu now clears the previous subject selection; switching between actual work areas preserves it. Expose the Class work/Subject work selected state with `aria-pressed`.

Pushed as `3a08de2`. The library fixture now includes shared teacher CSS so this visibility failure cannot pass the isolated component test unnoticed.

## Stage 2 — allocation context and mobile composition

Add a subject/form/stream context strip and Markbook, Course Work and Library shortcuts. Show it only for an allocation matching the signed-in teacher's current profile and route. Use the existing route handlers and draft guard; shortcuts grant no permissions. On phones the context and shortcuts stack, with three equal work-area buttons, wrapping labels and at least 44px tap targets. Improve library card spacing, aligned card actions, full-width mobile file actions and long download-link wrapping.

## Validation

- Production build passed; focused lint passed. Existing StaffPortalLayout export lint warnings predate this change.
- Teacher mobile suite: 24 coursework scenarios at 320/390/600/768/1024/1440px, 12 surrounding teacher views and ECD route passed. Fixtures exercise validation and saved marks with synthetic data.
- Library suite: 105 existing assertions across Junior/Senior at 320/390/768/1440px passed, plus return-button visibility checks using shared teacher CSS.
- New Senior navigation suite: allocation chooser/scope reset, selected workspace, shortcut current state, cancelled draft navigation, confirmed discard, browser Back, class switch, width containment and 44px navigation targets at 320/390/768/1024/1440px.
- Existing Senior/Junior native Back/Forward draft protection suite passed in Stage 1.

Screenshots under `tests/artifacts` use synthetic data and are not committed. Live inspection used the existing Senior account; no grades, attendance, learners or published content were changed. Automated viewport tests emulate screen sizes and do not establish physical-device acceptance. Production rendering of this new stage must be checked after deployment; a push alone is not deployment verification. Actual library byte download remains unconfirmed from the earlier pilot.
