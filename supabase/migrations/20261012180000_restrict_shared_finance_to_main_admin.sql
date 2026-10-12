-- Inventory, POS and the cashbook are school-wide tables with no campus key.
-- Campus-scoped Admins must not access them; Main Admin and the established
-- accountant workflows remain available.

drop policy if exists "Operational staff read inventory" on public.inventory_products;
create policy "Main Admin and accountants read inventory" on public.inventory_products
  for select to authenticated
  using (public.is_main_school_admin() or public.has_active_role('accountant'));

drop policy if exists "Admins manage inventory" on public.inventory_products;
create policy "Main Admin manages inventory" on public.inventory_products
  for all to authenticated
  using (public.is_main_school_admin())
  with check (public.is_main_school_admin());

drop policy if exists "Operational staff read sales" on public.pos_sales;
create policy "Main Admin and accountants read sales" on public.pos_sales
  for select to authenticated
  using (public.is_main_school_admin() or public.has_active_role('accountant'));

drop policy if exists "Operational staff read sale items" on public.pos_sale_items;
create policy "Main Admin and accountants read sale items" on public.pos_sale_items
  for select to authenticated
  using (public.is_main_school_admin() or public.has_active_role('accountant'));

drop policy if exists "Shop staff read settings" on public.shop_settings;
create policy "Main Admin and accountants read shop settings" on public.shop_settings
  for select to authenticated
  using (public.is_main_school_admin() or public.has_active_role('accountant'));

drop policy if exists "Shop admin update settings" on public.shop_settings;
create policy "Main Admin updates shop settings" on public.shop_settings
  for update to authenticated
  using (public.is_main_school_admin())
  with check (public.is_main_school_admin());

drop policy if exists "Staff manage uniform orders" on public.parent_uniform_orders;
create policy "Main Admin and accountants manage uniform orders" on public.parent_uniform_orders
  for all to authenticated
  using (public.is_main_school_admin() or public.has_active_role('accountant'))
  with check (public.is_main_school_admin() or public.has_active_role('accountant'));

drop policy if exists "Finance staff read school expenses" on public.school_expenses;
create policy "Main Admin accountants and principals read school expenses" on public.school_expenses
  for select to authenticated
  using (public.is_main_school_admin() or public.has_active_role('accountant') or public.has_active_role('principal'));

drop policy if exists "Accountants submit school expenses" on public.school_expenses;
create policy "Main Admin and accountants submit school expenses" on public.school_expenses
  for insert to authenticated
  with check ((public.is_main_school_admin() or public.has_active_role('accountant')) and entered_by = auth.uid() and status = 'pending');

drop policy if exists "Management read finance audit" on public.finance_audit;
create policy "Main Admin and principals read finance audit" on public.finance_audit
  for select to authenticated
  using (public.is_main_school_admin() or public.has_active_role('principal'));

create or replace function public.adjust_shop_stock(p_product uuid, p_change integer, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
 if auth.uid() is null or not public.is_main_school_admin() then raise exception 'Main Admin access required'; end if;
 if p_change is null or p_change = 0 or nullif(trim(p_reason),'') is null then raise exception 'Enter a quantity change and reason'; end if;
 update public.inventory_products set quantity_on_hand = quantity_on_hand + p_change, updated_at = now() where id = p_product and active;
 if not found then raise exception 'Product unavailable'; end if;
 insert into public.shop_audit(action,details,actor) values ('STOCK_ADJUSTMENT',jsonb_build_object('product_id',p_product,'change',p_change,'reason',p_reason),auth.uid());
end;
$$;

create or replace function public.complete_pos_sale(p_items jsonb,p_payment_method text,p_customer_name text,p_request_id uuid,p_amount_paid numeric)
returns public.pos_sales
language plpgsql
security definer
set search_path = public
as $$
declare item record; product public.inventory_products; sale public.pos_sales; total_amount numeric(12,2) := 0;
begin
 if auth.uid() is null or not coalesce(public.is_main_school_admin() or public.has_active_role('accountant'),false) then raise exception 'Shop staff access required'; end if;
 if p_request_id is null then raise exception 'Missing checkout request ID'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
 select * into sale from public.pos_sales where request_id = p_request_id;
 if found then
   if sale.sold_by <> auth.uid() then raise exception 'Request belongs to another staff member'; end if;
   return sale;
 end if;
 if p_payment_method is null or p_payment_method not in ('cash','ecocash','swipe','transfer') then raise exception 'Invalid payment method'; end if;
 if p_items is null or jsonb_typeof(p_items) <> 'array' then raise exception 'Invalid cart'; end if;
 if jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 200 then raise exception 'Cart must contain 1 to 200 lines'; end if;
 if exists(select 1 from jsonb_array_elements(p_items) x where x->>'product_id' is null or x->>'quantity' is null or (x->>'quantity') !~ '^[1-9][0-9]*$') then raise exception 'Invalid cart quantity'; end if;
 for item in select (x->>'product_id')::uuid id,sum((x->>'quantity')::integer)::integer qty from jsonb_array_elements(p_items) x group by 1 order by 1 loop
   select * into product from public.inventory_products where id=item.id and active for update;
   if not found then raise exception 'Product unavailable'; end if;
   if product.quantity_on_hand < item.qty then raise exception 'Insufficient stock for %',product.name; end if;
   total_amount := total_amount + product.selling_price * item.qty;
 end loop;
 if p_amount_paid is null or p_amount_paid < total_amount or p_amount_paid::text in ('NaN','Infinity','-Infinity') then raise exception 'Amount paid is below the total'; end if;
 insert into public.pos_sales(customer_name,payment_method,total,sold_by,request_id,amount_paid)
 values(nullif(trim(p_customer_name),''),p_payment_method,total_amount,auth.uid(),p_request_id,p_amount_paid) returning * into sale;
 for item in select (x->>'product_id')::uuid id,sum((x->>'quantity')::integer)::integer qty from jsonb_array_elements(p_items) x group by 1 order by 1 loop
   select * into product from public.inventory_products where id=item.id;
   update public.inventory_products set quantity_on_hand=quantity_on_hand-item.qty,updated_at=now() where id=item.id;
   insert into public.pos_sale_items(sale_id,product_id,product_name,unit_price,unit_cost,quantity,line_total)
   values(sale.id,item.id,product.name,product.selling_price,product.cost_price,item.qty,product.selling_price*item.qty);
 end loop;
 return sale;
end;
$$;

create or replace function public.review_school_expense(p_expense_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_main_school_admin() then raise exception 'Main Admin approval required'; end if;
  if p_status not in ('approved','rejected') then raise exception 'Invalid review status'; end if;
  update public.school_expenses set status = p_status, approved_by = auth.uid(), approved_at = now()
    where id = p_expense_id and status = 'pending';
  if not found then raise exception 'Expense is no longer awaiting approval'; end if;
end;
$$;
