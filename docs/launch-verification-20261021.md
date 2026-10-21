# Launch verification — 21 October 2026

The 14:30 Harare target was not met for every check. Findings are separated
from confirmed results; a successful build is not a real-account pilot.

## Stage 1 — live admissions and allocation checks

Pushed 43107ee. Live rollback tests found two enabled Senior Lower 6 class
allocations failing with duplicate admission numbers. The allocator now shares
one globally locked prefix sequence across Form 5 / Lower Six / Lower 6 (and
the equivalent Upper aliases), scanning existing prefixes rather than only one
display label. Existing admission numbers were not changed. New alias admissions
use the existing USD sixth-form fee mapping. The exact migration was applied.

Rerun passed all 9 enabled Junior and 25 Senior class allocations, including
teacher INSERT/read and admission fee seeding. All 67 Senior subject allocations
passed coursework assessment creation and mark INSERT/UPDATE/read under their
actual database role helpers. Synthetic learners, marks, counters and audits
rolled back. See supabase/verification/launch_teacher_checks.sql.

## Stage 2 — reports and ECD

Junior report teacher comments previously stayed blank without an office note;
Senior reports lacked an overall teacher-comment section. Generated fallbacks
now use each learner's recorded performance, consistently across campuses.
ECD comments use developmental ratings. Missing marks are not scored as zero;
saved teacher comments remain authoritative. Verified initials are displayed,
never invented from an unverified name. Sixth-form aliases are recognized as
Senior levels when rendering reports.

ECD A/B switching reproduced an old saved top-bar class overriding the newly
selected markbook class. A valid current selection now takes precedence over
session restoration. Junior markbooks derive their class from shared scope and
filter by its stream, clear the selected learner when scope changes, and have
explicit Class/Learner labels. The 480px fixed ECD rating grid overflowed at
320px; mobile ratings now wrap each development area above five equal choices.

Validation: teacher security/admission/grade/redirect tests passed (19 checks);
teacher browser coverage passed 24 coursework viewport/scenario combinations,
12 surrounding teacher views, and ECD developmental routing. Senior allocation,
Back, draft protection and class-teacher-only roster tests passed at five widths.
New ECD A/B tests check class switching, no opposite-class/campus learner options,
cleared selection, and containment at 320/390/1280px. Report printing passed all
45 combinations: 15 levels from ECD A/B through Upper Six for parent, admin and
accountant. Settled/overpaid fee gates return zero owing; another currency's
arrears still lock results, without conversion or offsetting credits.

## Credential and signature limits

The deployed update_teacher_credentials function is ACTIVE (version 6), teacher
Account settings exposes phone/password changes, and zero enabled teacher
profiles lack an Auth account. No real password was changed as a test; this is
not a claim that a fresh production password-change pilot was completed.
The first snapshot showed two teachers without verified initials. A later
read-only snapshot showed zero, and zero missing Auth accounts; both campuses
were open for 2026 Term 3. No initials were fabricated by these code changes.

The supplied production browser was signed out. Mocked browser checks establish
rendering/workflow behaviour, and live rollback SQL establishes database access;
they do not establish a signed-in pilot on every physical phone/account.

## Remaining staged work

Finish the expense-control stage held aside for launch review, then controlled
fee-balance adjustments. The expense migration was dry-run only at this point;
do not claim it applied until its own installed-schema verification succeeds.
