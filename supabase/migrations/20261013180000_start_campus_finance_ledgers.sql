-- Existing shared finance records remain legacy Main Admin history. New
-- campus finance data is explicitly labelled before it can be shared.
alter table public.school_expenses add column if not exists campus text check (campus in ('junior','senior'));
alter table public.inventory_products add column if not exists campus text check (campus in ('junior','senior'));
alter table public.pos_sales add column if not exists campus text check (campus in ('junior','senior'));

drop policy if exists "Main Admin accountants and principals read school expenses" on public.school_expenses;
create policy "Main Admin reads all expenses" on public.school_expenses for select to authenticated using (public.is_main_school_admin());
create policy "Campus accountants read expenses" on public.school_expenses for select to authenticated using (public.has_active_role('accountant') and public.accountant_can_access_campus(campus));
drop policy if exists "Main Admin and accountants submit school expenses" on public.school_expenses;
create policy "Campus accountants submit expenses" on public.school_expenses for insert to authenticated with check (entered_by=auth.uid() and public.has_active_role('accountant') and public.accountant_can_access_campus(campus));
create policy "Main Admin submits expenses" on public.school_expenses for insert to authenticated with check (public.is_main_school_admin() and entered_by=auth.uid());

drop policy if exists "Main Admin and accountants read inventory" on public.inventory_products;
create policy "Main Admin reads all inventory" on public.inventory_products for select to authenticated using (public.is_main_school_admin());
create policy "Campus accountants read inventory" on public.inventory_products for select to authenticated using (public.has_active_role('accountant') and public.accountant_can_access_campus(campus));
drop policy if exists "Main Admin and accountants read sales" on public.pos_sales;
create policy "Main Admin reads all sales" on public.pos_sales for select to authenticated using (public.is_main_school_admin());
create policy "Campus accountants read sales" on public.pos_sales for select to authenticated using (public.has_active_role('accountant') and public.accountant_can_access_campus(campus));
drop policy if exists "Main Admin and accountants read sale items" on public.pos_sale_items;
create policy "Campus accountants read sale items" on public.pos_sale_items for select to authenticated using (public.is_main_school_admin() or exists (select 1 from public.pos_sales sale where sale.id=pos_sale_items.sale_id and public.has_active_role('accountant') and public.accountant_can_access_campus(sale.campus)));
