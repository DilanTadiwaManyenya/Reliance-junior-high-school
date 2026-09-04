select p.full_name, p.role, p.campus, sa.campus as staff_campus
from public.profiles p left join public.staff_accounts sa on sa.user_id = p.id
where p.role = 'accountant';

select p.full_name, a.class_level, a.class_stream, a.campus
from public.teacher_class_assignments a join public.profiles p on p.id = a.teacher_id
where p.full_name = 'Mr. Chayabanda'
order by a.class_stream;

select class_stream, count(*) as students
from public.students where class_level = 'Form 1'
group by class_stream order by class_stream;

select tablename, policyname, cmd
from pg_policies
where schemaname = 'public' and tablename in ('students', 'fee_balances')
order by tablename, policyname;
