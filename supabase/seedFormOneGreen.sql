-- Form 1 Green: 24 learners (F1-2026-001 through F1-2026-024)
-- Mr. Chayabanda | Term 3, 2026 | $170.00 due per learner
-- Run in Supabase SQL Editor.

begin;

alter table public.students
  add column if not exists sex text check (sex in ('M', 'F')),
  add column if not exists birth_cert_no text,
  add column if not exists address text;

with source(full_name, admission_number, date_of_birth, sex, birth_cert_no, parent_phone, address) as (
  values
    ('Charmain Clement', 'F1-2026-001', date '2011-04-14', 'F', '04-2018261G', '+263775418637', '14073 Westgate'),
    ('Nyamasha Cheanda', 'F1-2026-002', date '2012-03-18', 'F', null, '+263718504104', '182 Glaudina Phase 2'),
    ('Monica Mutsaidzwa', 'F1-2026-003', date '2012-01-22', 'F', '02108-12', '+263713374431', 'Bulawayo, Ex-Nharira'),
    ('Tanyaradzwa Mafa', 'F1-2026-004', date '2012-04-07', 'F', '83-23293245B', '+263774571957', 'Block B2 Ex-Nharira'),
    ('Tiffany Matzhandu', 'F1-2026-005', date '2012-09-20', 'F', null, '+263778006757', 'Block A2 Ex-Nharira'),
    ('Kelly Mavhura', 'F1-2026-006', date '2013-01-01', 'F', '2620228741H', '+263772274218', 'Block D2 Ex-Phase 2'),
    ('Pride Ndlovu', 'F1-2026-007', date '2012-11-11', 'F', '63-2838307A', '+263771424112', 'Block C2 Ex-Phase 2'),
    ('Blinder Nyamukusa', 'F1-2026-008', date '2012-11-25', 'F', null, '+263713214412', 'Block B2 Ex-Nharira'),
    ('Faith Ndlovu', 'F1-2026-009', date '2012-09-03', 'F', null, '+263773919108', 'Block A2 Ex-Nharira'),
    ('Pretty Dube', 'F1-2026-010', date '2012-10-06', 'F', null, '+263775162108', 'Block B2 Ex-Nharira'),
    ('Nichole Busawo', 'F1-2026-011', date '2012-09-12', 'F', '81-20860A', '+263712952200', 'Block A2 Ex-Nharira'),
    ('Thengbinkosi Tsakado', 'F1-2026-012', date '2012-01-21', 'M', null, '+263772291244', 'Block B2 Ex-Nharira'),
    ('Trinity Zudazo', 'F1-2026-013', date '2012-01-11', 'F', null, '+263715173200', 'Block A2 Ex-Nharira'),
    ('Shayne Chimanai', 'F1-2026-014', date '2011-12-02', 'M', '63-296215B22', '+263772716805', 'Block B2 Ex-Kembo'),
    ('Tanatswa Chirokosa', 'F1-2026-015', date '2012-11-30', 'F', null, '+263773012111', '1244 Block B2 Ex-Kembo'),
    ('Antony Dehwe', 'F1-2026-016', date '2012-04-25', 'M', '0168214', '+263718024600', '2545 Block B2 Ex-Nharira'),
    ('Wesley Kaitano', 'F1-2026-017', date '2012-09-22', 'M', null, '+263713214041', 'Block A1 Ex-Nharira'),
    ('Chrispen Midzwanwa', 'F1-2026-018', date '2011-07-24', 'M', null, '+263774021113', '2917 Block A2 Ex-Nharira'),
    ('Keith Midzwanwa', 'F1-2026-019', date '2012-02-17', 'M', null, '+263774021113', '2917 Block A2 Ex-Nharira'),
    ('Trymore Matinganzara', 'F1-2026-020', date '2012-09-16', 'M', null, '+263771611116', 'Block A2 Ex-Nharira'),
    ('Vandal Ndlovu', 'F1-2026-021', date '2012-01-06', 'M', null, '+263772121173', 'Block A2 Ex-Nharira'),
    ('Natsai Ndlovu', 'F1-2026-022', date '2011-11-12', 'F', '08213-19', '+263773541112', '40 Norton Ext'),
    ('Schorisco Ndlovu', 'F1-2026-023', date '2011-12-28', 'M', '1396A18', '+263713154112', 'Norton Ext'),
    ('Russell Mavo', 'F1-2026-024', date '2011-12-30', 'M', null, '+263783132560', 'Nharira Ex')
)
insert into public.students
  (full_name, admission_number, date_of_birth, sex, birth_cert_no, parent_phone, address, class_level, class_stream, campus, enrolled_year, status)
select full_name, admission_number, date_of_birth, sex, birth_cert_no, parent_phone, address,
       'Form 1', 'Green', 'senior', 2026, 'active'
from source
on conflict (admission_number) do nothing;

insert into public.fee_balances (student_id, term, academic_year, total_fees, amount_paid)
select s.id, 3, 2026, 170.00, 0.00
from public.students s
where s.admission_number between 'F1-2026-001' and 'F1-2026-024'
on conflict (student_id, term, academic_year) do nothing;

select count(*) as form_one_green_students
from public.students
where class_level = 'Form 1' and class_stream = 'Green'
  and admission_number between 'F1-2026-001' and 'F1-2026-024';

select count(*) as form_one_green_fee_records
from public.fee_balances fb
join public.students s on s.id = fb.student_id
where s.admission_number between 'F1-2026-001' and 'F1-2026-024'
  and fb.term = 3 and fb.academic_year = 2026;

commit;
