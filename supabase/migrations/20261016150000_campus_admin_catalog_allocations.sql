begin;

-- Shop-specific helpers compose existing active-role checks. Shared finance helpers stay unchanged.
create or replace function public.can_manage_shop_campus(target_campus text)
returns boolean language sql stable security definer set search_path=public as $$
 select public.is_main_school_admin() or (public.has_active_role('admin') and target_campus in ('junior','senior')
   and exists(select 1 from public.profiles where id=auth.uid() and campus=target_campus));
$$;
create or replace function public.can_read_shop_campus(target_campus text)
returns boolean language sql stable security definer set search_path=public as $$
 select public.can_manage_shop_campus(target_campus) or (public.has_active_role('accountant')
   and target_campus in ('junior','senior') and public.accountant_can_access_campus(target_campus)
   and exists(select 1 from public.profiles where id=auth.uid() and campus=target_campus));
$$;
revoke all on function public.can_manage_shop_campus(text),public.can_read_shop_campus(text) from public,anon;
grant execute on function public.can_manage_shop_campus(text),public.can_read_shop_campus(text) to authenticated;

-- Remove old permissive policies rather than adding restrictions alongside them.
drop policy if exists "Admins read inventory" on public.inventory_products;
drop policy if exists "Operational staff read inventory" on public.inventory_products;
drop policy if exists "Admins manage inventory" on public.inventory_products;
drop policy if exists "Main Admin and accountants read inventory" on public.inventory_products;
drop policy if exists "Main Admin reads all inventory" on public.inventory_products;
drop policy if exists "Campus accountants read inventory" on public.inventory_products;
drop policy if exists "Main Admin manages inventory" on public.inventory_products;
drop policy if exists "Catalog accountants manage products" on public.inventory_products;
drop policy if exists "Shop staff read campus inventory" on public.inventory_products;
create policy "Shop staff read campus inventory" on public.inventory_products for select to authenticated
 using(public.can_read_shop_campus(campus));
drop policy if exists "Campus admins manage inventory" on public.inventory_products;
create policy "Campus admins manage inventory" on public.inventory_products for all to authenticated
 using(public.can_manage_shop_campus(campus)) with check(public.can_manage_shop_campus(campus));
drop policy if exists "Parents browse stocked uniform products" on public.inventory_products;
-- Full selected-learner campus isolation is Stage 3. Unassigned items are Main Admin-only now.
create policy "Parents browse stocked uniform products" on public.inventory_products for select to authenticated
 using(public.has_active_role('parent') and category='Uniforms' and active and campus in ('junior','senior'));

drop policy if exists "Catalog staff manage variants" on public.product_variants;
create policy "Catalog staff manage variants" on public.product_variants for all to authenticated
 using(exists(select 1 from public.inventory_products p where p.id=product_id and public.can_manage_shop_campus(p.campus)))
 with check(exists(select 1 from public.inventory_products p where p.id=product_id and public.can_manage_shop_campus(p.campus)));
drop policy if exists "Shop staff read campus variants" on public.product_variants;
create policy "Shop staff read campus variants" on public.product_variants for select to authenticated
 using(exists(select 1 from public.inventory_products p where p.id=product_id and public.can_read_shop_campus(p.campus)));

-- Public image reads remain. Only authorized admins can mutate image objects.
drop policy if exists "Catalog staff upload images" on storage.objects;
create policy "Catalog staff upload images" on storage.objects for insert to authenticated
 with check(bucket_id='product-images' and split_part(name,'/',1) in ('junior','senior') and public.can_manage_shop_campus(split_part(name,'/',1)));
drop policy if exists "Catalog staff replace images" on storage.objects;
create policy "Catalog staff replace images" on storage.objects for update to authenticated
 using(bucket_id='product-images' and public.can_manage_shop_campus(split_part(name,'/',1)))
 with check(bucket_id='product-images' and split_part(name,'/',1) in ('junior','senior') and public.can_manage_shop_campus(split_part(name,'/',1)));
drop policy if exists "Catalog staff remove images" on storage.objects;
create policy "Catalog staff remove images" on storage.objects for delete to authenticated
 using(bucket_id='product-images' and public.can_manage_shop_campus(split_part(name,'/',1)));

