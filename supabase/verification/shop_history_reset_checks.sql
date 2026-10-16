-- Read-only checks after the explicitly authorized shop test-history cleanup.
select (select count(*) from public.pos_sales) as pos_receipts,
       (select count(*) from public.pos_sale_items) as pos_sale_lines,
       (select count(*) from public.parent_uniform_orders) as parent_uniform_orders;
select policyname,cmd,qual,with_check from pg_policies
where schemaname='public' and tablename='inventory_products' and cmd in ('ALL','DELETE')
order by policyname;
-- Each history-blocked product listed here has a remaining order; do not remove its guard.
select p.id,p.name from public.inventory_products p
where exists(select 1 from public.pos_sale_items i where i.product_id=p.id)
   or exists(select 1 from public.parent_uniform_orders o,jsonb_array_elements(o.items) line where line->>'product_id'=p.id::text);
