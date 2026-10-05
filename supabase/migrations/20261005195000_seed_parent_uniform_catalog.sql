-- Starter parent-facing uniform catalogue.  School staff can amend stock,
-- price, names, or archive items from Inventory & POS at any time.
insert into public.inventory_products (name, sku, category, selling_price, quantity_on_hand, reorder_level, active)
values
  ('School blazer', 'UNI-BLAZER-001', 'Uniforms', 45.00, 24, 5, true),
  ('Short-sleeve school shirt', 'UNI-SHIRT-SS-001', 'Uniforms', 12.00, 60, 10, true),
  ('Long-sleeve school shirt', 'UNI-SHIRT-LS-001', 'Uniforms', 14.00, 40, 8, true),
  ('School jersey', 'UNI-JERSEY-001', 'Uniforms', 28.00, 30, 6, true),
  ('School trousers', 'UNI-TROUSER-001', 'Uniforms', 25.00, 36, 8, true),
  ('School skirt', 'UNI-SKIRT-001', 'Uniforms', 22.00, 36, 8, true),
  ('School tie', 'UNI-TIE-001', 'Uniforms', 8.00, 80, 12, true),
  ('School socks', 'UNI-SOCKS-001', 'Uniforms', 5.00, 100, 20, true)
on conflict (sku) do update
set name = excluded.name,
    category = excluded.category,
    selling_price = excluded.selling_price,
    active = true,
    updated_at = now();
