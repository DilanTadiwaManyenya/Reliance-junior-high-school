-- Synthetic admissions/fees, links, stock, sales, payments and audits roll back.
begin;
do $$
declare main_id uuid; cashier uuid; parent_id uuid; learner uuid:=gen_random_uuid(); other_learner uuid:=gen_random_uuid();
 product_id uuid:=gen_random_uuid(); sale public.pos_sales; cancelled public.pos_sales;
 payment public.pos_payments; retried public.pos_payments; request_id uuid:=gen_random_uuid(); receipts jsonb;
begin
 select id into main_id from public.profiles where active_role='admin' and campus='all' and portal_access_enabled is distinct from false limit 1;
 select id into cashier from public.profiles where active_role='accountant' and campus='senior' and portal_access_enabled is distinct from false limit 1;
 select id into parent_id from public.profiles where active_role='parent' and portal_access_enabled is distinct from false limit 1;
 if main_id is null or cashier is null or parent_id is null then raise exception 'Main Admin, Senior accountant and parent identities are required'; end if;
 insert into public.students(id,full_name,date_of_birth,class_level,class_stream,enrolled_year,status,campus)
 values(learner,'Rollback partial payment learner','2012-02-29','Form 3','Blue',2098,'active','senior'),
 (other_learner,'Rollback unlinked learner','2012-02-29','Form 3','Blue',2098,'active','senior');
 insert into public.parent_student(parent_id,student_id,verified_at) values(parent_id,learner,now());
 perform set_config('request.jwt.claim.sub',main_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',main_id,'role','authenticated','aal','aal1')::text,true);
 set local role authenticated;
 insert into public.inventory_products(id,name,category,selling_price,cost_price,quantity_on_hand,campus,currency)
 values(product_id,'Rollback partial payment jacket','Uniforms',25,10,5,'senior','USD');
 reset role;
 perform set_config('request.jwt.claim.sub',cashier::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',cashier,'role','authenticated','aal','aal1')::text,true);
 set local role authenticated;
 select * into sale from public.complete_pos_sale(jsonb_build_array(jsonb_build_object('product_id',product_id,'quantity',1)),'cash','Rollback only',gen_random_uuid(),20,'senior',learner);
 if sale.total<>25 or sale.paid_total<>20 or sale.balance_due<>5 or sale.issued_at is null then raise exception '25/20/5 issued-sale assertion failed'; end if;
 select * into payment from public.record_pos_payment(sale.id,10,'cash',request_id,'Rollback later payment');
 select * into retried from public.record_pos_payment(sale.id,10,'cash',request_id,'Rollback later payment');
 if payment.amount<>5 or payment.change_due<>5 or payment.id<>retried.id then raise exception 'Final payment/change/retry assertion failed'; end if;
 select * into sale from public.pos_sales where id=sale.id;
 if sale.paid_total<>25 or sale.balance_due<>0 or (select quantity_on_hand from public.inventory_products where id=product_id)<>4
   or (select count(*) from public.pos_payments where sale_id=sale.id)<>2 then raise exception 'Stock/payment count or settled balance incorrect'; end if;
 reset role;
 perform set_config('request.jwt.claim.sub',parent_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',parent_id,'role','authenticated','aal','aal1')::text,true);
 set local role authenticated;
 receipts:=public.parent_pos_receipts(learner);
 if jsonb_array_length(receipts)<>1 or (receipts->0->>'paid_total')::numeric<>25 or receipts->0 ? 'reversal_reason' or receipts->0 ? 'sold_by' then raise exception 'Parent receipt/isolation assertion failed'; end if;
 begin
   perform public.parent_pos_receipts(other_learner);
   raise exception 'Unlinked parent receipt unexpectedly readable';
 exception when insufficient_privilege then null; end;
 begin
   perform public.record_pos_payment(sale.id,5,'cash',gen_random_uuid(),null);
   raise exception 'Parent unexpectedly recorded a payment';
 exception when insufficient_privilege then null; end;
 reset role;
 perform set_config('request.jwt.claim.sub',main_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',main_id,'role','authenticated','aal','aal1')::text,true);
 set local role authenticated;
 select * into cancelled from public.complete_pos_sale(jsonb_build_array(jsonb_build_object('product_id',product_id,'quantity',1)),'cash','Rollback only',gen_random_uuid(),20,'senior',learner);
 select * into cancelled from public.reverse_pos_sale(cancelled.id,'Rollback mistaken partial sale');
 if cancelled.balance_due<>0 or cancelled.paid_total<>20 or (select count(*) from public.pos_payments where sale_id=cancelled.id)<>1
   or (select quantity_on_hand from public.inventory_products where id=product_id)<>4 then raise exception 'Partial sale reversal lost payment history or stock'; end if;
 reset role;
end $$;
select true as partial_25_20_5_passed,true as later_payment_no_stock_change,true as payment_retry_and_change_passed,
 true as parent_isolation_passed,true as partial_reversal_preserves_payment;
rollback;
