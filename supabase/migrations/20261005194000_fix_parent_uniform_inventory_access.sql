-- Parent uniform shop uses inventory_products.quantity_on_hand, the canonical
-- stock column used by the school POS and inventory workspace.
drop policy if exists "Parents browse stocked uniform products" on public.inventory_products;
create policy "Parents browse stocked uniform products"
  on public.inventory_products for select to authenticated
  using (
    category = 'Uniforms'
    and active = true
    and quantity_on_hand > 0
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'parent')
  );
