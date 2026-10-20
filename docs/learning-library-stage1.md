# Learning library and newsletters: Stage 1 inspection

Inspected repository and linked Supabase project `ejrtmdvnumjwikehzrrk` on 20 October 2026. This stage records findings and the implementation contract; it adds no portal feature, policies, bucket or database schema. Run `supabase/verification/learning_library_stage1.sql` in SQL Editor to repeat the live prerequisite audit.

## Verified findings

| Area | Existing implementation and consequence |
| --- | --- |
| Senior teaching | `teacher_class_subject_assignments` stores teacher, campus, class level, stream and subject. Live inspection found 67 Senior allocations, 61 with blank streams. Blank means all streams in that form; it must never mean all campuses or forms. |
| Junior teaching | Uses `teacher_class_assignments` for a whole class and curriculum subjects from `src/utils/CurriculumData`. Live counts: 9 Junior class allocations and 25 Senior class allocations. There are no Junior rows in the detailed subject-allocation table. Requiring that table alone would exclude Junior teachers. |
| Permission helpers | Live functions include `has_active_role`, `is_main_school_admin`, `can_manage_school_campus`, `can_read_school_campus`, `accountant_can_access_campus` and `teacher_has_coursework_allocation`. The last checks teacher identity, campus and detailed subject allocation, with a Junior class-allocation fallback. Reuse them, with library-specific target validation. |
| Parent access | `ParentDashboard.jsx` loads `parent_student` with a non-null `verified_at`; learner records provide campus, class level and stream. The selected learner is carried in `?learner=`. Reuse this pattern, with database enforcement. |
| Reporting periods | Live `reporting_periods` has campus, academic year, term and current-period status. Use it for upload defaults; do not infer school terms from calendar months. |
| Announcements | `Announcements.jsx`, `AnnouncementBell.jsx` and `/portal/announcements` exist in code. Both `announcements` and `announcement_reads` are absent live. The page currently ignores query errors, so an unavailable backend can look like an empty feed. The bell component exists, but its mounting still needs to be decided. |
| Old announcement migration | `20260817090000_announcements_and_student_portal.sql` has text-only, role-audience notices, no campus/class targeting or files. It also replaces the profile role constraint with a legacy role list. Do not apply that entire old migration to enable newsletters; write a compatible additive migration. |
| Files | The only live bucket is public `product-images`, limited to 5 MB. There is no library/newsletter bucket or module table. Do not reuse the public catalog bucket for private learning files. |
| Learner subject enrollment | Live subject-related tables contain teacher allocations and their audit, not individual learner subject enrollment. Initial filtering can match campus/form/stream, but cannot claim elective enrollment accuracy. |

## Implementation contract for the next stages

### Teacher notes and targeting

- Senior upload starts inside an existing subject allocation. Junior upload starts in an assigned class, with a subject drawn from its supported curriculum.
- Server checks the current active teacher role, campus and allocation on creation, every edit, replacement and publication. A class tutor assignment must not authorize Senior subject uploads.
- Validate Junior curriculum subjects on the server too; the existing coursework helper permits any subject within a Junior class allocation. Client options alone are insufficient.
- Store immutable scope snapshots: teacher, campus, class level, stream, subject, academic year and term. Keep an optional allocation reference with `ON DELETE SET NULL`, rather than cascading resource deletion. `ClassManager.jsx` currently deletes/reinserts subject allocations during reassignment.
- A lost allocation removes editing access; published notes remain under their original scope. Moving a teacher between campuses must not carry old editing rights into the new campus.
- Parents see published resources only for verified linked learners and matching campus/class/stream. A blank resource stream matches every stream in that exact level and campus. Reject missing/invalid scope rather than broadening access.
- Initially offer all subjects allocated to the learner's form/stream, clearly described as class resources. Individual elective-only delivery needs learner-subject enrollment data; do not infer it from marks.
- Do not move old resources into a learner's new grade during promotion. Initial parent listing uses current enrollment and selected academic year; historical learner access requires verified enrollment-history matching in a later extension.

### Minimal proposed records

