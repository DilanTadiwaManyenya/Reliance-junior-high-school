-- All synthetic products, receipts, stock changes and audit events roll back.
begin;
do $$
declare main_id uuid; actor record; product_id uuid:=gen_random_uuid(); variant_product uuid:=gen_random_uuid();
 variant_id uuid:=gen_random_uuid(); sale public.pos_sales; size_sale public.pos_sales; result public.pos_sales;
 request_id uuid:=gen_random_uuid(); denied integer:=0; before_qty integer; events_before integer;
begin
 select id into main_id from public.profiles where active_role='admin' and campus='all' and portal_access_enabled is distinct from false limit 1;
 if main_id is null then raise exception 'No Main Admin identity available for rollback test'; end if;
 perform set_config('request.jwt.claim.sub',main_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',main_id,'role','authenticated','aal','aal1')::text,true);
 set local role authenticated;
 insert into public.inventory_products(id,name,category,selling_price,cost_price,quantity_on_hand,campus,currency)
 values(product_id,'Rollback reversal unsized','Uniforms',25,10,5,'senior','USD'),
       (variant_product,'Rollback reversal sized','Uniforms',25,10,0,'junior','USD');
 insert into public.product_variants(id,product_id,size,quantity_on_hand) values(variant_id,variant_product,'Rollback size',5);
 select * into sale from public.complete_pos_sale(jsonb_build_array(jsonb_build_object('product_id',product_id,'quantity',1)),'cash','Rollback test only',request_id,30,'senior');
 select * into size_sale from public.complete_pos_sale(jsonb_build_array(jsonb_build_object('product_id',variant_product,'variant_id',variant_id,'quantity',1)),'cash','Rollback test only',gen_random_uuid(),25,'junior');
 reset role;
 for actor in select distinct on (active_role,campus) id,active_role,campus from public.profiles
   where active_role in ('admin','accountant','teacher','parent','principal') and id<>main_id and campus is distinct from 'all' and portal_access_enabled is distinct from false loop
   perform set_config('request.jwt.claim.sub',actor.id::text,true);
   perform set_config('request.jwt.claims',jsonb_build_object('sub',actor.id,'role','authenticated','aal','aal1')::text,true);
   set local role authenticated;
   begin
     perform public.reverse_pos_sale(sale.id,'Rollback unauthorized attempt');
     raise exception 'Unauthorized reversal unexpectedly succeeded';
   exception when insufficient_privilege then denied:=denied+1; end;
   reset role;
 end loop;
 if denied=0 then raise exception 'No non-Main-Admin identities tested'; end if;
 perform set_config('request.jwt.claim.sub',main_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',main_id,'role','authenticated','aal','aal1')::text,true);
 set local role authenticated;
 update public.product_variants set active=false where id=variant_id;
 perform public.reverse_pos_sale(sale.id,'Rollback mistaken sale');
 perform public.reverse_pos_sale(sale.id,'Rollback repeat request');
 perform public.reverse_pos_sale(size_sale.id,'Rollback mistaken size sale');
 if (select quantity_on_hand from public.inventory_products where id=product_id)<>5
   or (select quantity_on_hand from public.product_variants where id=variant_id)<>5
   or (select active from public.product_variants where id=variant_id) then raise exception 'Stock was not restored exactly once to its original size'; end if;
 select * into result from public.complete_pos_sale(jsonb_build_array(jsonb_build_object('product_id',product_id,'quantity',1)),'cash','Rollback test only',request_id,30,'senior');
 if result.status<>'reversed' or (select quantity_on_hand from public.inventory_products where id=product_id)<>5 then raise exception 'Original checkout was replayed after reversal'; end if;
 if (select count(*) from public.financial_events where record_id in (sale.id,size_sale.id) and action='sale_reversed')<>2
   or (select count(*) from public.pos_sale_items where sale_id in(sale.id,size_sale.id))<>2 then raise exception 'Audit or original receipt lines missing'; end if;
 reset role;
end $$;
select true as role_denials_passed,true as exact_stock_restored_once,true as hidden_size_preserved,
 true as checkout_replay_safe,true as originals_and_audit_preserved;
rollback;
