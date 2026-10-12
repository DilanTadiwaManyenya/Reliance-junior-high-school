-- Learner finance belongs to the learner's campus. Retire historical broad
-- Admin/Principal policies and reuse the campus-aware learner helpers.

-- Fee balances.
drop policy if exists "Admin principal manage fees" on public.fee_balances;
drop policy if exists "Admin principal read fees" on public.fee_balances;
drop policy if exists "Admins manage fees" on public.fee_balances;

create policy "Campus managers read learner fees" on public.fee_balances
  for select to authenticated
  using (public.can_read_student_record(student_id));

create policy "Campus admins manage learner fees" on public.fee_balances
  for all to authenticated
  using (public.can_manage_student_record(student_id))
  with check (public.can_manage_student_record(student_id));

-- Fee-payment ledger.
drop policy if exists "Admin principal manage fee payments" on public.fee_payments;
drop policy if exists "Admin principal read fee payments" on public.fee_payments;
drop policy if exists "Admins manage fee payments" on public.fee_payments;

create policy "Campus managers read learner fee payments" on public.fee_payments
  for select to authenticated
  using (public.can_read_student_record(student_id));

create policy "Campus admins manage learner fee payments" on public.fee_payments
  for all to authenticated
  using (public.can_manage_student_record(student_id))
  with check (public.can_manage_student_record(student_id));