| Record | Purpose |
| --- | --- |
| `learning_resources` | Title, description/topic, owner, allocation reference, scope snapshots, year/term, draft/published/archived state, timestamps and publication date. |
| `learning_resource_files` | Resource ID, immutable storage path, original display name, MIME, size, version and uploader. Start with one active attachment; preserve replacement metadata. |
| `announcements` | Compatible shared news/newsletter record with text, category, author, draft/published/archived state, publication/expiry dates and pin status. |
| `announcement_targets` | One row per campus plus optional level/stream. Both-campus publication creates explicit targets; only Main Admin can publish to both. No arbitrary wildcard campus. |
| `announcement_files` | Optional newsletter attachment metadata, using private storage. |
| `announcement_reads` | Unique user/announcement acknowledgment with access checks. A view or download does not prove reading. |
| Resource activity | Server-recorded create/publish/replace/archive events and revision metadata. Downloads, if recorded, are requests rather than proof of study. Reuse existing audit infrastructure where compatible. |

All new tables need RLS, appropriate indexes on scope/publication fields, and existing MFA/role checks. Audit writes must be trusted server/database writes, not forged by browser clients. Do not expose service credentials.

### Access matrix

| Role | Teacher resources | Newsletters |
| --- | --- | --- |
| Main Admin | Trace/view both campuses; no teacher-note upload/edit | Publish/manage either campus or explicit targets for both |
| Campus Admin | Trace/view own campus; no teacher-note upload/edit | Publish/manage own campus only |
| Teacher | Manage own resources while the matching allocation is valid; do not browse unrelated drafts | View published notices relevant to their campus |
| Accountant | Read-only support view for own campus; no note upload/edit or newsletter publishing | View published campus notices |
| Parent | Published resources for verified linked learners only | Published notices targeting at least one verified linked learner |

`can_read_school_campus` also recognizes principals today. Do not accidentally grant a new principal management role: specify principal read access explicitly during implementation and test it. Both-campus authority comes from the Main Admin helper, never from an accountant with an unset or `all` campus.

### Storage and mobile behavior

- Create separate private `learning-library` and `school-newsletters` buckets, initially 10 MB per file. The limit is a proposal, not a live setting.
- Allow PDF, DOC/DOCX, PPT/PPTX, JPEG/PNG/WebP using extension and MIME allowlists. Reject HTML, SVG, scripts and executables. Restrict previews to formats safely supported by the browser; offer download for Office documents.
- File access must resolve through an authorized resource or newsletter record. Storage object policies must recheck role, learner link and scope. Short-lived signed URLs remain usable until expiry; use short lifetimes and never store public URLs as authorization.
- Upload to a new unique path, finalize metadata only after success, and clean up abandoned uploads. File replacement must keep the old attachment usable if upload/finalization fails. Cleanup needs a defined retention window and a trusted job; no blind cascading file deletion.
- Mobile cards show subject, title, date, format and size before download. Paginate lists, avoid automatic file fetching, retain drafts on recoverable errors and show retry states. No silent empty feed on database/network failure.

## Integration map and stage gates

1. **Stage 1 complete:** inspect code/live schema, document constraints and save repeatable SQL. No app build is required for documentation/SELECT-only changes.
2. **Stage 2:** additive library/newsletter tables, private buckets, storage policies, audit hooks and authorization helpers. Verify SQL live. Use scoped role tests for teacher, parent, accountant, campus Admin and Main Admin before enabling UI.
3. **Stage 3:** teacher upload/edit/archive UI integrated with `StaffPortalLayout`, `PortalSidebar`, `StaffDashboard`, `CourseWork` subject context and the Junior class context. Preserve existing class/subject navigation and unsaved-change handling.
4. **Stage 4:** parent library route in `App.jsx` and links in `PortalLayout`/`ParentDashboard`, retaining `?learner=`. Test multiple children, cross-campus parents, unverified links, and guessed resource/file IDs.
5. **Stage 5:** Admin newsletter publishing, targeted parent feed, announcements page and bell integration backed by the same records. Newsletter lists must show backend failures rather than reporting no notices.
6. **Stage 6:** campus-scoped Admin/accountant support view for tracing scope and availability. Do not expose another parent's account/session, or allow support staff to impersonate parents.
7. **Stage 7:** permission, allocation-revocation, stream, promotion, signed-link-expiry, file-replacement, interrupted-upload, pagination and mobile tests; small pilot and documented handover.

Push each stage separately after its checks. Stage 1 is an audited design, not a claim that uploads or newsletter delivery are available.
