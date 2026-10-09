# Senior stream release checklist

Apply the Stage 3, Stage 4, and Stage 5 Supabase migrations first. Then run
`supabase/verify_senior_stream_workflow.sql` in the Supabase SQL Editor.

Before release, confirm:

- Every official Form 1-4, Lower Six, and Upper Six stream reports `ready`.
- Form 4 has exactly Red, Blue, White, Green, and Purple—one Green only.
- Lower Six and Upper Six have Commercials and Arts only.
- Any remaining non-official active stream has a deliberate correction plan.
- A class at capacity shows **New stream recommended** and the administrator
  can create a named stream from that recommendation.
- A whole-form allocation, such as Geography Form 1, lists each active Form 1
  stream in the teacher Subjects workspace.
- Selecting one stream shows only its learners; Grade Entry and Course Work
  use the same stream.
- A correction test moves a disposable test learner and its allocations to an
  existing target stream, leaves the source inactive, and appears in the
  correction audit report.

No production learner should be corrected until the first audit report has
been reviewed and the intended source-to-target mapping is agreed.
