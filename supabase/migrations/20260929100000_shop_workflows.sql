-- Reconcile the earlier admin-only shop installation using Reliance active roles.
drop policy if exists "Operational staff read inventory" on public.inventory_products;
create policy "Operational staff read inventory" on public.inventory_products for select to authenticated using (public.is_admin() or public.has_active_role('accountant'));
drop policy if exists "Operational staff read sales" on public.pos_sales;
create policy "Operational staff read sales" on public.pos_sales for select to authenticated using (public.is_admin() or public.has_active_role('accountant'));
drop policy if exists "Operational staff read sale items" on public.pos_sale_items;
create policy "Operational staff read sale items" on public.pos_sale_items for select to authenticated using (public.is_admin() or public.has_active_role('accountant'));
grant select on public.inventory_products, public.pos_sales, public.pos_sale_items to authenticated;
grant insert,update on public.inventory_products to authenticated;
-- Reliance shop: transactional checkout, cost snapshots, stock audit and preferences.
alter table public.inventory_products add column if not exists cost_price numeric(12,2) not null default 0 check (cost_price >= 0);
alter table public.pos_sales add column if not exists request_id uuid;
create unique index if not exists pos_sales_request_id on public.pos_sales(request_id);
alter table public.pos_sales add column if not exists amount_paid numeric(12,2);
alter table public.pos_sale_items add column if not exists unit_cost numeric(12,2);
create table public.shop_settings (
 id boolean primary key default true check (id), store_name text not null default 'Reliance Learning Centre',
 receipt_header text not null default 'School shop', updated_at timestamptz not null default now()
);
insert into public.shop_settings(id) values(true);
alter table public.shop_settings enable row level security;
create policy "Shop staff read settings" on public.shop_settings for select to authenticated using (public.is_admin() or public.has_active_role('accountant'));
create policy "Shop admin update settings" on public.shop_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());
create table public.shop_audit (
 id bigint generated always as identity primary key, action text not null, details jsonb not null,
 actor uuid references public.profiles(id), created_at timestamptz not null default now()
);
alter table public.shop_audit enable row level security;
create policy "Shop administrators read audit" on public.shop_audit for select to authenticated using (public.is_admin());
create function public.audit_shop_change() returns trigger language plpgsql security definer set search_path = public as $$
begin
 insert into public.shop_audit(action,details,actor) values (tg_table_name || ':' || tg_op, jsonb_build_object('before',case when tg_op = 'INSERT' then null else to_jsonb(old) end,'after',to_jsonb(new)),auth.uid());
 return new;
end; $$;
create trigger inventory_audit after insert or update on public.inventory_products for each row execute function public.audit_shop_change();
create trigger sale_audit after insert on public.pos_sales for each row execute function public.audit_shop_change();
create trigger settings_audit after update on public.shop_settings for each row execute function public.audit_shop_change();
create function public.adjust_shop_stock(p_product uuid, p_change integer, p_reason text) returns void language plpgsql security definer set search_path = public as $$
begin
 if auth.uid() is null or not coalesce(public.is_admin(),false) then raise exception 'Administrator access required'; end if;
 if p_change is null or p_change = 0 or nullif(trim(p_reason),'') is null then raise exception 'Enter a quantity change and reason'; end if;
 update public.inventory_products set quantity_on_hand = quantity_on_hand + p_change, updated_at = now() where id = p_product and active;
 if not found then raise exception 'Product unavailable'; end if;
 insert into public.shop_audit(action,details,actor) values ('STOCK_ADJUSTMENT',jsonb_build_object('product_id',p_product,'change',p_change,'reason',p_reason),auth.uid());
end; $$;
-- Retire the old non-idempotent entry point; clients must use a request UUID.
drop function public.complete_pos_sale(jsonb,text,text);
create function public.complete_pos_sale(p_items jsonb,p_payment_method text,p_customer_name text,p_request_id uuid,p_amount_paid numeric)
returns public.pos_sales language plpgsql security definer set search_path = public as $$
declare item record; product public.inventory_products; sale public.pos_sales; total_amount numeric(12,2) := 0;
begin
 if auth.uid() is null or not coalesce(public.is_admin() or public.has_active_role('accountant'),false) then raise exception 'Shop staff access required'; end if;
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
 -- Aggregate duplicates and lock in UUID order to prevent overselling and deadlocks.
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
end; $$;
revoke all on function public.audit_shop_change() from public;
revoke all on function public.adjust_shop_stock(uuid,integer,text) from public;
revoke all on function public.complete_pos_sale(jsonb,text,text,uuid,numeric) from public;
grant execute on function public.adjust_shop_stock(uuid,integer,text) to authenticated;
grant execute on function public.complete_pos_sale(jsonb,text,text,uuid,numeric) to authenticated;
grant select on public.shop_audit to authenticated;
grant select,update on public.shop_settings to authenticated;
