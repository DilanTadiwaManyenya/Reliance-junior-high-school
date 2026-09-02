-- Run after the Term 3 seed. Creates Terms 1 and 2 for every current student.
insert into public.fee_balances (student_id, term, academic_year, total_fees, amount_paid, payment_date, notes)
select s.id, term_name, 2026, case when s.campus='junior' then 170 else 200 end,
  case when mod(abs(hashtext(s.id::text || term_name)),10)<5 then case when s.campus='junior' then 170 else 200 end when mod(abs(hashtext(s.id::text || term_name)),10)<8 then case when s.campus='junior' then 85 else 100 end else 0 end,
  case when mod(abs(hashtext(s.id::text || term_name)),10)<8 then (case when term_name='Term 1' then date '2026-03-01' + mod(abs(hashtext(s.id::text)),80) else date '2026-07-01' + mod(abs(hashtext(s.id::text)),28) end) else null end,
  'Seeded fee record'
from public.students s cross join (values ('Term 1'),('Term 2')) terms(term_name)
on conflict (student_id, term, academic_year) do nothing;
select count(*), academic_year as year, term from public.fee_balances group by academic_year, term order by year, term;