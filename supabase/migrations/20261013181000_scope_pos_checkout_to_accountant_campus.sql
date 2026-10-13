create or replace function public.complete_pos_sale(p_items jsonb,p_payment_method text,p_customer_name text,p_request_id uuid,p_amount_paid numeric)
returns public.pos_sales language plpgsql security definer set search_path = public as $$
declare item record; product public.inventory_products; sale public.pos_sales; total_amount numeric(12,2):=0; v_campus text;
begin
 select campus into v_campus from public.profiles where id=auth.uid();
 if auth.uid() is null or not public.has_active_role('accountant') or v_campus not in ('junior','senior') then raise exception 'Campus accountant access required'; end if;
 if p_request_id is null or p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 200 then raise exception 'A valid checkout is required'; end if;
 if p_payment_method not in ('cash','ecocash','swipe','transfer') then raise exception 'Invalid payment method'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0)); select * into sale from public.pos_sales where request_id=p_request_id;
 if found then if sale.sold_by<>auth.uid() then raise exception 'Request belongs to another staff member'; end if; return sale; end if;
 for item in select (x->>'product_id')::uuid id,sum((x->>'quantity')::integer)::integer qty from jsonb_array_elements(p_items) x group by 1 loop
  select * into product from public.inventory_products where id=item.id and active and campus=v_campus for update;
  if not found or product.quantity_on_hand<item.qty then raise exception 'Product unavailable in your campus'; end if; total_amount:=total_amount+product.selling_price*item.qty;
 end loop;
 if p_amount_paid is null or p_amount_paid<total_amount then raise exception 'Amount paid is below the total'; end if;
 insert into public.pos_sales(customer_name,payment_method,total,sold_by,request_id,amount_paid,campus) values(nullif(trim(p_customer_name),''),p_payment_method,total_amount,auth.uid(),p_request_id,p_amount_paid,v_campus) returning * into sale;
 for item in select (x->>'product_id')::uuid id,sum((x->>'quantity')::integer)::integer qty from jsonb_array_elements(p_items) x group by 1 loop
  select * into product from public.inventory_products where id=item.id and campus=v_campus;
  update public.inventory_products set quantity_on_hand=quantity_on_hand-item.qty,updated_at=now() where id=product.id;
  insert into public.pos_sale_items(sale_id,product_id,product_name,unit_price,unit_cost,quantity,line_total) values(sale.id,product.id,product.name,product.selling_price,product.cost_price,item.qty,product.selling_price*item.qty);
 end loop; return sale;
end; $$;
