# Final campus-filter verification

Run `supabase/fixCampusAssignment.sql`, then confirm Form 1 returns as `senior`:

```sql
select class_level, campus, count(*)
from public.students
where class_level in ('Form 1', 'Form 2')
group by class_level, campus;
```

Build the portal with `npm run build`. In Fees, Junior must exclude Form 1; Senior must show the 47 Form 1 learners at $170.00.
