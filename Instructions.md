# Form 1 2026 intake

1. Apply `supabase/migrations/20260903110000_student_bulk_import_fields.sql`.
2. Create Mr. Chayabanda through the Staff screen. It uses the existing secure Edge Function; SQL should not contain passwords.
3. Copy all 47 real register records into `supabase/seedFormOneStudents.sql`, then run it in Supabase SQL Editor. It refuses incomplete or invalid data.
4. Open **Enrolment** to add F1-2026-048 and F1-2026-049, or upload a CSV and confirm its preview.

Verification:

```sql
select count(*) from public.students where admission_number like 'F1-2026-%';
select count(*) from public.fee_balances where academic_year = 2026 and term = 3;
select * from public.staff_accounts where name = 'Mr. Chayabanda';
```

The supplied request contains no register JSON, so no student identities were invented. The seed script is ready to accept all 47 records. The present RLS model grants a teacher one stream; add multi-class assignments before granting Mr. Chayabanda both streams.
