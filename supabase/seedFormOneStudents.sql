-- Form 1 Students Bulk Load (47 supplied records)
-- Date: 2026-09-03 | Reliance Learning Centre Portal
--
-- The register JSON was not included with this project. Paste its 47 records
-- into the VALUES block below before executing. This script deliberately has
-- no invented learner names, DOBs, certificates, addresses, or phone numbers.
-- Apply migration 20260903110000_student_bulk_import_fields.sql first.

begin;

create temporary table form_one_source (
  admission_number text primary key,
  first_name text not null,
  last_name text not null,
  date_of_birth date not null,
  sex text not null check (sex in ('M', 'F')),
  birth_cert_no text,
  parent_phone text,
  address text,
  class_stream text not null check (class_stream in ('Green', 'White'))
) on commit drop;

-- Replace this single example row with the 47 real register rows. DOBs must be ISO dates.
-- insert into form_one_source values
-- ('F1-2026-001', 'Charmain', 'Clement', '2011-04-14', 'F', '04-2018261G', '+2637XXXXXXXX', 'ADDRESS', 'Green');

-- Fail fast unless the complete, expected intake is present.
do $$
declare source_count integer;
begin
  select count(*) into source_count from form_one_source;
  if source_count <> 47 then
    raise exception 'Expected 47 Form 1 register records; received %', source_count;
  end if;
  if exists (select 1 from form_one_source where admission_number !~ '^F1-2026-0(0[1-9]|[1-3][0-9]|4[0-7])$') then
    raise exception 'Admission numbers must be F1-2026-001 through F1-2026-047';
  end if;
  if exists (select 1 from form_one_source where parent_phone is not null and parent_phone !~ '^\\+263[0-9]{9}$') then
    raise exception 'Parent phones must use +263 followed by nine digits';
  end if;
end $$;

insert into public.students
  (full_name, admission_number, date_of_birth, sex, birth_cert_no, parent_phone, address, class_level, class_stream, campus, enrolled_year, status)
select concat_ws(' ', first_name, last_name), admission_number, date_of_birth, sex, birth_cert_no, parent_phone, address,
       'Form 1', class_stream, 'senior', 2026, 'active'
from form_one_source
on conflict (admission_number) do nothing;

insert into public.fee_balances (student_id, term, academic_year, total_fees, amount_paid, updated_at)
select s.id, 3, 2026, 170.00, 0.00, timezone('utc', now())
from public.students s join form_one_source src on src.admission_number = s.admission_number
on conflict (student_id, term, academic_year) do nothing;

-- Auth users cannot be safely created in a SQL seed. Create Mr Chayabanda via
-- the Staff screen / create_staff_account edge function, then assign both
-- streams with the following statement using that user UUID.
-- update public.profiles set role = 'teacher', class_level = 'Form 1', class_stream = 'Green', campus = 'senior' where id = '<teacher-user-uuid>';
-- A teacher can hold one stream under the current RLS model. Create a separate
-- assignment mechanism before granting both Green and White access.

select count(*) as total_students from public.students where admission_number ~ '^F1-2026-0(0[1-9]|[1-3][0-9]|4[0-7])$';
select count(*) as total_fees from public.fee_balances where academic_year = 2026 and term = 3 and amount_paid = 0;
commit;
