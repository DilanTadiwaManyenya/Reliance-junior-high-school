# Live teacher pilot: create/read failure and sixth-form labels

The signed-in production pilot on 20 October 2026 found a draft save failing with `new row violates row-level security policy for table learning_resources`. The request created a resource with `INSERT … RETURNING`; its SELECT policy calls a STABLE helper that looks up the resource by ID. The inserted row is not visible to that same-statement lookup. Earlier rollback tests inserted without RETURNING, and browser mocks did not reproduce that distinction.

A rollback-only production reproduction confirmed the old request fails while an INSERT without RETURNING followed by a separate authorized SELECT succeeds. Newsletter creation used the same problematic request shape. Both create paths now avoid INSERT RETURNING. Notes are read in a following request; newsletters already perform subsequent authorized requests. Stable client IDs still allow recovery after an uncertain response. RLS and role/allocation helpers were not weakened.

The audit also found the new library/newsletter class constraint accepted only Form 1–6 while the school's confirmed sixth-form names are Lower Six and Upper Six. Migration `20261021180000_allow_library_sixth_form_labels.sql` adds those two labels to the existing campus/class checks, without changing stored class data, allocation scope or parent matching. The newsletter editor offers them explicitly and preserves Form 5/6 compatibility.

The new `library_stage7_create_requests.sql` rollback test exercises the actual statement boundaries under authenticated `aal1` teacher identities for **all 67 enabled subject allocations**, including **22 sixth-form allocations**. It also verifies attachment reservation and Main Admin newsletter creation/targeting/publication. The test confirms the old returning request remains denied rather than broadening read permission to make it pass.

Browser fixtures now model the same INSERT RETURNING failure. The complete release pack passed 25 helper/role tests, 331 feature browser assertions, build, 171 foundation role assertions, 48 parent-reader assertions, 39 newsletter groups, 40 support groups and the new allocation request regression. Production draft upload/download verification follows deployment; do not infer it from the automated pack alone.

No marks, attendance, learner records, fees, payments or orders were changed by this fix. The initial failed production draft had not created a resource/file. School file retention and the remaining role-session pilot are tracked separately in the Stage 7 handover checklist.
