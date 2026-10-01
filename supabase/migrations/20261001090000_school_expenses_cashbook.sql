-- School cashbook. Accountants can submit expenses; only management can approve them.
create table if not exists public.school_expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null default current_date,
  category text not null check (length(trim(category)) > 0),
  supplier text,
  description text not null check (length(trim(description)) > 0),
  amount numeric(12,2) not null check (amount > 0),
  payment_method text not null check (payment_method in ('cash','ecocash','swipe','transfer')),
  receipt_reference text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  entered_by uuid not null references public.profiles(id),
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.school_expenses enable row level security;
create policy "Finance staff read school expenses" on public.school_expenses for select to authenticated
  using (public.is_admin() or public.has_active_role('accountant') or public.has_active_role('principal'));
create policy "Accountants submit school expenses" on public.school_expenses for insert to authenticated
  with check ((public.is_admin() or public.has_active_role('accountant')) and entered_by = auth.uid() and status = 'pending');

create table if not exists public.finance_audit (
  id bigint generated always as identity primary key,
  action text not null,
  expense_id uuid references public.school_expenses(id),
  details jsonb not null default '{}'::jsonb,
  actor uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
alter table public.finance_audit enable row level security;
create policy "Management read finance audit" on public.finance_audit for select to authenticated
  using (public.is_admin() or public.has_active_role('principal'));

create or replace function public.audit_school_expense() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.finance_audit(action, expense_id, details, actor)
  values ('EXPENSE_' || tg_op, new.id, jsonb_build_object('before', case when tg_op = 'INSERT' then null else to_jsonb(old) end, 'after', to_jsonb(new)), auth.uid());
  return new;
end; $$;
drop trigger if exists school_expense_audit on public.school_expenses;
create trigger school_expense_audit after insert or update on public.school_expenses for each row execute function public.audit_school_expense();

create or replace function public.review_school_expense(p_expense_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_admin() or public.has_active_role('principal')) then raise exception 'Management approval required'; end if;
  if p_status not in ('approved','rejected') then raise exception 'Invalid review status'; end if;
  update public.school_expenses set status = p_status, approved_by = auth.uid(), approved_at = now()
    where id = p_expense_id and status = 'pending';
  if not found then raise exception 'Expense is no longer awaiting approval'; end if;
end; $$;
revoke all on function public.audit_school_expense() from public;
revoke all on function public.review_school_expense(uuid,text) from public;
grant execute on function public.review_school_expense(uuid,text) to authenticated;
grant select on public.school_expenses, public.finance_audit to authenticated;
grant insert on public.school_expenses to authenticated;
