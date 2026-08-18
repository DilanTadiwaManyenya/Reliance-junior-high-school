-- Parent links created after a successful admission number and date-of-birth
-- match are active immediately. RLS policies remain unchanged.
alter table public.parent_student
  add column if not exists created_at timestamptz not null default now();

create or replace function public.request_parent_student_link(
  requested_admission_number text,
  requested_date_of_birth date
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  matched_student_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'parent') then
    raise exception 'Only parent accounts can request student verification';
  end if;

  select id into matched_student_id
  from public.students
  where admission_number = requested_admission_number
    and date_of_birth = requested_date_of_birth;

  if matched_student_id is null then
    return false;
  end if;

  insert into public.parent_student (parent_id, student_id, verified_at)
  values (auth.uid(), matched_student_id, now())
  on conflict (parent_id, student_id) do update set verified_at = excluded.verified_at;

  return true;
end;
$$;
