-- Principals oversee finance but must not approve or alter cashbook records.
create or replace function public.review_school_expense(p_expense_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Administrator approval required'; end if;
  if p_status not in ('approved','rejected') then raise exception 'Invalid review status'; end if;
  update public.school_expenses set status = p_status, approved_by = auth.uid(), approved_at = now()
    where id = p_expense_id and status = 'pending';
  if not found then raise exception 'Expense is no longer awaiting approval'; end if;
end; $$;
revoke all on function public.review_school_expense(uuid,text) from public;
grant execute on function public.review_school_expense(uuid,text) to authenticated;
