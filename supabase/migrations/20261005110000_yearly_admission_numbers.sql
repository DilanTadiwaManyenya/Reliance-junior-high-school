-- Admission numbers are a three-digit yearly sequence: 0012026, 0022026, ... 0012027.
-- Renumber all existing learners deterministically and keep account references in sync.
begin;

create temporary table admission_renumbering on commit drop as
select
  id,
  admission_number as old_number,
  lpad(row_number() over (partition by enrolled_year order by admission_number, id)::text, 3, '0') || enrolled_year::text as new_number
from public.students;

-- Use temporary values first so the unique admission-number constraint is never violated.
update public.students student
set admission_number = '__renumber__' || student.id::text
where exists (select 1 from admission_renumbering map where map.id = student.id);

do $$
begin
  if to_regclass('public.student_accounts') is not null then
    update public.student_accounts account
    set admission_number = '__renumber__' || map.id::text
    from admission_renumbering map
    where account.admission_number = map.old_number;
  end if;
  if to_regclass('public.parent_accounts') is not null then
    update public.parent_accounts account
    set child_admission_number = '__renumber__' || map.id::text
    from admission_renumbering map
    where account.child_admission_number = map.old_number;
  end if;
end $$;

update public.students student
set admission_number = map.new_number
from admission_renumbering map
where student.id = map.id;

do $$
begin
  if to_regclass('public.student_accounts') is not null then
    update public.student_accounts account
    set admission_number = map.new_number
    from admission_renumbering map
    where account.admission_number = '__renumber__' || map.id::text;
  end if;
  if to_regclass('public.parent_accounts') is not null then
    update public.parent_accounts account
    set child_admission_number = map.new_number
    from admission_renumbering map
    where account.child_admission_number = '__renumber__' || map.id::text;
  end if;
end $$;

commit;
