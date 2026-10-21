begin;
alter table public.pos_sales add column student_id uuid references public.students(id) on delete restrict;
alter table public.pos_sales add column payment_tracking boolean not null default false;
alter table public.pos_sales add column paid_total numeric(12,2) check(paid_total>=0 and paid_total<=total);
alter table public.pos_sales add column balance_due numeric(12,2) generated always as
 (case when status='reversed' then 0 else greatest(total-coalesce(paid_total,total),0) end) stored;
alter table public.pos_sales add column issued_at timestamptz;
alter table public.pos_sales add constraint tracked_pos_sale_has_payment_state check(not payment_tracking or (paid_total is not null and issued_at is not null));

create table public.pos_payments (
 id uuid primary key default gen_random_uuid(),
 sale_id uuid not null references public.pos_sales(id) on delete restrict,
 request_id uuid not null unique,
 amount numeric(12,2) not null check(amount>0 and amount::text not in ('NaN','Infinity','-Infinity')),
 tendered numeric(12,2) not null check(tendered>=amount and tendered::text not in ('NaN','Infinity','-Infinity')),
 change_due numeric(12,2) generated always as(tendered-amount) stored,
 currency text not null check(currency in ('USD','ZWG')),
 campus text not null check(campus in ('junior','senior')),
 payment_method text not null check(payment_method in ('cash','ecocash','swipe','transfer')),
 reference_number text,
 received_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now(),
 paid_on date not null default ((now() at time zone 'Africa/Harare')::date)
);
create index pos_payments_sale_time on public.pos_payments(sale_id,created_at,id);
alter table public.pos_payments enable row level security;
revoke all on public.pos_payments from public,anon,authenticated;
grant select on public.pos_payments to authenticated;
create policy "Campus staff read POS payments" on public.pos_payments for select to authenticated using(public.can_read_shop_campus(campus));
create policy "Respect admin session verification" on public.pos_payments as restrictive for all to authenticated
 using(public.portal_mfa_satisfied()) with check(public.portal_mfa_satisfied());

create function public.record_pos_payment(p_sale_id uuid,p_tendered numeric,p_payment_method text,p_request_id uuid,p_reference text default null)
returns public.pos_payments language plpgsql security definer set search_path=public as $$
declare sale public.pos_sales; payment public.pos_payments; applied numeric(12,2); previous_paid numeric(12,2); previous_balance numeric(12,2);
begin
 if auth.uid() is null or not coalesce(public.portal_mfa_satisfied(),false) then raise exception 'Sign in with your required verification' using errcode='42501'; end if;
 select * into sale from public.pos_sales where id=p_sale_id for update;
 if not found or not coalesce(public.can_read_shop_campus(sale.campus),false) then raise exception 'Payment access is restricted to the sale campus' using errcode='42501'; end if;
 if p_request_id is null then raise exception 'A payment request ID is required'; end if;
 perform pg_advisory_xact_lock(hashtextextended('pos-payment:'||p_request_id::text,0));
 select * into payment from public.pos_payments where request_id=p_request_id;
 if found then
   if payment.sale_id<>sale.id or payment.received_by<>auth.uid() then raise exception 'Request belongs to another sale or cashier'; end if;
   return payment;
 end if;
 if sale.status='reversed' then raise exception 'A reversed sale cannot receive payments'; end if;
 if not sale.payment_tracking or sale.balance_due<=0 then raise exception 'This receipt has no outstanding balance'; end if;
 if p_tendered is null or p_tendered::text in ('NaN','Infinity','-Infinity') or p_tendered<=0 or p_tendered<>round(p_tendered,2) then raise exception 'Enter a positive amount with at most two decimal places'; end if;
 if p_payment_method is null or p_payment_method not in ('cash','ecocash','swipe','transfer') then raise exception 'Invalid payment method'; end if;
 if length(coalesce(p_reference,''))>200 then raise exception 'Payment reference is too long'; end if;
 applied:=least(p_tendered,sale.balance_due);
 previous_paid:=sale.paid_total; previous_balance:=sale.balance_due;
 insert into public.pos_payments(sale_id,request_id,amount,tendered,currency,campus,payment_method,reference_number,received_by)
 values(sale.id,p_request_id,applied,p_tendered,sale.currency,sale.campus,p_payment_method,nullif(btrim(p_reference),''),auth.uid()) returning * into payment;
 update public.pos_sales set paid_total=coalesce(paid_total,0)+applied where id=sale.id returning * into sale;
 insert into public.financial_events(module,action,record_id,campus,currency,actor_id,actor_name,actor_role,details)
 select 'pos','payment_recorded',payment.id,sale.campus,sale.currency,auth.uid(),p.full_name,coalesce(p.active_role,p.role),
 jsonb_build_object('sale_id',sale.id,'receipt_number',sale.receipt_number,'student_id',sale.student_id,'payment',to_jsonb(payment),'previous_paid_total',previous_paid,'previous_balance_due',previous_balance,'paid_total',sale.paid_total,'balance_due',sale.balance_due)
 from public.profiles p where p.id=auth.uid();
 if not found then raise exception 'An authenticated payment actor is required'; end if;
 return payment;
