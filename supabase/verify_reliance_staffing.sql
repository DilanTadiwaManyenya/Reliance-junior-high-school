-- Run after seed_reliance_staffing.  Expected rows include Chayabanda: Form 1
-- Green/White; Kufamuni: Mathematics F1, Combined Science F3, Chemistry F5.
select p.full_name, a.class_level, a.class_stream
from public.teacher_class_assignments a join public.profiles p on p.id = a.teacher_id
where p.full_name in ('Mr Chayabanda', 'Mr Munyembe', 'Mr Kufamuni')
order by p.full_name, a.class_level, a.class_stream;

select p.full_name, a.subject, a.form_level
from public.teacher_subject_assignments a join public.profiles p on p.id = a.teacher_id
where p.full_name = 'Mr Kufamuni'
order by a.form_level, a.subject;

-- No results should be returned until the spelling/identity is confirmed.
select full_name from public.profiles where full_name ilike '%Ngwar%';
