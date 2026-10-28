-- Stage 4: make checkout, returns, and stock corrections maintain purchase-cost batches.
begin;

alter table public.shop_stock_receipts
  alter column received_by drop not null,
  add column if not exists receipt_kind text not null default 'supplier';
alter table public.shop_stock_receipts
  drop constraint if exists shop_stock_receipts_receipt_kind_check;
alter table public.shop_stock_receipts
  add constraint shop_stock_receipts_receipt_kind_check
  check (receipt_kind in ('supplier', 'opening', 'adjustment', 'allocation', 'return'));

alter table public.pos_sale_items
  add column if not exists cost_total numeric(24,2);
update public.pos_sale_items
set cost_total = round(unit_cost * quantity, 2)
where cost_total is null and unit_cost is not null;

create table if not exists public.shop_stock_batch_allocations (
  id uuid primary key default gen_random_uuid(),
  sale_item_id uuid not null references public.pos_sale_items(id) on delete restrict,
  batch_id uuid not null references public.shop_stock_batches(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_cost numeric(12,2) not null check (unit_cost >= 0),
  created_at timestamptz not null default now(),
  unique (sale_item_id, batch_id),
  constraint shop_stock_batch_allocations_cost_finite
    check (unit_cost::text not in ('NaN', 'Infinity', '-Infinity'))
);
create index if not exists shop_stock_batch_allocations_batch_idx
  on public.shop_stock_batch_allocations (batch_id, sale_item_id);

create or replace function public.guard_shop_product_batch_currency()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.currency is distinct from new.currency and exists (
    select 1 from public.shop_stock_batches batch
    where batch.product_id = old.id and batch.quantity_remaining > 0
  ) then
    raise exception 'Sell or reconcile the remaining stock batches before changing product currency';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_shop_product_batch_currency() from public, anon, authenticated;
drop trigger if exists guard_shop_product_batch_currency on public.inventory_products;
create trigger guard_shop_product_batch_currency
  before update of currency on public.inventory_products
  for each row execute function public.guard_shop_product_batch_currency();

alter table public.shop_stock_batch_allocations enable row level security;
revoke all on public.shop_stock_batch_allocations from public, anon, authenticated;
grant select on public.shop_stock_batch_allocations to authenticated;
drop policy if exists "Shop staff read scoped batch allocations" on public.shop_stock_batch_allocations;
create policy "Shop staff read scoped batch allocations" on public.shop_stock_batch_allocations
  for select to authenticated using (
    exists (
      select 1 from public.shop_stock_batches batch
      where batch.id = shop_stock_batch_allocations.batch_id
        and (public.is_main_school_admin() or public.can_read_shop_campus(batch.campus))
    )
  );
drop policy if exists "Admin sessions require MFA" on public.shop_stock_batch_allocations;
create policy "Admin sessions require MFA" on public.shop_stock_batch_allocations as restrictive
  for all to authenticated
  using (public.portal_mfa_satisfied())
  with check (public.portal_mfa_satisfied());

-- Preserve current assigned quantities as opening lots. Existing product-level
-- cost is the only available baseline; historical supplier costs are not inferred.
do $$
declare
  target_campus text;
  opening_receipt uuid;
begin
  if exists (
    select 1 from public.shop_stock_receipts where receipt_kind = 'supplier'
  ) then
    raise exception 'Supplier receipts already exist. Reconcile current batches and stock before the POS costing cutover; no opening lots were added.';
  end if;
  for target_campus in
    select distinct campus
    from public.inventory_products
    where campus in ('junior', 'senior')
      and (quantity_on_hand > 0 or exists (
        select 1 from public.product_variants variant
        where variant.product_id = inventory_products.id and variant.quantity_on_hand > 0
      ))
    order by campus
  loop
    insert into public.shop_stock_receipts (
      request_id, supplier_name, supplier_reference, notes, received_by, receipt_kind
    ) values (
      gen_random_uuid(), 'Opening inventory', 'POS batch-costing cutover',
      'Opening quantity captured from existing stock. Unit cost uses the product cost recorded at cutover.',
      null, 'opening'
    ) returning id into opening_receipt;

    insert into public.shop_stock_batches (
      receipt_id, product_id, campus, currency,
      quantity_received, quantity_remaining, unit_cost
    )
    select opening_receipt, product.id, product.campus, product.currency,
      product.quantity_on_hand, product.quantity_on_hand, product.cost_price
    from public.inventory_products product
    where product.campus = target_campus
      and not product.has_variants
      and product.quantity_on_hand > 0;

    insert into public.shop_stock_batches (
      receipt_id, product_id, variant_id, campus, currency,
      quantity_received, quantity_remaining, unit_cost
    )
    select opening_receipt, product.id, variant.id, product.campus, product.currency,
      variant.quantity_on_hand, variant.quantity_on_hand, product.cost_price
    from public.inventory_products product
    join public.product_variants variant on variant.product_id = product.id
    where product.campus = target_campus
      and product.has_variants
      and variant.quantity_on_hand > 0;
  end loop;
end;
$$;

create or replace function public.complete_pos_sale(
  p_items jsonb,
  p_payment_method text,
  p_customer_name text,
  p_request_id uuid,
  p_amount_paid numeric,
  p_campus text,
  p_student_id uuid
)
returns public.pos_sales
language plpgsql
security definer
set search_path = public
as $$
declare
  item record;
  product public.inventory_products;
  variant public.product_variants;
  batch record;
  sale public.pos_sales;
  sale_line public.pos_sale_items;
  total_amount numeric(12,2) := 0;
  line_cost numeric(24,2);
  remaining_quantity bigint;
  take_quantity integer;
  line_allocations jsonb;
  v_currency text;
  learner public.students;
begin
  if auth.uid() is null or p_campus is null or p_campus not in ('junior','senior')
    or not coalesce(public.can_read_shop_campus(p_campus), false)
    or not coalesce(public.portal_mfa_satisfied(), false) then
    raise exception 'POS access is restricted to your assigned campus and verified session' using errcode = '42501';
  end if;
  if p_request_id is null or p_items is null or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) not between 1 and 200 then
    raise exception 'A valid checkout is required';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 0));
  select * into sale from public.pos_sales where request_id = p_request_id;
  if found then
    if sale.sold_by <> auth.uid() or sale.campus is distinct from p_campus then
      raise exception 'Request belongs to another staff member or campus';
    end if;
    return sale;
  end if;
  if p_amount_paid is null or p_amount_paid::text in ('NaN','Infinity','-Infinity')
    or p_amount_paid <= 0 or p_amount_paid <> round(p_amount_paid, 2) then
    raise exception 'Enter a positive payment with at most two decimal places';
  end if;
  if p_payment_method is null or p_payment_method not in ('cash','ecocash','swipe','transfer') then
    raise exception 'Invalid payment method';
  end if;
  if p_student_id is not null then
    select * into learner from public.students where id = p_student_id for share;
    if not found or learner.campus is distinct from p_campus or learner.status is distinct from 'active' then
      raise exception 'Choose an active learner in the sale campus';
    end if;
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) line
    where line->>'product_id' is null or line->>'quantity' is null
      or (line->>'quantity') !~ '^[1-9][0-9]*$'
  ) then
    raise exception 'Invalid cart quantity';
  end if;

  for item in
    select (line->>'product_id')::uuid as product_id,
      nullif(line->>'variant_id','')::uuid as variant_id,
      sum((line->>'quantity')::integer)::integer as quantity
    from jsonb_array_elements(p_items) line
    group by 1, 2 order by 1, 2
  loop
    select * into product from public.inventory_products
    where id = item.product_id and active and campus = p_campus for update;
    if not found then raise exception 'Product unavailable in your campus'; end if;
    if v_currency is null then v_currency := product.currency;
    elsif v_currency <> product.currency then raise exception 'A POS sale cannot mix USD and ZWG items'; end if;
    if product.has_variants then
      select * into variant from public.product_variants
      where id = item.variant_id and product_id = product.id and active for update;
      if not found or variant.quantity_on_hand < item.quantity then
        raise exception 'Size unavailable or insufficient size stock';
      end if;
    elsif item.variant_id is not null or product.quantity_on_hand < item.quantity then
      raise exception 'Product unavailable or insufficient stock';
    end if;
    total_amount := total_amount + product.selling_price * item.quantity;
  end loop;
  if total_amount::text in ('NaN','Infinity','-Infinity') or total_amount <= 0 then
    raise exception 'Set a positive selling price before checkout';
  end if;
  if p_amount_paid < total_amount and p_student_id is null then
    raise exception 'Select a learner before allowing an unpaid balance';
  end if;

  insert into public.pos_sales (
    customer_name, payment_method, total, sold_by, request_id, amount_paid,
    campus, currency, student_id, payment_tracking, paid_total, issued_at
  ) values (
    coalesce(nullif(btrim(p_customer_name),''), learner.full_name), p_payment_method,
    total_amount, auth.uid(), p_request_id, p_amount_paid, p_campus, v_currency,
    p_student_id, true, 0, now()
  ) returning * into sale;

  for item in
    select (line->>'product_id')::uuid as product_id,
      nullif(line->>'variant_id','')::uuid as variant_id,
      sum((line->>'quantity')::integer)::integer as quantity
    from jsonb_array_elements(p_items) line
    group by 1, 2 order by 1, 2
  loop
    select * into product from public.inventory_products where id = item.product_id;
    if product.has_variants then
      select * into variant from public.product_variants where id = item.variant_id;
      update public.product_variants
      set quantity_on_hand = quantity_on_hand - item.quantity
      where id = item.variant_id;
    else
      update public.inventory_products
      set quantity_on_hand = quantity_on_hand - item.quantity, updated_at = now()
      where id = product.id;
    end if;

    remaining_quantity := item.quantity;
    line_cost := 0;
    line_allocations := '[]'::jsonb;
    for batch in
      select id, quantity_remaining, unit_cost
      from public.shop_stock_batches
      where product_id = product.id
        and variant_id is not distinct from item.variant_id
        and quantity_remaining > 0
      order by received_at, id
      for update
    loop
      exit when remaining_quantity = 0;
      take_quantity := least(remaining_quantity, batch.quantity_remaining)::integer;
      update public.shop_stock_batches
      set quantity_remaining = quantity_remaining - take_quantity
      where id = batch.id;
      line_cost := line_cost + batch.unit_cost * take_quantity;
      line_allocations := line_allocations || jsonb_build_array(jsonb_build_object(
        'batch_id', batch.id, 'quantity', take_quantity, 'unit_cost', batch.unit_cost
      ));
      remaining_quantity := remaining_quantity - take_quantity;
    end loop;
    if remaining_quantity > 0 then
      raise exception 'Purchase cost batches are missing for a selected stock item. Ask Main Admin to reconcile this product before checkout.';
    end if;
    insert into public.pos_sale_items (
      sale_id, product_id, variant_id, size_label, product_name,
      unit_price, unit_cost, cost_total, quantity, line_total
    ) values (
      sale.id, product.id, item.variant_id,
      case when product.has_variants then variant.size else null end,
      product.name, product.selling_price, round(line_cost / item.quantity, 2),
      line_cost, item.quantity, product.selling_price * item.quantity
    ) returning * into sale_line;
    for batch in
      select (allocation->>'batch_id')::uuid as id,
        (allocation->>'quantity')::integer as quantity,
        (allocation->>'unit_cost')::numeric(12,2) as unit_cost
      from jsonb_array_elements(line_allocations) allocation
    loop
      insert into public.shop_stock_batch_allocations(sale_item_id, batch_id, quantity, unit_cost)
      values (sale_line.id, batch.id, batch.quantity, batch.unit_cost);
    end loop;
  end loop;

  perform public.record_pos_payment(sale.id, p_amount_paid, p_payment_method, p_request_id, null);
  select * into sale from public.pos_sales where id = sale.id;
  return sale;
