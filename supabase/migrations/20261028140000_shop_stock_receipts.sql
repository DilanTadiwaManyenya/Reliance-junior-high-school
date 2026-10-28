-- Stage 2: retain each supplier delivery as a separately costed stock batch.
-- Receipt creation is serialized, idempotent, and restricted to the verified Main Admin.
begin;

create table if not exists public.shop_stock_receipts (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  supplier_name text not null check (length(btrim(supplier_name)) between 1 and 200),
  supplier_reference text check (supplier_reference is null or length(btrim(supplier_reference)) <= 120),
  notes text check (notes is null or length(btrim(notes)) <= 1000),
  received_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.shop_stock_batches (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.shop_stock_receipts(id) on delete restrict,
  product_id uuid not null references public.inventory_products(id) on delete restrict,
  variant_id uuid references public.product_variants(id) on delete restrict,
  campus text not null check (campus in ('junior', 'senior')),
  currency text not null check (currency in ('USD', 'ZWG')),
  quantity_received integer not null check (quantity_received > 0),
  quantity_remaining integer not null check (quantity_remaining >= 0 and quantity_remaining <= quantity_received),
  unit_cost numeric(12,2) not null check (unit_cost >= 0),
  received_at timestamptz not null default now(),
  constraint shop_stock_batches_cost_finite check (unit_cost::text not in ('NaN', 'Infinity', '-Infinity'))
);

create index if not exists shop_stock_batches_fifo_idx
  on public.shop_stock_batches (product_id, variant_id, received_at, id)
  where quantity_remaining > 0;
create index if not exists shop_stock_batches_receipt_idx
  on public.shop_stock_batches (receipt_id, id);
create index if not exists shop_stock_receipts_created_idx
  on public.shop_stock_receipts (created_at desc, id);

alter table public.shop_stock_receipts enable row level security;
alter table public.shop_stock_batches enable row level security;
revoke all on public.shop_stock_receipts, public.shop_stock_batches from public, anon, authenticated;
grant select on public.shop_stock_receipts, public.shop_stock_batches to authenticated;

drop policy if exists "Shop staff read scoped stock receipts" on public.shop_stock_receipts;
create policy "Shop staff read scoped stock receipts" on public.shop_stock_receipts
  for select to authenticated
  using (
    public.is_main_school_admin()
    or exists (
      select 1 from public.shop_stock_batches batch
      where batch.receipt_id = shop_stock_receipts.id
        and public.can_read_shop_campus(batch.campus)
    )
  );

drop policy if exists "Shop staff read scoped stock batches" on public.shop_stock_batches;
create policy "Shop staff read scoped stock batches" on public.shop_stock_batches
  for select to authenticated
  using (public.is_main_school_admin() or public.can_read_shop_campus(campus));

drop policy if exists "Admin sessions require MFA" on public.shop_stock_receipts;
create policy "Admin sessions require MFA" on public.shop_stock_receipts as restrictive
  for all to authenticated
  using (public.portal_mfa_satisfied())
  with check (public.portal_mfa_satisfied());

drop policy if exists "Admin sessions require MFA" on public.shop_stock_batches;
create policy "Admin sessions require MFA" on public.shop_stock_batches as restrictive
  for all to authenticated
  using (public.portal_mfa_satisfied())
  with check (public.portal_mfa_satisfied());

create or replace function public.receive_shop_stock(
  p_request_id uuid,
  p_supplier_name text,
  p_supplier_reference text,
  p_notes text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  receipt_id uuid;
  prior_receipt public.shop_stock_receipts;
  item record;
  product public.inventory_products;
  variant public.product_variants;
  line_details jsonb := '[]'::jsonb;
begin
  if auth.uid() is null or not coalesce(public.is_main_school_admin(), false) then
    raise exception 'Only the Main Admin can receive supplier stock' using errcode = '42501';
  end if;
  if not coalesce(public.portal_mfa_satisfied(), false) then
    raise exception 'Complete required Main Admin verification before receiving stock' using errcode = '42501';
  end if;
  if p_request_id is null then
    raise exception 'Missing stock receipt request ID';
  end if;
  if p_supplier_name is null or length(btrim(p_supplier_name)) not between 1 and 200 then
    raise exception 'Enter a supplier name of 1 to 200 characters';
  end if;
  if p_supplier_reference is not null and length(btrim(p_supplier_reference)) > 120 then
    raise exception 'Supplier reference must be 120 characters or fewer';
  end if;
  if p_notes is not null and length(btrim(p_notes)) > 1000 then
    raise exception 'Notes must be 1000 characters or fewer';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) not between 1 and 100 then
    raise exception 'A stock receipt must contain 1 to 100 product lines';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_items) line
    where coalesce(line->>'product_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or (nullif(line->>'variant_id', '') is not null
        and (line->>'variant_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
      or coalesce(line->>'quantity', '') !~ '^[1-9][0-9]{0,6}$'
      or coalesce(line->>'unit_cost', '') !~ '^(0|[1-9][0-9]{0,9})(\.[0-9]{1,2})?$'
  ) then
    raise exception 'Each line needs a valid product, whole positive quantity, and unit cost up to two decimals';
  end if;

  -- A lost network response can safely retry the same request without receiving
  -- the stock twice. The request lock serializes concurrent retries.
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 0));
  select * into prior_receipt
  from public.shop_stock_receipts
  where request_id = p_request_id;
  if found then
    if prior_receipt.received_by <> auth.uid() then
      raise exception 'Stock receipt request belongs to another administrator' using errcode = '42501';
    end if;
    return prior_receipt.id;
  end if;

  insert into public.shop_stock_receipts (
    request_id, supplier_name, supplier_reference, notes, received_by
  ) values (
    p_request_id, btrim(p_supplier_name), nullif(btrim(p_supplier_reference), ''),
    nullif(btrim(p_notes), ''), auth.uid()
  ) returning id into receipt_id;

  -- Stable row order prevents two multi-product receipts from deadlocking.
  for item in
    select
      (line->>'product_id')::uuid as product_id,
      nullif(line->>'variant_id', '')::uuid as variant_id,
      (line->>'quantity')::integer as quantity,
      (line->>'unit_cost')::numeric(12,2) as unit_cost
    from jsonb_array_elements(p_items) line
    order by (line->>'product_id')::uuid, nullif(line->>'variant_id', '')::uuid nulls first
  loop
    select * into product
    from public.inventory_products
    where id = item.product_id
    for update;

    if not found or not product.active then
      raise exception 'A selected product is unavailable';
    end if;
    if product.campus is null or product.campus not in ('junior', 'senior') then
      raise exception 'Assign the product to a campus before receiving stock';
    end if;
    if product.currency is null or product.currency not in ('USD', 'ZWG') then
      raise exception 'Set a supported currency on the product before receiving stock';
    end if;

    if product.has_variants then
      if item.variant_id is null then
        raise exception 'Choose a size for this product';
      end if;
      select * into variant
      from public.product_variants
      where id = item.variant_id and product_id = product.id
      for update;
      if not found or not variant.active then
        raise exception 'A selected product size is unavailable';
      end if;
      if variant.quantity_on_hand > 2147483647 - item.quantity then
        raise exception 'Received quantity exceeds the supported stock limit';
      end if;
      update public.product_variants
      set quantity_on_hand = quantity_on_hand + item.quantity
      where id = variant.id;
    else
      if item.variant_id is not null then
        raise exception 'This product does not have size variants';
      end if;
      if product.quantity_on_hand > 2147483647 - item.quantity then
        raise exception 'Received quantity exceeds the supported stock limit';
      end if;
      update public.inventory_products
      set quantity_on_hand = quantity_on_hand + item.quantity,
          updated_at = now()
      where id = product.id;
    end if;

    insert into public.shop_stock_batches (
      receipt_id, product_id, variant_id, campus, currency,
      quantity_received, quantity_remaining, unit_cost
    ) values (
      receipt_id, product.id, item.variant_id, product.campus, product.currency,
      item.quantity, item.quantity, item.unit_cost
    );

    line_details := line_details || jsonb_build_array(jsonb_build_object(
      'product_id', product.id,
      'product_name', product.name,
      'variant_id', item.variant_id,
      'size', case when item.variant_id is null then null else variant.size end,
      'campus', product.campus,
      'currency', product.currency,
      'quantity', item.quantity,
      'unit_cost', item.unit_cost,
      'line_cost', item.unit_cost * item.quantity
    ));
  end loop;

  insert into public.shop_audit(action, details, actor)
  values (
    'STOCK_RECEIPT',
    jsonb_build_object(
      'receipt_id', receipt_id,
      'supplier_name', btrim(p_supplier_name),
      'supplier_reference', nullif(btrim(p_supplier_reference), ''),
      'lines', line_details
    ),
    auth.uid()
  );

  return receipt_id;
end;
$$;

revoke all on function public.receive_shop_stock(uuid, text, text, text, jsonb) from public, anon;
grant execute on function public.receive_shop_stock(uuid, text, text, text, jsonb) to authenticated;

notify pgrst, 'reload schema';
commit;
