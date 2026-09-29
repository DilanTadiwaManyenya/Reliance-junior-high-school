-- Publish only the shop records needed by the authorised staff dashboard.
alter publication supabase_realtime add table public.inventory_products;
alter publication supabase_realtime add table public.pos_sales;
