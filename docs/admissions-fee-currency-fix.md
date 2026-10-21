# Admissions fee currency compatibility — 21 October 2026

The enrolment trigger used the old three-column conflict key after fee accounts became unique per currency. This blocked new learner inserts. The replacement uses the four-column key and explicitly selects the USD schedule. Automatic enrolment remains USD; ZWG accounts remain separately configured, with no conversion.

Applied `20261021190000_fix_admission_fee_currency.sql` to the linked database. The six-class-band rollback probe passed before application and again against the installed function: ECD A, Grade 1, Form 1, Form 3, Lower Six and Upper Six each created one USD account with the USD schedule amount. Synthetic learners and temporary schedule edits were rolled back. The migration replaces only the function and does not update existing financial records.

Run `supabase db query --linked --file supabase/verification/admission_fee_currency.sql` to repeat the rollback test. This checks database trigger behavior; signed-in role/browser admission acceptance is still separate. No permission policy changed.