end $$;
revoke all on function public.record_pos_payment(uuid,numeric,text,uuid,text) from public,anon;
grant execute on function public.record_pos_payment(uuid,numeric,text,uuid,text) to authenticated;

create function public.complete_pos_sale(p_items jsonb,p_payment_method text,p_customer_name text,p_request_id uuid,p_amount_paid numeric,p_campus text,p_student_id uuid)
returns public.pos_sales language plpgsql security definer set search_path=public as $$
declare item record; product public.inventory_products; variant public.product_variants; sale public.pos_sales;
 total_amount numeric(12,2):=0; v_currency text; learner public.students;
begin
 if auth.uid() is null or p_campus is null or p_campus not in ('junior','senior') or not coalesce(public.can_read_shop_campus(p_campus),false)
   or not coalesce(public.portal_mfa_satisfied(),false) then raise exception 'POS access is restricted to your assigned campus and verified session' using errcode='42501'; end if;
 if p_request_id is null or p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 200 then raise exception 'A valid checkout is required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
 select * into sale from public.pos_sales where request_id=p_request_id;
 if found then
   if sale.sold_by<>auth.uid() or sale.campus is distinct from p_campus then raise exception 'Request belongs to another staff member or campus'; end if;
   return sale;
 end if;
 if p_amount_paid is null or p_amount_paid::text in ('NaN','Infinity','-Infinity') or p_amount_paid<=0 or p_amount_paid<>round(p_amount_paid,2) then raise exception 'Enter a positive payment with at most two decimal places'; end if;
 if p_payment_method is null or p_payment_method not in ('cash','ecocash','swipe','transfer') then raise exception 'Invalid payment method'; end if;
 if p_student_id is not null then
   select * into learner from public.students where id=p_student_id for share;
   if not found or learner.campus is distinct from p_campus or learner.status is distinct from 'active' then raise exception 'Choose an active learner in the sale campus'; end if;
 end if;
 if exists(select 1 from jsonb_array_elements(p_items) x where x->>'product_id' is null or x->>'quantity' is null or (x->>'quantity') !~ '^[1-9][0-9]*$') then raise exception 'Invalid cart quantity'; end if;
 for item in select (x->>'product_id')::uuid id,nullif(x->>'variant_id','')::uuid vid,sum((x->>'quantity')::integer)::integer qty
   from jsonb_array_elements(p_items) x group by 1,2 order by 1,2 loop
   select * into product from public.inventory_products where id=item.id and active and campus=p_campus for update;
   if not found then raise exception 'Product unavailable in your campus'; end if;
   if v_currency is null then v_currency:=product.currency; elsif v_currency<>product.currency then raise exception 'A POS sale cannot mix USD and ZWG items'; end if;
   if product.has_variants then
     select * into variant from public.product_variants where id=item.vid and product_id=product.id and active for update;
     if not found or variant.quantity_on_hand<item.qty then raise exception 'Size unavailable or insufficient size stock'; end if;
   elsif item.vid is not null or product.quantity_on_hand<item.qty then raise exception 'Product unavailable or insufficient stock'; end if;
   total_amount:=total_amount+product.selling_price*item.qty;
 end loop;
 if total_amount::text in ('NaN','Infinity','-Infinity') or total_amount<=0 then raise exception 'Set a positive selling price before checkout'; end if;
 if p_amount_paid<total_amount and p_student_id is null then raise exception 'Select a learner before allowing an unpaid balance'; end if;
 insert into public.pos_sales(customer_name,payment_method,total,sold_by,request_id,amount_paid,campus,currency,student_id,payment_tracking,paid_total,issued_at)
 values(coalesce(nullif(btrim(p_customer_name),''),learner.full_name),p_payment_method,total_amount,auth.uid(),p_request_id,p_amount_paid,p_campus,v_currency,p_student_id,true,0,now()) returning * into sale;
 for item in select (x->>'product_id')::uuid id,nullif(x->>'variant_id','')::uuid vid,sum((x->>'quantity')::integer)::integer qty
   from jsonb_array_elements(p_items) x group by 1,2 order by 1,2 loop
   select * into product from public.inventory_products where id=item.id;
   if product.has_variants then
     select * into variant from public.product_variants where id=item.vid;
     update public.product_variants set quantity_on_hand=quantity_on_hand-item.qty where id=item.vid;
   else update public.inventory_products set quantity_on_hand=quantity_on_hand-item.qty,updated_at=now() where id=product.id; end if;
   insert into public.pos_sale_items(sale_id,product_id,variant_id,size_label,product_name,unit_price,unit_cost,quantity,line_total)
   values(sale.id,product.id,item.vid,case when product.has_variants then variant.size else null end,product.name,product.selling_price,product.cost_price,item.qty,product.selling_price*item.qty);
 end loop;
 perform public.record_pos_payment(sale.id,p_amount_paid,p_payment_method,p_request_id,null);
 select * into sale from public.pos_sales where id=sale.id;
 return sale;
