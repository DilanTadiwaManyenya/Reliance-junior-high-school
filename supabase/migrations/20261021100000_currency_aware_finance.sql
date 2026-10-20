begin;

-- All existing money stays unchanged and is classified as USD.
alter table public.fee_balances add column if not exists currency text not null default 'USD';
alter table public.fee_payments add column if not exists currency text not null default 'USD';
alter table public.fee_structure_mapping add column if not exists currency text not null default 'USD';
alter table public.school_expenses add column if not exists currency text not null default 'USD';
alter table public.inventory_products add column if not exists currency text not null default 'USD';
alter table public.pos_sales add column if not exists currency text not null default 'USD';
alter table public.parent_uniform_orders add column if not exists currency text not null default 'USD';

alter table public.fee_balances drop constraint if exists fee_balances_currency_check;
alter table public.fee_balances add constraint fee_balances_currency_check check (currency in ('USD','ZWG'));
alter table public.fee_payments drop constraint if exists fee_payments_currency_check;
alter table public.fee_payments add constraint fee_payments_currency_check check (currency in ('USD','ZWG'));
alter table public.fee_structure_mapping drop constraint if exists fee_structure_mapping_currency_check;
alter table public.fee_structure_mapping add constraint fee_structure_mapping_currency_check check (currency in ('USD','ZWG'));
alter table public.school_expenses drop constraint if exists school_expenses_currency_check;
alter table public.school_expenses add constraint school_expenses_currency_check check (currency in ('USD','ZWG'));
alter table public.inventory_products drop constraint if exists inventory_products_currency_check;
alter table public.inventory_products add constraint inventory_products_currency_check check (currency in ('USD','ZWG'));
alter table public.pos_sales drop constraint if exists pos_sales_currency_check;
alter table public.pos_sales add constraint pos_sales_currency_check check (currency in ('USD','ZWG'));
alter table public.parent_uniform_orders drop constraint if exists parent_uniform_orders_currency_check;
alter table public.parent_uniform_orders add constraint parent_uniform_orders_currency_check check (currency in ('USD','ZWG'));

-- Keep one fee balance per learner, period, and currency.
do $$
declare v_constraint record;
begin
  for v_constraint in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.fee_balances'::regclass
      and c.contype = 'u'
      and (select array_agg(a.attname order by a.attname)
           from unnest(c.conkey) as key(attnum)
           join pg_attribute a on a.attrelid = c.conrelid and a.attnum = key.attnum)
          = array['academic_year'::name,'student_id'::name,'term'::name]
  loop
    execute format('alter table public.fee_balances drop constraint %I', v_constraint.conname);
  end loop;
end $$;
create unique index if not exists fee_balances_student_period_currency_unique
  on public.fee_balances(student_id, term, academic_year, currency);

-- Keep the USD schedule as-is and allow admins to configure separate ZWG amounts.
alter table public.fee_structure_mapping drop constraint if exists fee_structure_mapping_pkey;
create unique index if not exists fee_structure_mapping_band_currency_unique
  on public.fee_structure_mapping(band_id, currency);
drop policy if exists "Admins insert fee structure mappings" on public.fee_structure_mapping;
-- The existing Main Admin-only FOR ALL policy also governs inserts/upserts.

create or replace function public.get_fee_amount(p_class_level text, p_currency text)
returns numeric language sql stable set search_path = public as $$
  select amount from public.fee_structure_mapping
  where band_id = case
    when p_class_level in ('ECD A','ECD B') then 'ecd_a_b'
    when p_class_level like 'Grade%' then 'grade_1_7'
    when p_class_level in ('Form 1','Form 2') then 'form_1_2'
    when p_class_level in ('Form 3','Form 4') then 'form_3_4'
    when p_class_level in ('Form 5','Form 6','Lower Six','Upper Six') then 'lower_upper_six'
    else 'grade_1_7'
  end
    and currency = upper(coalesce(nullif(trim(p_currency),''),'USD'))
  limit 1;
$$;
revoke all on function public.get_fee_amount(text,text) from public, anon;
grant execute on function public.get_fee_amount(text,text) to authenticated, service_role;

create or replace function public.get_fee_amount(p_class_level text)
returns numeric language sql stable set search_path = public as $$
  select public.get_fee_amount(p_class_level, 'USD');
$$;

create or replace function public.auto_set_fee_amount()
returns trigger language plpgsql set search_path = public as $$
declare v_class_level text; v_amount numeric;
begin
  if new.total_fees is null or new.total_fees = 0 then
    select class_level into v_class_level from public.students where id = new.student_id;
    if v_class_level is not null then
      v_amount := public.get_fee_amount(v_class_level, new.currency);
      if v_amount is not null then new.total_fees := v_amount; end if;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.guard_fee_payment_currency()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_currency text;
