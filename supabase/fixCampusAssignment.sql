-- Correct campus and fee classifications. Run once in Supabase SQL Editor.
-- Junior: ECD A/B, Grade 1-7. Senior: Form 1-6.

begin;

create or replace function public.derive_student_campus()
returns trigger language plpgsql as $$
begin
  new.campus := case
    when new.class_level in ('ECD A', 'ECD B', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7') then 'junior'
    when new.class_level in ('Form 1', 'Form 2', 'Form 3', 'Form 4', 'Form 5', 'Form 6') then 'senior'
    else new.campus
  end;
  return new;
end;
$$;

drop trigger if exists trg_student_campus on public.students;
create trigger trg_student_campus
before insert or update of class_level, campus on public.students
for each row execute function public.derive_student_campus();

update public.students
set campus = 'senior'
where class_level in ('Form 1', 'Form 2') and campus is distinct from 'senior';

-- This portal stores the amount due as total_fees; balance is calculated as
-- total_fees minus amount_paid.
update public.fee_balances fb
set total_fees = case s.class_level
  when 'ECD A' then 120.00 when 'ECD B' then 120.00
  when 'Grade 1' then 120.00 when 'Grade 2' then 120.00 when 'Grade 3' then 120.00
  when 'Grade 4' then 120.00 when 'Grade 5' then 120.00 when 'Grade 6' then 120.00 when 'Grade 7' then 120.00
  when 'Form 1' then 170.00 when 'Form 2' then 170.00
  when 'Form 3' then 180.00 when 'Form 4' then 180.00
  when 'Form 5' then 210.00 when 'Form 6' then 210.00
  else fb.total_fees
end,
updated_at = timezone('utc', now())
from public.students s
where s.id = fb.student_id
  and s.class_level in ('Form 1', 'Form 2', 'Form 3', 'Form 4', 'Form 5', 'Form 6');

commit;

select class_level, class_stream, campus, count(*) as students
from public.students where class_level in ('Form 1', 'Form 2')
group by class_level, class_stream, campus order by class_level, class_stream;

select s.class_level, fb.total_fees, count(*) as fee_records
from public.fee_balances fb join public.students s on s.id = fb.student_id
where s.class_level in ('Form 1', 'Form 2')
group by s.class_level, fb.total_fees order by s.class_level, fb.total_fees;
