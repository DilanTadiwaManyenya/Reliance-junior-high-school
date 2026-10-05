-- Give finance staff read-only access to the learner records required by the
-- learner profile, scoped to the accountant's assigned campus.
drop policy if exists "Accountants select academic profile" on public.academic_records;
create policy "Accountants select academic profile" on public.academic_records for select to authenticated using (
  exists (select 1 from public.students s where s.id = academic_records.student_id and public.accountant_can_access_campus(s.campus))
);
drop policy if exists "Accountants select attendance profile" on public.attendance;
create policy "Accountants select attendance profile" on public.attendance for select to authenticated using (
  exists (select 1 from public.students s where s.id = attendance.student_id and public.accountant_can_access_campus(s.campus))
);
drop policy if exists "Accountants select behaviour profile" on public.behavior_notes;
create policy "Accountants select behaviour profile" on public.behavior_notes for select to authenticated using (
  exists (select 1 from public.students s where s.id = behavior_notes.student_id and public.accountant_can_access_campus(s.campus))
);
drop policy if exists "Accountants select sport profile" on public.sports_records;
create policy "Accountants select sport profile" on public.sports_records for select to authenticated using (
  exists (select 1 from public.students s where s.id = sports_records.student_id and public.accountant_can_access_campus(s.campus))
);
drop policy if exists "Accountants select awards profile" on public.student_awards;
create policy "Accountants select awards profile" on public.student_awards for select to authenticated using (
  exists (select 1 from public.students s where s.id = student_awards.student_id and public.accountant_can_access_campus(s.campus))
);

create table if not exists public.fee_payments (
  id uuid primary key default gen_random_uuid(),
  fee_balance_id uuid references public.fee_balances(id) on delete set null,
  student_id uuid not null references public.students(id) on delete cascade,
  term text not null,
  academic_year integer not null,
  amount numeric(12,2) not null check (amount > 0),
  paid_on date not null default current_date,
  payment_method text not null default 'recorded' check (payment_method in ('cash', 'ecocash', 'swipe', 'transfer', 'bank_deposit', 'recorded')),
  payment_plan text not null default 'once_off' check (payment_plan in ('once_off', 'instalment')),
  reference_number text,
  notes text,
  received_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists fee_payments_student_period_idx on public.fee_payments(student_id, academic_year desc, term, paid_on desc);
alter table public.fee_payments enable row level security;

drop policy if exists "Admin principal manage fee payments" on public.fee_payments;
create policy "Admin principal manage fee payments" on public.fee_payments for all to authenticated using (public.is_admin_or_principal()) with check (public.is_admin_or_principal());
drop policy if exists "Accountants manage fee payments in campus" on public.fee_payments;
create policy "Accountants manage fee payments in campus" on public.fee_payments for all to authenticated using (
  exists (select 1 from public.students s where s.id = fee_payments.student_id and public.accountant_can_access_campus(s.campus))
) with check (
  exists (select 1 from public.students s where s.id = fee_payments.student_id and public.accountant_can_access_campus(s.campus))
);

-- Preserve the best available history for balances recorded before the ledger.
insert into public.fee_payments (fee_balance_id, student_id, term, academic_year, amount, paid_on, payment_method, payment_plan, notes, received_by)
select fb.id, fb.student_id, fb.term, fb.academic_year, fb.amount_paid, coalesce(fb.payment_date, fb.updated_at::date, current_date), 'recorded', case when fb.amount_paid < fb.total_fees then 'instalment' else 'once_off' end, fb.notes, fb.updated_by
from public.fee_balances fb
where fb.amount_paid > 0
  and not exists (select 1 from public.fee_payments fp where fp.fee_balance_id = fb.id);
