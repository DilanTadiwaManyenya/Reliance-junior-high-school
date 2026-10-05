-- Keep an assignment's teacher name alongside the subject allocation so report
-- cards can display the correct signatory without exposing staff profiles.
alter table public.teacher_subject_assignments
  add column if not exists teacher_name text;

update public.teacher_subject_assignments assignment
set teacher_name = profile.full_name
from public.profiles profile
where profile.id = assignment.teacher_id
  and (assignment.teacher_name is null or assignment.teacher_name is distinct from profile.full_name);

create or replace function public.sync_subject_assignment_teacher_name()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select full_name into new.teacher_name from public.profiles where id = new.teacher_id;
  return new;
end;
$$;

drop trigger if exists set_subject_assignment_teacher_name on public.teacher_subject_assignments;
create trigger set_subject_assignment_teacher_name
before insert or update of teacher_id on public.teacher_subject_assignments
for each row execute function public.sync_subject_assignment_teacher_name();
