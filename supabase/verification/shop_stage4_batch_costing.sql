-- Run after applying 20261028140000_shop_stock_receipts.sql followed by
-- 20261028150000_shop_pos_batch_costing.sql. These checks are read-only.

select
  to_regclass('public.shop_stock_receipts') is not null as receipts_table_installed,
  to_regclass('public.shop_stock_batches') is not null as batches_table_installed,
  to_regclass('public.shop_stock_batch_allocations') is not null as allocations_table_installed,
  to_regprocedure('public.receive_shop_stock(uuid,text,text,text,jsonb)') is not null as receive_rpc_installed,
  to_regprocedure('public.complete_pos_sale(jsonb,text,text,uuid,numeric,text,uuid)') is not null as batch_checkout_rpc_installed,
  to_regprocedure('public.reverse_pos_sale(uuid,text)') is not null as batch_reversal_rpc_installed,
  to_regprocedure('public.adjust_shop_stock(uuid,integer,text)') is not null as batch_adjustment_rpc_installed,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pos_sale_items' and column_name = 'cost_total'
  ) as sale_cost_total_installed;

-- Must return zero rows. Unassigned inventory is excluded because it cannot be sold yet.
with mismatches as (
  select 'product'::text as stock_type, product.id as product_id,
    null::uuid as variant_id, product.quantity_on_hand as product_quantity,
    coalesce(sum(batch.quantity_remaining), 0)::bigint as batched_quantity
  from public.inventory_products product
  left join public.shop_stock_batches batch
    on batch.product_id = product.id and batch.variant_id is null
  where product.campus in ('junior','senior') and not product.has_variants
  group by product.id, product.quantity_on_hand
  having product.quantity_on_hand <> coalesce(sum(batch.quantity_remaining), 0)

  union all

  select 'variant', product.id, variant.id, variant.quantity_on_hand,
    coalesce(sum(batch.quantity_remaining), 0)::bigint
  from public.inventory_products product
  join public.product_variants variant on variant.product_id = product.id
  left join public.shop_stock_batches batch
    on batch.product_id = product.id and batch.variant_id = variant.id
  where product.campus in ('junior','senior') and product.has_variants
  group by product.id, variant.id, variant.quantity_on_hand
  having variant.quantity_on_hand <> coalesce(sum(batch.quantity_remaining), 0)
)
select * from mismatches order by stock_type, product_id, variant_id;

-- Must return zero rows: remaining batches must use the current product campus and currency.
select batch.id as batch_id, product.id as product_id,
  batch.campus as batch_campus, product.campus as product_campus,
  batch.currency as batch_currency, product.currency as product_currency
from public.shop_stock_batches batch
join public.inventory_products product on product.id = batch.product_id
where batch.quantity_remaining > 0
  and (batch.campus is distinct from product.campus or batch.currency is distinct from product.currency)
order by batch.id;
