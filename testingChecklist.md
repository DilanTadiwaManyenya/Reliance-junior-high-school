# Campus classification verification

1. Run `supabase/fixCampusAssignment.sql` in Supabase SQL Editor.
2. Confirm its first result lists Form 1 Green (24) and White (23) with campus `senior`.
3. Confirm its second result lists Form 1 at `170.00`.
4. Reload the portal. In Fees, **Senior campus** must include Form 1; **Junior campus** must not.
5. Add a test Form 1 record, then verify the database trigger saves it with `campus = 'senior'`.
