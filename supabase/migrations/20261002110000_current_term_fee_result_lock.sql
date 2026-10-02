-- Term 3 2026 is the active billing period. Historical balances are settled
-- so they cannot prevent access to a current report.
update public.fee_balances
set amount_paid = total_fees,
    updated_at = now()
where academic_year < 2026
   or (
     academic_year = 2026
     and lower(trim(term)) in ('1', 'term 1', '2', 'term 2')
   );

-- Results stay private while the learner's active Term 3 fee is outstanding.
-- Staff retain access so they can administer results and payments.
drop policy if exists block_academics_if_fees_owing on public.academic_records;
drop policy if exists block_academics_if_current_term_fee_owing on public.academic_records;
create policy block_academics_if_current_term_fee_owing
  on public.academic_records
  as restrictive
  for select to authenticated
  using (
    public.is_staff_or_admin()
    or not exists (
      select 1
      from public.fee_balances fb
      where fb.student_id = academic_records.student_id
        and fb.academic_year = 2026
        and lower(trim(fb.term)) in ('3', 'term 3')
        and fb.total_fees > fb.amount_paid
        -- Earlier releases stored the same current term as "3". When the
        -- current fee screen has created its canonical "Term 3" record, that
        -- record is the one that determines whether results are released.
        and not (
          lower(trim(fb.term)) = '3'
          and exists (
            select 1
            from public.fee_balances canonical
            where canonical.student_id = fb.student_id
              and canonical.academic_year = fb.academic_year
              and lower(trim(canonical.term)) = 'term 3'
          )
        )
    )
  );