end $$;
revoke all on function public.complete_pos_sale(jsonb,text,text,uuid,numeric,text,uuid) from public,anon;
grant execute on function public.complete_pos_sale(jsonb,text,text,uuid,numeric,text,uuid) to authenticated;
-- Old clients stay full-payment-only unless they supply a validated learner.
create or replace function public.complete_pos_sale(p_items jsonb,p_payment_method text,p_customer_name text,p_request_id uuid,p_amount_paid numeric,p_campus text)
returns public.pos_sales language sql security definer set search_path=public as $$
 select public.complete_pos_sale(p_items,p_payment_method,p_customer_name,p_request_id,p_amount_paid,p_campus,null::uuid);
$$;

-- Curated parent response avoids exposing staff-only reversal reasons/IDs or
-- opening staff POS tables to parent tokens. Orders remain separate from sales.
create function public.parent_pos_receipts(p_student_id uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare receipts jsonb;
begin
 if auth.uid() is null or not coalesce(public.has_active_role('parent'),false) or not exists(
   select 1 from public.parent_student where parent_id=auth.uid() and student_id=p_student_id and verified_at is not null
 ) then raise exception 'A verified parent/learner link is required' using errcode='42501'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) into receipts from (
   select s.id,s.receipt_number,s.created_at,s.issued_at,s.status,s.total,s.currency,s.paid_total,s.balance_due,
     (select coalesce(jsonb_agg(jsonb_build_object('product_name',l.product_name,'size_label',l.size_label,'quantity',l.quantity,'unit_price',l.unit_price)),'[]'::jsonb) from public.pos_sale_items l where l.sale_id=s.id) as items,
     (select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'created_at',p.created_at,'amount',p.amount,'payment_method',p.payment_method) order by p.created_at,p.id),'[]'::jsonb) from public.pos_payments p where p.sale_id=s.id) as payments
   from public.pos_sales s where s.student_id=p_student_id order by s.created_at desc,s.id desc limit 20
 ) r;
 return receipts;
end $$;
revoke all on function public.parent_pos_receipts(uuid) from public,anon;
grant execute on function public.parent_pos_receipts(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