begin
  if new.fee_balance_id is not null then
    select currency into v_currency from public.fee_balances where id = new.fee_balance_id;
    if v_currency is not null and new.currency <> v_currency then
      raise exception 'Payment currency must match its fee balance currency';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_fee_payment_currency() from public, anon, authenticated;
drop trigger if exists fee_payment_currency_guard on public.fee_payments;
create trigger fee_payment_currency_guard before insert or update of fee_balance_id, currency
  on public.fee_payments for each row execute function public.guard_fee_payment_currency();

-- Currency-aware overload; the existing signature remains a USD compatibility wrapper.
create or replace function public.record_learner_fee_payment(
  p_student_id uuid, p_term text, p_academic_year integer, p_amount numeric,
  p_paid_on date, p_payment_method text, p_reference_number text,
  p_currency text, p_total_fees numeric default null
) returns public.fee_balances
language plpgsql security definer set search_path = public as $$
declare v_balance public.fee_balances; v_campus text; v_plan text; v_currency text;
begin
  v_currency := upper(coalesce(nullif(trim(p_currency),''),'USD'));
  if v_currency not in ('USD','ZWG') then raise exception 'Choose USD or ZWG'; end if;
  select campus into v_campus from public.students where id = p_student_id;
  if v_campus is null or not (public.accountant_can_access_campus(v_campus) or public.can_manage_student_record(p_student_id)) then raise exception 'You cannot record payments for this learner'; end if;
  if p_amount is null or p_amount <= 0 or p_amount::text in ('NaN','Infinity','-Infinity') then raise exception 'Enter an amount received greater than zero'; end if;
  if p_payment_method not in ('cash','ecocash','swipe','transfer','bank_deposit') then raise exception 'Choose a valid payment method'; end if;
  select * into v_balance from public.fee_balances
    where student_id=p_student_id and term=p_term and academic_year=p_academic_year and currency=v_currency for update;
  if not found then
    if p_total_fees is null or p_total_fees <= 0 or p_total_fees::text in ('NaN','Infinity','-Infinity') then raise exception 'Set a positive fee amount in this currency before recording the first payment'; end if;
    insert into public.fee_balances(student_id,term,academic_year,total_fees,amount_paid,currency,payment_date,updated_by,updated_at)
    values(p_student_id,p_term,p_academic_year,p_total_fees,p_amount,v_currency,p_paid_on,auth.uid(),now()) returning * into v_balance;
  else
    update public.fee_balances set amount_paid=amount_paid+p_amount,payment_date=p_paid_on,updated_by=auth.uid(),updated_at=now()
      where id=v_balance.id returning * into v_balance;
  end if;
  v_plan := case when v_balance.amount_paid < v_balance.total_fees then 'instalment' else 'once_off' end;
  insert into public.fee_payments(fee_balance_id,student_id,term,academic_year,amount,currency,paid_on,payment_method,payment_plan,reference_number,received_by)
  values(v_balance.id,p_student_id,p_term,p_academic_year,p_amount,v_currency,p_paid_on,p_payment_method,v_plan,nullif(trim(p_reference_number),''),auth.uid());
  return v_balance;
end; $$;
revoke all on function public.record_learner_fee_payment(uuid,text,integer,numeric,date,text,text,text,numeric) from public, anon;
grant execute on function public.record_learner_fee_payment(uuid,text,integer,numeric,date,text,text,text,numeric) to authenticated;

create or replace function public.record_learner_fee_payment(
  p_student_id uuid, p_term text, p_academic_year integer, p_amount numeric,
  p_paid_on date, p_payment_method text, p_reference_number text,
  p_total_fees numeric default null
) returns public.fee_balances
language plpgsql security definer set search_path = public as $$
begin
  return public.record_learner_fee_payment(p_student_id,p_term,p_academic_year,p_amount,p_paid_on,p_payment_method,p_reference_number,'USD',p_total_fees);
end; $$;
revoke all on function public.record_learner_fee_payment(uuid,text,integer,numeric,date,text,text,numeric) from public, anon;
grant execute on function public.record_learner_fee_payment(uuid,text,integer,numeric,date,text,text,numeric) to authenticated;

-- Derive POS currency from locked products and reject mixed-currency carts.
create or replace function public.complete_pos_sale(p_items jsonb,p_payment_method text,p_customer_name text,p_request_id uuid,p_amount_paid numeric,p_campus text)
returns public.pos_sales language plpgsql security definer set search_path=public as $$
declare item record; product public.inventory_products; variant public.product_variants; sale public.pos_sales;
  total_amount numeric(12,2):=0; v_campus text; v_currency text;
