begin;

-- Remove the original non-idempotent three-argument endpoint if an old installation retained it.
drop function if exists public.complete_pos_sale(jsonb,text,text);

create or replace function public.complete_pos_sale(p_items jsonb,p_payment_method text,p_customer_name text,p_request_id uuid,p_amount_paid numeric,p_campus text)
returns public.pos_sales language plpgsql security definer set search_path=public as $$
declare item record; product public.inventory_products; variant public.product_variants; sale public.pos_sales;
  total_amount numeric(12,2):=0; v_campus text;
begin
 v_campus:=p_campus;
 if auth.uid() is null or v_campus is null or v_campus not in ('junior','senior')
   or not coalesce(public.can_read_shop_campus(v_campus),false) then raise exception 'POS access is restricted to your assigned campus. Main Admin must choose Junior or Senior'; end if;
 if p_request_id is null or p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 200 then raise exception 'A valid checkout is required'; end if;
 if p_payment_method is null or p_payment_method not in ('cash','ecocash','swipe','transfer') then raise exception 'Invalid payment method'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
 select * into sale from public.pos_sales where request_id=p_request_id;
 if found then if sale.sold_by<>auth.uid() or sale.campus is distinct from v_campus then raise exception 'Request belongs to another staff member or campus'; end if; return sale; end if;
 if exists(select 1 from jsonb_array_elements(p_items) x where x->>'product_id' is null or x->>'quantity' is null or (x->>'quantity') !~ '^[1-9][0-9]*$') then raise exception 'Invalid cart quantity'; end if;
 for item in select (x->>'product_id')::uuid id, nullif(x->>'variant_id','')::uuid vid, sum((x->>'quantity')::integer)::integer qty
   from jsonb_array_elements(p_items) x group by 1,2 order by 1,2 loop
   select * into product from public.inventory_products where id=item.id and active and campus=v_campus for update;
   if not found then raise exception 'Product unavailable in your campus'; end if;
   if product.has_variants then
     select * into variant from public.product_variants where id=item.vid and product_id=product.id and active for update;
     if not found or variant.quantity_on_hand<item.qty then raise exception 'Size unavailable or insufficient size stock'; end if;
   elsif item.vid is not null or product.quantity_on_hand<item.qty then raise exception 'Product unavailable or insufficient stock';
   end if;
   total_amount:=total_amount+product.selling_price*item.qty;
 end loop;
 if p_amount_paid is null or p_amount_paid<total_amount or p_amount_paid::text in ('NaN','Infinity','-Infinity') then raise exception 'Amount paid is below the total'; end if;
 insert into public.pos_sales(customer_name,payment_method,total,sold_by,request_id,amount_paid,campus)
 values(nullif(trim(p_customer_name),''),p_payment_method,total_amount,auth.uid(),p_request_id,p_amount_paid,v_campus) returning * into sale;
 for item in select (x->>'product_id')::uuid id, nullif(x->>'variant_id','')::uuid vid, sum((x->>'quantity')::integer)::integer qty
   from jsonb_array_elements(p_items) x group by 1,2 order by 1,2 loop
   select * into product from public.inventory_products where id=item.id;
   if product.has_variants then
     select * into variant from public.product_variants where id=item.vid;
     update public.product_variants set quantity_on_hand=quantity_on_hand-item.qty where id=item.vid;
   else
     update public.inventory_products set quantity_on_hand=quantity_on_hand-item.qty,updated_at=now() where id=product.id;
   end if;
   insert into public.pos_sale_items(sale_id,product_id,variant_id,size_label,product_name,unit_price,unit_cost,quantity,line_total)
   values(sale.id,product.id,item.vid,case when product.has_variants then variant.size else null end,product.name,product.selling_price,product.cost_price,item.qty,product.selling_price*item.qty);
 end loop;
 return sale;
end; $$;
revoke all on function public.complete_pos_sale(jsonb,text,text,uuid,numeric,text) from public,anon;
grant execute on function public.complete_pos_sale(jsonb,text,text,uuid,numeric,text) to authenticated;

-- Compatibility entry point has no independent checkout logic or broader permissions.
create or replace function public.complete_pos_sale(p_items jsonb,p_payment_method text,p_customer_name text,p_request_id uuid,p_amount_paid numeric)
returns public.pos_sales language plpgsql security definer set search_path=public as $$
declare assigned_campus text;
begin
 select campus into assigned_campus from public.profiles where id=auth.uid();
 if assigned_campus is null or assigned_campus not in ('junior','senior') then raise exception 'Choose a campus in the updated POS before checkout'; end if;
 return public.complete_pos_sale(p_items,p_payment_method,p_customer_name,p_request_id,p_amount_paid,assigned_campus);
end; $$;
revoke all on function public.complete_pos_sale(jsonb,text,text,uuid,numeric) from public,anon;
grant execute on function public.complete_pos_sale(jsonb,text,text,uuid,numeric) to authenticated;

-- Remove broad historical admin/accountant reads, including stale live installations.
drop policy if exists "Admins read sales" on public.pos_sales;
drop policy if exists "Operational staff read sales" on public.pos_sales;
drop policy if exists "Main Admin and accountants read sales" on public.pos_sales;
drop policy if exists "Main Admin reads all sales" on public.pos_sales;
drop policy if exists "Campus accountants read sales" on public.pos_sales;
drop policy if exists "Campus POS staff read sales" on public.pos_sales;
create policy "Campus POS staff read sales" on public.pos_sales for select to authenticated
 using(public.can_read_shop_campus(campus));
drop policy if exists "Admins read sale items" on public.pos_sale_items;
drop policy if exists "Operational staff read sale items" on public.pos_sale_items;
drop policy if exists "Main Admin and accountants read sale items" on public.pos_sale_items;
drop policy if exists "Campus accountants read sale items" on public.pos_sale_items;
drop policy if exists "Campus POS staff read sale items" on public.pos_sale_items;
create policy "Campus POS staff read sale items" on public.pos_sale_items for select to authenticated
 using(exists(select 1 from public.pos_sales sale where sale.id=sale_id and public.can_read_shop_campus(sale.campus)));

-- Receipts are produced by the transactional RPC, not direct client writes.
revoke insert,update,delete on public.pos_sales,public.pos_sale_items from authenticated,anon;
grant select on public.pos_sales,public.pos_sale_items to authenticated;

notify pgrst,'reload schema';
commit;
