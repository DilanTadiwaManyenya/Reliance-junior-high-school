-- Repair the two legacy six-form values identified by the admission audit.
-- The correct established codes are f5 for Lower Six and f6 for Upper Six.
begin;

create temporary table six_form_admission_repair (
  student_id uuid primary key,
  old_number text not null,
  new_number text not null
) on commit drop;

insert into six_form_admission_repair (student_id, old_number, new_number)
select id, admission_number,
  case class_level
    when 'Lower Six' then right(enrolled_year::text, 2) || 'f500'
    when 'Upper Six' then right(enrolled_year::text, 2) || 'f600'
  end
from public.students
where campus = 'senior'
  and class_level in ('Lower Six', 'Upper Six')
  and admission_number in ('26useniorlowersix00', '26usenioruppersix00');

-- Keep every portal account reference aligned if one exists.
update public.student_accounts account
set admission_number = repair.new_number
from six_form_admission_repair repair
where account.admission_number = repair.old_number;

update public.parent_accounts account
set child_admission_number = repair.new_number
from six_form_admission_repair repair
where account.child_admission_number = repair.old_number;

update public.students learner
set admission_number = repair.new_number
from six_form_admission_repair repair
where learner.id = repair.student_id;

commit;
