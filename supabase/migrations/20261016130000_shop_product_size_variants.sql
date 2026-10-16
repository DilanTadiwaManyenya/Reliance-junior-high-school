begin;

alter table public.inventory_products add column if not exists has_variants boolean not null default false;
create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.inventory_products(id) on delete cascade,
  size text not null check (length(btrim(size)) between 1 and 40),
  sku text,
  quantity_on_hand integer not null default 0 check (quantity_on_hand >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(product_id, size)
);
create unique index if not exists product_variant_size_casefold on public.product_variants(product_id, lower(btrim(size)));
alter table public.product_variants enable row level security;
grant select,insert,update on public.product_variants to authenticated;
-- Sizes are hidden, never deleted separately from their product.
revoke delete on public.product_variants from authenticated,anon;
drop policy if exists "Catalog staff manage variants" on public.product_variants;
create policy "Catalog staff manage variants" on public.product_variants for all to authenticated
  using (exists(select 1 from public.inventory_products p where p.id=product_id and
    (public.is_main_school_admin() or (public.has_active_role('accountant') and public.accountant_can_access_campus(p.campus)))))
  with check (exists(select 1 from public.inventory_products p where p.id=product_id and
    (public.is_main_school_admin() or (public.has_active_role('accountant') and public.accountant_can_access_campus(p.campus)))));
drop policy if exists "Parents browse active sizes" on public.product_variants;
create policy "Parents browse active sizes" on public.product_variants for select to authenticated
  using (active and public.has_active_role('parent') and exists(select 1 from public.inventory_products p
    where p.id=product_id and p.active and p.category='Uniforms'));

create or replace function public.lock_catalog_variant_product()
returns trigger language plpgsql security definer set search_path=public as $$
declare p public.inventory_products;
begin
  if tg_op='UPDATE' and new.product_id<>old.product_id then raise exception 'A size cannot move to another product'; end if;
  select * into p from public.inventory_products where id=new.product_id for update;
  if not found then raise exception 'Product not found'; end if;
  if not p.has_variants and p.quantity_on_hand<>0 then
    raise exception 'Existing stock must be allocated before enabling sizes. Adjust unsized stock to zero, then add the same quantities to sizes.';
  end if;
  new.size:=btrim(new.size);
  return new;
end; $$;
create or replace function public.sync_catalog_variant_stock()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  update public.inventory_products set has_variants=true,
    quantity_on_hand=(select coalesce(sum(quantity_on_hand),0) from public.product_variants where product_id=new.product_id and active),
    updated_at=now() where id=new.product_id;
  return new;
end; $$;
create or replace function public.guard_catalog_variant_total()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if exists(select 1 from public.product_variants where product_id=new.id) then
    if not new.has_variants or new.quantity_on_hand<>(select coalesce(sum(quantity_on_hand),0) from public.product_variants where product_id=new.id and active) then
      raise exception 'Adjust stock by size for this product';
    end if;
  elsif new.has_variants then raise exception 'Add a size to enable per-size stock';
  end if;
  return new;
end; $$;
revoke all on function public.lock_catalog_variant_product(), public.sync_catalog_variant_stock(), public.guard_catalog_variant_total() from public;
drop trigger if exists lock_catalog_variant_product on public.product_variants;
create trigger lock_catalog_variant_product before insert or update on public.product_variants for each row execute function public.lock_catalog_variant_product();
drop trigger if exists sync_catalog_variant_stock on public.product_variants;
create trigger sync_catalog_variant_stock after insert or update on public.product_variants for each row execute function public.sync_catalog_variant_stock();
drop trigger if exists guard_catalog_variant_total on public.inventory_products;
create trigger guard_catalog_variant_total before insert or update on public.inventory_products for each row execute function public.guard_catalog_variant_total();

alter table public.pos_sale_items add column if not exists variant_id uuid references public.product_variants(id) on delete restrict;
alter table public.pos_sale_items add column if not exists size_label text;

-- Same campus-accountant restriction, payment inputs and request-id idempotency.
-- Only stock selection and line snapshots are extended for sizes.
create or replace function public.complete_pos_sale(p_items jsonb,p_payment_method text,p_customer_name text,p_request_id uuid,p_amount_paid numeric)
returns public.pos_sales language plpgsql security definer set search_path=public as $$
declare item record; product public.inventory_products; variant public.product_variants; sale public.pos_sales;
  total_amount numeric(12,2):=0; v_campus text;
begin
 select campus into v_campus from public.profiles where id=auth.uid();
 if auth.uid() is null or not public.has_active_role('accountant') or v_campus not in ('junior','senior') then raise exception 'Campus accountant access required'; end if;
 if p_request_id is null or p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 200 then raise exception 'A valid checkout is required'; end if;
 if p_payment_method is null or p_payment_method not in ('cash','ecocash','swipe','transfer') then raise exception 'Invalid payment method'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
 select * into sale from public.pos_sales where request_id=p_request_id;
 if found then if sale.sold_by<>auth.uid() then raise exception 'Request belongs to another staff member'; end if; return sale; end if;
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
revoke all on function public.complete_pos_sale(jsonb,text,text,uuid,numeric) from public,anon;
grant execute on function public.complete_pos_sale(jsonb,text,text,uuid,numeric) to authenticated;

-- Parent orders remain requests for school verification, with no new reservation,
-- payment or stock-deduction behavior. Snapshot the database name, price and size.
create or replace function public.snapshot_parent_catalog_items()
returns trigger language plpgsql security definer set search_path=public as $$
declare line jsonb; p public.inventory_products; v public.product_variants; qty integer;
  snapshot jsonb:='[]'; amount numeric(12,2):=0; size_name text; variant_uuid uuid;
begin
 if exists(select 1 from jsonb_array_elements(new.items) x where coalesce(x->>'quantity','') !~ '^[1-9][0-9]*$') then raise exception 'Invalid order quantity'; end if;
 for line in select jsonb_build_object('product_id',x->>'product_id','variant_id',x->>'variant_id','quantity',sum((x->>'quantity')::integer))
   from jsonb_array_elements(new.items) x group by x->>'product_id',x->>'variant_id' order by x->>'product_id',x->>'variant_id' loop
   qty:=(line->>'quantity')::integer;
   select * into p from public.inventory_products where id=(line->>'product_id')::uuid and active and category='Uniforms' for share;
   if not found then raise exception 'Uniform product unavailable'; end if;
   size_name:=null; variant_uuid:=nullif(line->>'variant_id','')::uuid;
   if p.has_variants then
     select * into v from public.product_variants where id=variant_uuid and product_id=p.id and active for share;
     if not found or v.quantity_on_hand<qty then raise exception 'Size unavailable or insufficient size stock'; end if;
     size_name:=v.size;
   elsif variant_uuid is not null or p.quantity_on_hand<qty then raise exception 'Product unavailable or insufficient stock';
   end if;
   snapshot:=snapshot || jsonb_build_array(jsonb_build_object('product_id',p.id,'variant_id',variant_uuid,'size_label',size_name,
     'name',p.name,'unit_price',p.selling_price,'quantity',qty));
   amount:=amount+p.selling_price*qty;
 end loop;
 new.items:=snapshot; new.total:=amount;
 return new;
end; $$;
revoke all on function public.snapshot_parent_catalog_items() from public;
drop trigger if exists snapshot_parent_catalog_items on public.parent_uniform_orders;
create trigger snapshot_parent_catalog_items before insert on public.parent_uniform_orders for each row execute function public.snapshot_parent_catalog_items();

commit;
