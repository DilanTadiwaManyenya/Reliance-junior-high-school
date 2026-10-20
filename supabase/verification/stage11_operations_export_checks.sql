-- Safe to run manually in Supabase SQL Editor. No business rows are returned.
begin read only;
select c.relname table_name,c.relrowsecurity rls_enabled,
 (select count(*) from pg_policy p where p.polrelid=c.oid) policies
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('fee_balances','fee_payments','school_expenses','inventory_products','product_variants','pos_sales','pos_sale_items','parent_uniform_orders')
order by c.relname;
select table_name,column_name from information_schema.columns
where table_schema='public' and (
 (table_name='pos_sale_items' and column_name in ('product_name','unit_price','unit_cost','size_label','line_total')) or
 (table_name='parent_uniform_orders' and column_name='items') or
 (table_name='fee_payments' and column_name in ('amount','paid_on','reference_number','payment_plan'))
) order by table_name,column_name;
select conrelid::regclass source_table,confrelid::regclass related_table,conname
from pg_constraint where contype='f' and connamespace='public'::regnamespace
and conrelid in ('public.fee_balances'::regclass,'public.fee_payments'::regclass,'public.parent_uniform_orders'::regclass,'public.product_variants'::regclass,'public.pos_sale_items'::regclass)
and confrelid in ('public.students'::regclass,'public.inventory_products'::regclass,'public.pos_sales'::regclass);
rollback;
