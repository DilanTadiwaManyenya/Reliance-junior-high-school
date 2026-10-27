-- ONE-TIME destructive cleanup for the explicitly confirmed Blinder pilot.
-- Run in Supabase SQL Editor as postgres. This does not change RLS or policies.
-- Requires exactly this disabled Form 1 Green 2026 learner, one fee payment,
-- and one completed or already reversed POS sale. Any mismatch aborts everything.
-- Completed sale stock is restored and a retained financial event records the
-- sale, lines, payments and stock adjustment before sale rows are removed.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create temporary table blinder_pilot_target on commit drop as
select s.id, s.admission_number, s.full_name, s.campus
from public.students s
where s.id = '06b6dacf-6c95-4ece-91b2-778995dab2f7'::uuid
  and s.admission_number = '26f108'
  and upper(trim(s.full_name)) = 'BLINDER NYAMUKUSA'
  and s.campus = 'senior' and s.class_level = 'Form 1'
  and s.class_stream = 'Green' and s.enrolled_year = 2026
  and s.status = 'inactive'
for update of s;

create temporary table blinder_pilot_result (
  learner_id uuid,
  fee_payments_removed integer,
  fee_requests_removed integer,
  pos_sales_removed integer,
  pos_payments_removed integer,
  stock_units_restored integer
) on commit drop;

do $cleanup$
declare
  target public.students%rowtype;
  sale public.pos_sales%rowtype;
  line record;
  product public.inventory_products%rowtype;
  variant public.product_variants%rowtype;
  sale_count integer;
  fee_count integer;
  request_count integer := 0;
  pos_payment_count integer := 0;
  stock_units integer := 0;
  stock_changes jsonb := '[]'::jsonb;
  actor_name text;
begin
  if (select count(*) from blinder_pilot_target) <> 1 then
    raise exception 'Blinder pilot learner did not match the verified disabled record. No changes made.';
  end if;
  -- Load the complete students row in its declared column order. The target
  -- table is only a four-column verification set, so selecting it directly
  -- into students%rowtype would map campus ('senior') into date_of_birth.
  select s.* into strict target
  from public.students s
  join blinder_pilot_target t on t.id = s.id
  for update of s;

  perform 1 from public.fee_payments where student_id = target.id for update;
  select count(*) into fee_count from public.fee_payments where student_id = target.id;
  if fee_count <> 1 then
    raise exception 'Expected exactly one confirmed pilot fee payment; found %. No changes made.', fee_count;
  end if;
  perform 1 from public.fee_balances where student_id = target.id for update;
  if exists(select 1 from public.fee_balances where student_id = target.id and academic_year is distinct from 2026) then
    raise exception 'Fee balances outside the confirmed 2026 pilot exist. No changes made.';
  end if;
  if exists(select 1 from public.fee_payment_requests r
    join public.fee_balances b on b.id = r.fee_balance_id
    where b.student_id = target.id
      and (r.payload->>'student_id' is distinct from target.id::text
        or r.payload->>'year' is distinct from '2026')) then
    raise exception 'Fee retry metadata is outside the confirmed pilot scope. No changes made.';
  end if;
  perform 1 from public.pos_sales where student_id = target.id for update;
  select count(*) into sale_count from public.pos_sales where student_id = target.id;
  if sale_count <> 1 then
    raise exception 'Expected exactly one confirmed pilot POS sale; found %. No changes made.', sale_count;
  end if;
  select * into strict sale from public.pos_sales where student_id = target.id for update;
  if sale.campus is distinct from target.campus or sale.status not in ('completed', 'reversed') then
    raise exception 'POS sale campus or status needs review. No changes made.';
  end if;
  if exists(select 1 from public.parent_uniform_orders where student_id = target.id)
    or exists(select 1 from public.year_rollover_entries where student_id = target.id) then
    raise exception 'Uniform order or rollover history exists. No changes made.';
  end if;

  if sale.status = 'completed' then
    if not exists(select 1 from public.pos_sale_items where sale_id = sale.id) then
      raise exception 'Pilot POS sale has no stock lines to restore. No changes made.';
    end if;
    for line in
      select product_id, variant_id, size_label, sum(quantity)::integer as quantity
      from public.pos_sale_items where sale_id = sale.id
      group by product_id, variant_id, size_label order by product_id, variant_id
    loop
      select * into product from public.inventory_products where id = line.product_id for update;
      if not found or product.campus is distinct from sale.campus then
        raise exception 'A sold product is missing or its campus changed. No changes made.';
      end if;
      if line.variant_id is not null then
        select * into variant from public.product_variants
          where id = line.variant_id and product_id = line.product_id for update;
        if not found or variant.size is distinct from line.size_label then
          raise exception 'A sold product variant is missing or changed. No changes made.';
        end if;
        update public.product_variants set quantity_on_hand = quantity_on_hand + line.quantity
          where id = variant.id;
      else
        if product.has_variants then
          raise exception 'Product variant configuration changed; stock requires review. No changes made.';
        end if;
        update public.inventory_products set quantity_on_hand = quantity_on_hand + line.quantity, updated_at = now()
          where id = product.id;
      end if;
      stock_units := stock_units + line.quantity;
      stock_changes := stock_changes || jsonb_build_array(jsonb_build_object(
        'product_id', line.product_id, 'variant_id', line.variant_id,
        'size', line.size_label, 'quantity_restored', line.quantity));
    end loop;
  end if;

  -- Preserve existing financial_events. Add a retained audit snapshot of the
  -- pilot sale before its source rows are removed.
  select full_name into actor_name from public.profiles where id = auth.uid();
  insert into public.financial_events(module, action, record_id, campus, currency,
      actor_id, actor_name, actor_role, reason, details)
  values ('pos', 'pilot_sale_removed', gen_random_uuid(), sale.campus, sale.currency,
      auth.uid(), coalesce(actor_name, 'Database operation'), 'main_admin',
      'Confirmed pilot test transaction cleanup',
      jsonb_build_object('sale', to_jsonb(sale),
        'sale_items', (select coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb)
          from public.pos_sale_items i where i.sale_id = sale.id),
        'payments', (select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb)
          from public.pos_payments p where p.sale_id = sale.id),
        'stock_changes', stock_changes,
        'stock_was_restored', sale.status = 'completed'));

  delete from public.fee_payment_requests r using public.fee_balances b
    where r.fee_balance_id = b.id and b.student_id = target.id;
  get diagnostics request_count = row_count;
  delete from public.fee_payments where student_id = target.id;
  get diagnostics fee_count = row_count;

  delete from public.pos_payments where sale_id = sale.id;
  get diagnostics pos_payment_count = row_count;
  delete from public.pos_sales where id = sale.id;
  if not found then raise exception 'POS sale changed while cleaning up. No changes committed.'; end if;

  delete from public.academic_records where student_id = target.id;
  delete from public.junior_component_marks where student_id = target.id;
  delete from public.junior_developmental_ratings where student_id = target.id;
  delete from public.report_card_comments where student_id = target.id;
  delete from public.coursework_marks where student_id = target.id;
  delete from public.report_period_contexts where student_id = target.id;
  delete from public.students where id = target.id;
  if not found then raise exception 'Learner changed while cleaning up. No changes committed.'; end if;

  insert into blinder_pilot_result values
    (target.id, fee_count, request_count, sale_count, pos_payment_count, stock_units);
end;
$cleanup$;

select * from blinder_pilot_result;
commit;

-- Run after commit; expected result is zero.
select count(*) as remaining_blinder_learner
from public.students where id = '06b6dacf-6c95-4ece-91b2-778995dab2f7'::uuid;