end;
$$;
revoke all on function public.complete_pos_sale(jsonb,text,text,uuid,numeric,text) from public, anon;
grant execute on function public.complete_pos_sale(jsonb,text,text,uuid,numeric,text) to authenticated;
revoke all on function public.complete_pos_sale(jsonb,text,text,uuid,numeric,text,uuid) from public, anon;
grant execute on function public.complete_pos_sale(jsonb,text,text,uuid,numeric,text,uuid) to authenticated;

create or replace function public.complete_pos_sale(
  p_items jsonb, p_payment_method text, p_customer_name text, p_request_id uuid,
  p_amount_paid numeric, p_campus text
)
returns public.pos_sales
language sql security definer set search_path = public as $$
  select public.complete_pos_sale(p_items, p_payment_method, p_customer_name,
    p_request_id, p_amount_paid, p_campus, null::uuid);
$$;

create or replace function public.adjust_shop_stock(p_product uuid, p_change integer, p_reason text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  product public.inventory_products;
  receipt_id uuid;
  remaining_quantity bigint;
  batch record;
  take_quantity integer;
begin
  select * into product from public.inventory_products where id = p_product for update;
  if not found or not product.active
    or not coalesce(public.can_manage_shop_campus(product.campus), false)
    or not coalesce(public.portal_mfa_satisfied(), false) then
    raise exception 'Verified campus administrator access is required';
  end if;
  if product.campus is null or product.campus not in ('junior','senior') then
    raise exception 'Assign this product to a campus before adjusting stock';
  end if;
  if p_change is null or p_change = 0 or nullif(btrim(p_reason),'') is null then
    raise exception 'Enter a quantity change and reason';
  end if;
  if product.has_variants then raise exception 'Adjust stock by size for this product'; end if;
  if product.quantity_on_hand::bigint + p_change < 0 then
    raise exception 'Stock adjustment cannot make quantity negative';
  end if;

  if p_change > 0 then
    insert into public.shop_stock_receipts (
      request_id, supplier_name, supplier_reference, notes, received_by, receipt_kind
    ) values (
      gen_random_uuid(), 'Manual stock correction', null, btrim(p_reason), auth.uid(), 'adjustment'
    ) returning id into receipt_id;
    insert into public.shop_stock_batches (
      receipt_id, product_id, campus, currency,
      quantity_received, quantity_remaining, unit_cost
    ) values (
      receipt_id, product.id, product.campus, product.currency,
      p_change, p_change, product.cost_price
    );
  else
    remaining_quantity := -p_change::bigint;
    for batch in
      select id, quantity_remaining
      from public.shop_stock_batches
      where product_id = product.id and variant_id is null and quantity_remaining > 0
      order by received_at, id
      for update
    loop
      exit when remaining_quantity = 0;
      take_quantity := least(remaining_quantity, batch.quantity_remaining)::integer;
      update public.shop_stock_batches
      set quantity_remaining = quantity_remaining - take_quantity
      where id = batch.id;
      remaining_quantity := remaining_quantity - take_quantity;
    end loop;
    if remaining_quantity > 0 then
      raise exception 'Cost batches do not cover this stock reduction; reconcile the batches first';
    end if;
  end if;

  update public.inventory_products
  set quantity_on_hand = quantity_on_hand + p_change, updated_at = now()
  where id = product.id;
  insert into public.shop_audit(action, details, actor)
  values ('STOCK_ADJUSTMENT', jsonb_build_object(
    'product_id', product.id, 'campus', product.campus, 'change', p_change,
    'reason', btrim(p_reason), 'receipt_id', receipt_id,
    'unit_cost', case when p_change > 0 then product.cost_price else null end
  ), auth.uid());
end;
$$;
revoke all on function public.adjust_shop_stock(uuid,integer,text) from public, anon;
grant execute on function public.adjust_shop_stock(uuid,integer,text) to authenticated;

create or replace function public.split_unassigned_shop_product(
  p_product uuid, p_campus text, p_quantity integer, p_details jsonb
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  source public.inventory_products;
  allocated_id uuid := gen_random_uuid();
  allocated_sku text;
  receipt_id uuid;
begin
  if auth.uid() is null or not coalesce(public.is_main_school_admin(), false)
    or not coalesce(public.portal_mfa_satisfied(), false) then
    raise exception 'Verified Main Admin access is required' using errcode = '42501';
  end if;
  if p_campus is null or p_campus not in ('junior','senior') then raise exception 'Choose Junior or Senior'; end if;
  select * into source from public.inventory_products where id = p_product for update;
  if not found or source.campus is not null then raise exception 'This product is no longer unassigned'; end if;
  if source.has_variants and p_quantity is distinct from source.quantity_on_hand then
    raise exception 'Allocate sized stock as a whole product';
  end if;
  if p_quantity is null or p_quantity < 0 or p_quantity > source.quantity_on_hand then
    raise exception 'Allocation quantity cannot be negative or exceed unassigned stock';
  end if;
  if nullif(btrim(p_details->>'name'),'') is null then raise exception 'Enter a product name'; end if;
  allocated_sku := nullif(btrim(p_details->>'sku'),'');
  if allocated_sku = source.sku then allocated_sku := allocated_sku || '-' || p_campus || '-' || left(allocated_id::text, 8); end if;
  if p_quantity = source.quantity_on_hand then
    allocated_id := source.id;
    update public.inventory_products set
      name = btrim(p_details->>'name'), sku = allocated_sku,
      category = p_details->>'category', campus = p_campus,
      currency = source.currency,
      selling_price = (p_details->>'selling_price')::numeric,
      cost_price = (p_details->>'cost_price')::numeric,
      reorder_level = (p_details->>'reorder_level')::integer,
      active = coalesce((p_details->>'active')::boolean, true),
      image_url = p_details->>'image_url', updated_at = now()
    where id = source.id;
  else
    update public.inventory_products set quantity_on_hand = quantity_on_hand - p_quantity, updated_at = now() where id = source.id;
    insert into public.inventory_products(
      id, name, sku, category, campus, selling_price, cost_price,
      currency, quantity_on_hand, reorder_level, active, image_url, created_by
    ) values (
      allocated_id, btrim(p_details->>'name'), allocated_sku, p_details->>'category', p_campus,
      (p_details->>'selling_price')::numeric, source.cost_price, source.currency,
      p_quantity, (p_details->>'reorder_level')::integer,
      coalesce((p_details->>'active')::boolean, true), p_details->>'image_url', auth.uid()
    );
  end if;
  insert into public.shop_stock_receipts(
    request_id, supplier_name, supplier_reference, notes, received_by, receipt_kind
  ) values (
    gen_random_uuid(), 'Unassigned stock allocation', source.sku,
    'Assigned from unallocated opening inventory; cost uses the source product cost.',
    auth.uid(), 'allocation'
  ) returning id into receipt_id;
  if source.has_variants then
    insert into public.shop_stock_batches(
      receipt_id, product_id, variant_id, campus, currency,
      quantity_received, quantity_remaining, unit_cost
    )
    select receipt_id, allocated_id, variant.id, p_campus, source.currency,
      variant.quantity_on_hand, variant.quantity_on_hand, source.cost_price
    from public.product_variants variant
    where variant.product_id = allocated_id and variant.quantity_on_hand > 0;
  elsif p_quantity > 0 then
    insert into public.shop_stock_batches(
      receipt_id, product_id, campus, currency, quantity_received, quantity_remaining, unit_cost
    ) values (
      receipt_id, allocated_id, p_campus, source.currency, p_quantity, p_quantity, source.cost_price
    );
  end if;
  return allocated_id;
end;
$$;
revoke all on function public.split_unassigned_shop_product(uuid,text,integer,jsonb) from public, anon;
grant execute on function public.split_unassigned_shop_product(uuid,text,integer,jsonb) to authenticated;

create or replace function public.reverse_pos_sale(p_sale_id uuid, p_reason text)
returns public.pos_sales
language plpgsql security definer set search_path = public as $$
declare
  sale public.pos_sales;
  original public.pos_sales;
  item record;
  allocation record;
  product public.inventory_products;
  variant public.product_variants;
  receipt_id uuid;
  stock_changes jsonb := '[]'::jsonb;
  allocated_quantity integer;
begin
  if auth.uid() is null or not coalesce(public.is_main_school_admin(), false) then
    raise exception 'Only Main Admin can reverse a POS sale' using errcode = '42501';
  end if;
  if not coalesce(public.portal_mfa_satisfied(), false) then
    raise exception 'Complete your required admin sign-in verification' using errcode = '42501';
  end if;
  if p_reason is null or length(btrim(p_reason)) not between 5 and 1000 then
    raise exception 'Enter a reversal reason of 5 to 1000 characters';
  end if;
  select * into sale from public.pos_sales where id = p_sale_id for update;
  if not found then raise exception 'Sale not found'; end if;
  if sale.status = 'reversed' then return sale; end if;
  if sale.campus is null or sale.campus not in ('junior','senior') then
    raise exception 'Legacy sale requires campus review before reversal';
  end if;
  if not exists(select 1 from public.pos_sale_items where sale_id = sale.id) then
    raise exception 'Sale has no stock lines; review before reversal';
  end if;
  original := sale;
  insert into public.shop_stock_receipts(
    request_id, supplier_name, supplier_reference, notes, received_by, receipt_kind
  ) values (
    gen_random_uuid(), 'POS sale return', sale.receipt_number, btrim(p_reason), auth.uid(), 'return'
  ) returning id into receipt_id;

  for item in
    select product_id, variant_id, size_label, sum(quantity)::integer as quantity
    from public.pos_sale_items where sale_id = sale.id
    group by 1,2,3 order by 1,2
  loop
    select * into product from public.inventory_products where id = item.product_id for update;
    if not found or product.campus is distinct from sale.campus then
      raise exception 'Sold product is missing or changed campus; review before reversal';
    end if;
    if item.variant_id is not null then
      select * into variant from public.product_variants
      where id = item.variant_id and product_id = item.product_id for update;
      if not found or variant.size is distinct from item.size_label then
        raise exception 'Sold size is missing or changed; review before reversal';
      end if;
      update public.product_variants set quantity_on_hand = quantity_on_hand + item.quantity where id = variant.id;
      stock_changes := stock_changes || jsonb_build_array(jsonb_build_object(
        'product_id', product.id, 'variant_id', variant.id, 'size', item.size_label,
        'quantity', item.quantity, 'before', variant.quantity_on_hand,
        'after', variant.quantity_on_hand + item.quantity
      ));
    else
      if product.has_variants then raise exception 'Unsized product now has sizes; review stock allocation before reversal'; end if;
      update public.inventory_products set quantity_on_hand = quantity_on_hand + item.quantity, updated_at = now() where id = product.id;
      stock_changes := stock_changes || jsonb_build_array(jsonb_build_object(
        'product_id', product.id, 'variant_id', null, 'quantity', item.quantity,
        'before', product.quantity_on_hand, 'after', product.quantity_on_hand + item.quantity
      ));
    end if;
  end loop;

  for item in select * from public.pos_sale_items where sale_id = sale.id order by product_id, variant_id nulls first, id loop
    select coalesce(sum(quantity), 0)::integer into allocated_quantity
    from public.shop_stock_batch_allocations where sale_item_id = item.id;
    if allocated_quantity = item.quantity then
      for allocation in
        select batch.campus, batch.currency, saved.quantity, saved.unit_cost
        from public.shop_stock_batch_allocations saved
        join public.shop_stock_batches batch on batch.id = saved.batch_id
        where saved.sale_item_id = item.id order by batch.received_at, batch.id
      loop
        insert into public.shop_stock_batches(
          receipt_id, product_id, variant_id, campus, currency,
          quantity_received, quantity_remaining, unit_cost
        ) values (
          receipt_id, item.product_id, item.variant_id, allocation.campus, allocation.currency,
          allocation.quantity, allocation.quantity, allocation.unit_cost
        );
      end loop;
    elsif allocated_quantity = 0 and item.unit_cost is not null then
      select * into product from public.inventory_products where id = item.product_id;
      insert into public.shop_stock_batches(
        receipt_id, product_id, variant_id, campus, currency,
        quantity_received, quantity_remaining, unit_cost
      ) values (
        receipt_id, item.product_id, item.variant_id, sale.campus, sale.currency,
        item.quantity, item.quantity, item.unit_cost
      );
    else
      raise exception 'Sale cost allocations are incomplete; review the receipt before reversing';
    end if;
  end loop;

  update public.pos_sales
  set status = 'reversed', reversed_at = now(), reversed_by = auth.uid(), reversal_reason = btrim(p_reason)
  where id = sale.id returning * into sale;
  insert into public.financial_events(module, action, record_id, campus, currency, actor_id, actor_name, actor_role, reason, details)
  select 'pos', 'sale_reversed', sale.id, sale.campus, sale.currency, auth.uid(),
    profile.full_name, coalesce(profile.active_role, profile.role), sale.reversal_reason,
    jsonb_build_object('before', to_jsonb(original), 'after', to_jsonb(sale),
      'stock_changes', stock_changes,
      'lines', (select jsonb_agg(to_jsonb(line)) from public.pos_sale_items line where line.sale_id = sale.id),
      'settlement', 'Reversal does not refund money; review settlement separately')
  from public.profiles profile where profile.id = auth.uid();
  if not found then raise exception 'An authenticated financial actor is required'; end if;
  insert into public.shop_audit(action, details, actor)
  values ('POS_SALE_REVERSED', jsonb_build_object(
    'sale_id', sale.id, 'receipt_number', sale.receipt_number, 'campus', sale.campus,
    'currency', sale.currency, 'reason', sale.reversal_reason, 'stock_changes', stock_changes,
    'return_receipt_id', receipt_id, 'total', sale.total
  ), auth.uid());
  return sale;
end;
$$;
revoke all on function public.reverse_pos_sale(uuid,text) from public, anon;
grant execute on function public.reverse_pos_sale(uuid,text) to authenticated;

notify pgrst, 'reload schema';
commit;
