begin;

-- Existing products need no changes or backfilled images.
alter table public.inventory_products add column if not exists image_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Use the established Main Admin and campus accountant helpers.
-- Paths are junior/<unique-file> or senior/<unique-file>.
drop policy if exists "Public catalog image reads" on storage.objects;
create policy "Public catalog image reads" on storage.objects for select to public
  using (bucket_id = 'product-images');
drop policy if exists "Catalog staff upload images" on storage.objects;
create policy "Catalog staff upload images" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and split_part(name, '/', 1) in ('junior','senior') and
    (public.is_main_school_admin() or (public.has_active_role('accountant') and public.accountant_can_access_campus(split_part(name, '/', 1)))));
drop policy if exists "Catalog staff replace images" on storage.objects;
create policy "Catalog staff replace images" on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and (public.is_main_school_admin() or (public.has_active_role('accountant') and public.accountant_can_access_campus(split_part(name, '/', 1)))))
  with check (bucket_id = 'product-images' and split_part(name, '/', 1) in ('junior','senior') and
    (public.is_main_school_admin() or (public.has_active_role('accountant') and public.accountant_can_access_campus(split_part(name, '/', 1)))));
drop policy if exists "Catalog staff remove images" on storage.objects;
create policy "Catalog staff remove images" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and (public.is_main_school_admin() or (public.has_active_role('accountant') and public.accountant_can_access_campus(split_part(name, '/', 1)))));

-- Keep school-wide Main Admin access. Add campus-scoped accountant catalog management.
drop policy if exists "Catalog accountants manage products" on public.inventory_products;
create policy "Catalog accountants manage products" on public.inventory_products for all to authenticated
  using (public.has_active_role('accountant') and public.accountant_can_access_campus(campus))
  with check (public.has_active_role('accountant') and public.accountant_can_access_campus(campus));
grant select, insert, update, delete on public.inventory_products to authenticated;

-- Show out-of-stock items as unavailable rather than silently omitting them.
drop policy if exists "Parents browse stocked uniform products" on public.inventory_products;
create policy "Parents browse stocked uniform products" on public.inventory_products for select to authenticated
  using (category = 'Uniforms' and active and public.has_active_role('parent'));

-- JSON parent orders have no product foreign key. Protect them as well as POS history.
create or replace function public.protect_ordered_catalog_product()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Serialize against concurrent parent order inserts before checking history.
  lock table public.parent_uniform_orders in share row exclusive mode;
  if exists (select 1 from public.parent_uniform_orders o, jsonb_array_elements(o.items) line
             where line->>'product_id' = old.id::text)
     or exists (select 1 from public.pos_sale_items where product_id = old.id) then
    raise exception 'This product has order history. Hide it instead of deleting it.';
  end if;
  return old;
end;
$$;
revoke all on function public.protect_ordered_catalog_product() from public;
drop trigger if exists protect_ordered_catalog_product on public.inventory_products;
create trigger protect_ordered_catalog_product before delete on public.inventory_products
  for each row execute function public.protect_ordered_catalog_product();

commit;