begin
 v_campus:=p_campus;
 if auth.uid() is null or v_campus is null or v_campus not in ('junior','senior')
   or not coalesce(public.can_read_shop_campus(v_campus),false) then raise exception 'POS access is restricted to your assigned campus. Main Admin must choose Junior or Senior'; end if;
 if p_request_id is null or p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 200 then raise exception 'A valid checkout is required'; end if;
 if p_payment_method is null or p_payment_method not in ('cash','ecocash','swipe','transfer') then raise exception 'Invalid payment method'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
 select * into sale from public.pos_sales where request_id=p_request_id;
 if found then if sale.sold_by<>auth.uid() or sale.campus is distinct from v_campus then raise exception 'Request belongs to another staff member or campus'; end if; return sale; end if;
 if exists(select 1 from jsonb_array_elements(p_items) x where x->>'product_id' is null or x->>'quantity' is null or (x->>'quantity') !~ '^[1-9][0-9]*$') then raise exception 'Invalid cart quantity'; end if;
 for item in select (x->>'product_id')::uuid id, nullif(x->>'variant_id','')::uuid vid, sum((x->>'quantity')::integer)::integer qty
   from jsonb_array_elements(p_items) x group by 1,2 order by 1,2 loop
   select * into product from public.inventory_products where id=item.id and active and campus=v_campus for update;
   if not found then raise exception 'Product unavailable in your campus'; end if;
   if v_currency is null then v_currency:=product.currency; elsif v_currency<>product.currency then raise exception 'A POS sale cannot mix USD and ZWG items'; end if;
   if product.has_variants then
     select * into variant from public.product_variants where id=item.vid and product_id=product.id and active for update;
     if not found or variant.quantity_on_hand<item.qty then raise exception 'Size unavailable or insufficient size stock'; end if;
   elsif item.vid is not null or product.quantity_on_hand<item.qty then raise exception 'Product unavailable or insufficient stock';
   end if;
   total_amount:=total_amount+product.selling_price*item.qty;
 end loop;
 if p_amount_paid is null or p_amount_paid<total_amount or p_amount_paid::text in ('NaN','Infinity','-Infinity') then raise exception 'Amount paid is below the total'; end if;
 insert into public.pos_sales(customer_name,payment_method,total,sold_by,request_id,amount_paid,campus,currency)
 values(nullif(trim(p_customer_name),''),p_payment_method,total_amount,auth.uid(),p_request_id,p_amount_paid,v_campus,v_currency) returning * into sale;
 for item in select (x->>'product_id')::uuid id, nullif(x->>'variant_id','')::uuid vid, sum((x->>'quantity')::integer)::integer qty
   from jsonb_array_elements(p_items) x group by 1,2 order by 1,2 loop
   select * into product from public.inventory_products where id=item.id;
   if product.has_variants then
     select * into variant from public.product_variants where id=item.vid;
     update public.product_variants set quantity_on_hand=quantity_on_hand-item.qty where id=item.vid;
   else
     update public.inventory_products set quantity_on_hand=quantity_on_hand-item.qty,updated_at=now() where id=product.id;
   end if;
   insert into public.pos_sale_items(sale_id,product_id,variant_id,size_label,product_name,unit_price,unit_cost,quantity,line_total)
   values(sale.id,product.id,item.vid,case when product.has_variants then variant.size else null end,product.name,product.selling_price,product.cost_price,item.qty,product.selling_price*item.qty);
 end loop;
 return sale;
end; $$;
revoke all on function public.complete_pos_sale(jsonb,text,text,uuid,numeric,text) from public,anon;
grant execute on function public.complete_pos_sale(jsonb,text,text,uuid,numeric,text) to authenticated;

create or replace function public.guard_uniform_order_currency()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from jsonb_array_elements(new.items) line
    join public.inventory_products p on p.id = nullif(line->>'product_id','')::uuid
    where p.currency <> new.currency
  ) then raise exception 'Uniform order currency must match every selected product'; end if;
  return new;
end;
$$;
revoke all on function public.guard_uniform_order_currency() from public, anon, authenticated;
drop trigger if exists uniform_order_currency_guard on public.parent_uniform_orders;
create trigger uniform_order_currency_guard before insert or update of items, currency
  on public.parent_uniform_orders for each row execute function public.guard_uniform_order_currency();

notify pgrst, 'reload schema';
commit;