create or replace function public.guard_shop_product_allocation()
returns trigger language plpgsql security definer set search_path=public as $$
declare image_path text;
begin
 if tg_op='INSERT' and (new.campus is null or new.campus not in ('junior','senior')) then raise exception 'Choose the product campus'; end if;
 if tg_op='UPDATE' and new.campus is distinct from old.campus then
   if old.campus is not null then raise exception 'An assigned product cannot move campuses. Create a separate campus product'; end if;
   if not public.is_main_school_admin() then raise exception 'Only Main Admin can allocate unassigned stock'; end if;
 end if;
 if new.campus is not null and position('/storage/v1/object/public/product-images/' in coalesce(new.image_url,''))>0 then
   image_path:=split_part(new.image_url,'/storage/v1/object/public/product-images/',2);
   if split_part(image_path,'/',1)<>new.campus then raise exception 'Copy the product image into the selected campus before saving'; end if;
 end if;
 return new;
end; $$;
revoke all on function public.guard_shop_product_allocation() from public;
drop trigger if exists guard_shop_product_allocation on public.inventory_products;
create trigger guard_shop_product_allocation before insert or update on public.inventory_products
 for each row execute function public.guard_shop_product_allocation();

-- Partial allocation is atomic. No quantity is inferred or duplicated.
create or replace function public.split_unassigned_shop_product(p_product uuid,p_campus text,p_quantity integer,p_details jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare source public.inventory_products; allocated_id uuid:=gen_random_uuid(); allocated_sku text;
begin
 if not public.is_main_school_admin() then raise exception 'Only Main Admin can split unassigned stock'; end if;
 if p_campus is null or p_campus not in ('junior','senior') then raise exception 'Choose Junior or Senior'; end if;
 select * into source from public.inventory_products where id=p_product for update;
 if not found or source.campus is not null then raise exception 'This product is no longer unassigned'; end if;
 if source.has_variants then raise exception 'Allocate sized stock as a whole product'; end if;
 if p_quantity is null or p_quantity<=0 or p_quantity>=source.quantity_on_hand then raise exception 'Split quantity must be positive and smaller than unassigned stock'; end if;
 if nullif(btrim(p_details->>'name'),'') is null then raise exception 'Enter a product name'; end if;
 allocated_sku:=nullif(btrim(p_details->>'sku'),'');
 if allocated_sku=source.sku then allocated_sku:=allocated_sku||'-'||p_campus||'-'||left(allocated_id::text,8); end if;
 update public.inventory_products set quantity_on_hand=quantity_on_hand-p_quantity,updated_at=now() where id=source.id;
 insert into public.inventory_products(id,name,sku,category,campus,selling_price,cost_price,quantity_on_hand,reorder_level,active,image_url,created_by)
 values(allocated_id,btrim(p_details->>'name'),allocated_sku,p_details->>'category',p_campus,
   (p_details->>'selling_price')::numeric,(p_details->>'cost_price')::numeric,p_quantity,
   (p_details->>'reorder_level')::integer,coalesce((p_details->>'active')::boolean,true),p_details->>'image_url',auth.uid());
 return allocated_id;
end; $$;
revoke all on function public.split_unassigned_shop_product(uuid,text,integer,jsonb) from public,anon;
grant execute on function public.split_unassigned_shop_product(uuid,text,integer,jsonb) to authenticated;

create or replace function public.adjust_shop_stock(p_product uuid,p_change integer,p_reason text)
returns void language plpgsql security definer set search_path=public as $$
declare product public.inventory_products;
begin
 select * into product from public.inventory_products where id=p_product for update;
 if not found or not product.active or not coalesce(public.can_manage_shop_campus(product.campus),false) then raise exception 'Campus administrator access required'; end if;
 if p_change is null or p_change=0 or nullif(btrim(p_reason),'') is null then raise exception 'Enter a quantity change and reason'; end if;
 if product.has_variants then raise exception 'Adjust stock by size for this product'; end if;
 update public.inventory_products set quantity_on_hand=quantity_on_hand+p_change,updated_at=now() where id=p_product;
 insert into public.shop_audit(action,details,actor) values('STOCK_ADJUSTMENT',jsonb_build_object('product_id',p_product,'campus',product.campus,'change',p_change,'reason',p_reason),auth.uid());
end; $$;
revoke all on function public.adjust_shop_stock(uuid,integer,text) from public,anon;
grant execute on function public.adjust_shop_stock(uuid,integer,text) to authenticated;

-- Reject stale new orders for unassigned items; preserve all previous orders.
create or replace function public.require_assigned_order_products()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if exists(select 1 from jsonb_array_elements(new.items) line join public.inventory_products p
   on p.id=(line->>'product_id')::uuid where p.campus is null) then raise exception 'This uniform needs Main Admin campus allocation before ordering'; end if;
 return new;
end; $$;
revoke all on function public.require_assigned_order_products() from public;
drop trigger if exists a_require_assigned_order_products on public.parent_uniform_orders;
create trigger a_require_assigned_order_products before insert on public.parent_uniform_orders for each row execute function public.require_assigned_order_products();

notify pgrst,'reload schema';
commit;
