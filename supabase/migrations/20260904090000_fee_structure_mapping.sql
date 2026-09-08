-- ════════════════════════════════════════════════════════════════════
-- MIGRATION: School Fee Mapping & Auto-Derivation
-- ════════════════════════════════════════════════════════════════════
-- Official Fee Mapping:
--   ECD A - ECD B  : $120 / term (Junior)
--   Grade 1 - 7    : $120 / term (Junior)
--   Form 1 - 2     : $170 / term (Senior)
--   Form 3 - 4     : $180 / term (Senior)
--   Form 5 - 6     : $210 / term (Senior)
-- ════════════════════════════════════════════════════════════════════

-- ── 1. Create SQL Function to Get Official Fee Amount by Class Level ──
create or replace function public.get_fee_amount(p_class_level text)
returns numeric language sql immutable as $$
  select case trim(p_class_level)
    when 'ECD A'   then 120.00
    when 'ECD B'   then 120.00
    when 'Grade 1' then 120.00
    when 'Grade 2' then 120.00
    when 'Grade 3' then 120.00
    when 'Grade 4' then 120.00
    when 'Grade 5' then 120.00
    when 'Grade 6' then 120.00
    when 'Grade 7' then 120.00
    when 'Form 1'  then 170.00
    when 'Form 2'  then 170.00
    when 'Form 3'  then 180.00
    when 'Form 4'  then 180.00
    when 'Form 5'  then 210.00
    when 'Form 6'  then 210.00
    else 120.00
  end;
$$;

grant execute on function public.get_fee_amount(text) to authenticated, service_role;

-- ── 2. Update derive_student_campus() trigger (Form 1-2 are Senior) ───
create or replace function public.derive_student_campus()
returns trigger language plpgsql as $$
begin
  if new.class_level in (
    'ECD A', 'ECD B',
    'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4',
    'Grade 5', 'Grade 6', 'Grade 7'
  ) then
    new.campus := 'junior';
  else
    new.campus := 'senior';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_student_campus on public.students;
create trigger trg_student_campus
  before insert or update of class_level on public.students
  for each row execute function public.derive_student_campus();

-- ── 3. Backfill Campus on All Existing Students ───────────────────────
update public.students set class_level = class_level where true;

-- ── 4. Trigger to Auto-Set total_fees on Insert/Update if Null/Zero ──
create or replace function public.auto_set_fee_amount()
returns trigger language plpgsql as $$
declare
  v_class_level text;
begin
  if new.total_fees is null or new.total_fees = 0 then
    select class_level into v_class_level
    from public.students
    where id = new.student_id;

    if v_class_level is not null then
      new.total_fees := public.get_fee_amount(v_class_level);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_auto_set_fee_amount on public.fee_balances;
create trigger trg_auto_set_fee_amount
  before insert or update on public.fee_balances
  for each row execute function public.auto_set_fee_amount();

-- ── 5. Backfill/Update Existing Fee Balances to Match Official Rates ──
update public.fee_balances fb
set total_fees = public.get_fee_amount(s.class_level),
    updated_at = now()
from public.students s
where fb.student_id = s.id
  and (fb.total_fees is null or fb.total_fees <> public.get_fee_amount(s.class_level));
