-- Form 1 White: 23 learners (F1-2026-025 through F1-2026-047)
-- Mr. Chayabanda | Term 3, 2026 | $170.00 due per learner
-- Run in Supabase SQL Editor.

begin;

alter table public.students
  add column if not exists sex text check (sex in ('M', 'F')),
  add column if not exists birth_cert_no text,
  add column if not exists address text;

with source(full_name, admission_number, date_of_birth, sex, birth_cert_no, parent_phone, address) as (
  values
    ('PANASHE DUBE', 'F1-2026-025', date '2012-02-02', 'F', 'MS', '+263713705635', '2801 Nharira B2 Ex'),
    ('MAKATEREREKA GWANZURA', 'F1-2026-026', date '2012-11-25', 'F', null, '+263773952763', '5240 NBS B2 Ex'),
    ('NICKLE JEZEL', 'F1-2026-027', date '2012-12-17', 'F', null, '+263773752535', '15421 Westgate B2 Ex'),
    ('SHARON KASEKERA', 'F1-2026-028', date '2012-11-11', 'F', '82-20111114M45', '+263773297427', 'Nharira B2 Ex'),
    ('MARTHA MANYANGA', 'F1-2026-029', date '2012-10-07', 'F', null, '+263772433729', 'Nharira B2 Ex'),
    ('TENDAL MAWARIRE', 'F1-2026-030', date '2012-11-13', 'F', '115A-21055-13', '+263772323739', '5149 Nharira B2 Ex'),
    ('FAITH MUKOMBE', 'F1-2026-031', date '2012-04-04', 'F', null, '+263772501567', '1350 Nharira B2 Ex'),
    ('ANGEL MUSHANYUKI', 'F1-2026-032', date '2012-12-13', 'F', null, '+263774023762', '146 Nharira B2 Ex'),
    ('FAITH MUTORERA', 'F1-2026-033', date '2012-04-21', 'F', '43-2007421631', '+263775431718', '1863 Roaster B2 Ex'),
    ('ROVAFADZO NYAMUCHENJERA', 'F1-2026-034', date '2012-01-12', 'F', null, '+263719113520', '2045 Westgate B2 Ex'),
    ('ESTER MHANGA', 'F1-2026-035', date '2012-04-11', 'F', null, '+263714152567', '1604 Westgate B2 Ex'),
    ('SINESTER MHLANGA', 'F1-2026-036', date '2012-05-16', 'F', null, '+263712911931', '6127 Nharira B2 Ex'),
    ('JANICE MUSA', 'F1-2026-037', date '2013-01-28', 'F', null, '+263714152567', 'Nharira B2 Ex'),
    ('NDANATSEI MUSA', 'F1-2026-038', date '2012-11-05', 'F', null, '+263775152102', '2357 Nharira B2 Ex'),
    ('ANDREW DUBE', 'F1-2026-039', date '2013-01-09', 'M', null, '+263715620225', '2759 Nharira B2 Ex'),
    ('CALEB GATSI', 'F1-2026-040', date '2011-04-27', 'M', '83-255655B83', '+263783054491', '3283 Nharira B2 Ex'),
    ('FRANKLINE MAZHEKERE', 'F1-2026-041', date '2012-09-15', 'M', null, '+263774571957', '1749 Nharira B2 Ex'),
    ('NICK MAUMBE', 'F1-2026-042', date '2012-04-01', 'M', null, '+263781980666', 'Nharira B2 Ex'),
    ('KEITH MAPFUMO', 'F1-2026-043', date '2012-06-23', 'M', '43-2011924M42', '+263771611116', '4205 Nharira B2 Ex'),
    ('SAKUDZWA MUNEMO', 'F1-2026-044', date '2012-08-14', 'M', null, '+263774571957', '3518 Nharira B2 Ex'),
    ('TINEVIMBO MUPFUNA', 'F1-2026-045', date '2012-01-05', 'M', null, '+263713837933', '115 Nharira B2 Ex'),
    ('ALBERT MVURA', 'F1-2026-046', date '2012-12-06', 'M', null, '+263781480666', 'Nharira B2 Ex'),
    ('BLESSED NDLOVU', 'F1-2026-047', date '2012-12-28', 'M', null, '+263783803912', '456 Kembo Shops')
)
insert into public.students
  (full_name, admission_number, date_of_birth, sex, birth_cert_no, parent_phone, address, class_level, class_stream, campus, enrolled_year, status)
select full_name, admission_number, date_of_birth, sex, birth_cert_no, parent_phone, address,
       'Form 1', 'White', 'senior', 2026, 'active'
from source
on conflict (admission_number) do nothing;

insert into public.fee_balances (student_id, term, academic_year, total_fees, amount_paid)
select s.id, 3, 2026, 170.00, 0.00
from public.students s
where s.admission_number between 'F1-2026-025' and 'F1-2026-047'
on conflict (student_id, term, academic_year) do nothing;

select count(*) as form_one_white_students
from public.students
where class_level = 'Form 1' and class_stream = 'White'
  and admission_number between 'F1-2026-025' and 'F1-2026-047';

select count(*) as form_one_white_fee_records
from public.fee_balances fb
join public.students s on s.id = fb.student_id
where s.admission_number between 'F1-2026-025' and 'F1-2026-047'
  and fb.term = 3 and fb.academic_year = 2026;

commit;
