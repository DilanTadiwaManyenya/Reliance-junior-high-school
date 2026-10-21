begin;


alter table public.pos_sales add column if not exists status text not null default 'completed';
alter table public.pos_sales add column if not exists reversed_at timestamptz;
alter table public.pos_sales add column if not exists reversed_by uuid references public.profiles(id);
alter table public.pos_sales add column if not exists reversal_reason text;
alter table public.pos_sales add constraint pos_sale_reversal_state check (
 (status='completed' and reversed_at is null and reversed_by is null and reversal_reason is null) or
 (status='reversed' and reversed_at is not null and reversed_by is not null and reversal_reason is not null and length(btrim(reversal_reason)) between 5 and 1000)
);

-- Authoritative events commit with the financial operation. Browser click logs
-- remain supplementary. No backfill invents events for earlier transactions.
create table public.financial_events (
 id uuid primary key default gen_random_uuid(),
 created_at timestamptz not null default now(),
 module text not null,
 action text not null,
 record_id uuid not null,
 campus text check(campus in ('junior','senior')),
 currency text not null check(currency in ('USD','ZWG')),
 actor_id uuid,
 actor_name text,
 actor_role text,
 reason text,
 details jsonb not null,
 unique(module,action,record_id)
);
create index financial_events_campus_time on public.financial_events(campus,created_at desc,id);
alter table public.financial_events enable row level security;
revoke all on public.financial_events from public,anon,authenticated;
grant select on public.financial_events to authenticated;
create policy "POS staff read scoped financial events" on public.financial_events for select to authenticated
 using(public.is_main_school_admin() or (module='pos' and public.can_read_shop_campus(campus)));
create policy "Respect existing admin session security" on public.financial_events as restrictive for all to authenticated
 using(public.portal_mfa_satisfied()) with check(public.portal_mfa_satisfied());

create function public.audit_pos_financial_event() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 insert into public.financial_events(module,action,record_id,campus,currency,actor_id,actor_name,actor_role,details)
 select 'pos','sale_recorded',new.id,new.campus,new.currency,auth.uid(),p.full_name,coalesce(p.active_role,p.role),
 jsonb_build_object('sale',to_jsonb(new)) from public.profiles p where p.id=auth.uid();
 if not found then raise exception 'An authenticated financial actor is required'; end if;
 return new;
end $$;
revoke all on function public.audit_pos_financial_event() from public,anon,authenticated;
create trigger pos_financial_event after insert on public.pos_sales for each row execute function public.audit_pos_financial_event();

create function public.audit_pos_line_event() returns trigger
language plpgsql security definer set search_path=public as $$
declare sale public.pos_sales; stock_after integer;
begin
 select * into sale from public.pos_sales where id=new.sale_id;
 if new.variant_id is null then select quantity_on_hand into stock_after from public.inventory_products where id=new.product_id;
 else select quantity_on_hand into stock_after from public.product_variants where id=new.variant_id; end if;
 insert into public.financial_events(module,action,record_id,campus,currency,actor_id,actor_name,actor_role,details)
 select 'pos','sale_line_recorded',new.id,sale.campus,sale.currency,auth.uid(),p.full_name,coalesce(p.active_role,p.role),
 jsonb_build_object('sale_id',sale.id,'receipt_number',sale.receipt_number,'line',to_jsonb(new),'stock_before',stock_after+new.quantity,'stock_after',stock_after)
 from public.profiles p where p.id=auth.uid();
 if not found then raise exception 'An authenticated financial actor is required'; end if;
 return new;
end $$;
revoke all on function public.audit_pos_line_event() from public,anon,authenticated;
create trigger pos_line_financial_event after insert on public.pos_sale_items for each row execute function public.audit_pos_line_event();

create function public.reverse_pos_sale(p_sale_id uuid,p_reason text)
returns public.pos_sales language plpgsql security definer set search_path=public as $$
declare sale public.pos_sales; original public.pos_sales; item record;
 product public.inventory_products; variant public.product_variants;
 stock_changes jsonb:='[]'::jsonb;
begin
 if auth.uid() is null or not coalesce(public.is_main_school_admin(),false) then
   raise exception 'Only Main Admin can reverse a POS sale' using errcode='42501';
 end if;
 if not coalesce(public.portal_mfa_satisfied(),false) then raise exception 'Complete your required admin sign-in verification' using errcode='42501'; end if;
 if p_reason is null or length(btrim(p_reason)) not between 5 and 1000 then raise exception 'Enter a reversal reason of 5 to 1000 characters'; end if;
 select * into sale from public.pos_sales where id=p_sale_id for update;
 if not found then raise exception 'Sale not found'; end if;
 if sale.status='reversed' then return sale; end if;
 if sale.campus is null or sale.campus not in ('junior','senior') then raise exception 'Legacy sale requires campus review before reversal'; end if;
 if not exists(select 1 from public.pos_sale_items where sale_id=sale.id) then raise exception 'Sale has no stock lines; review before reversal'; end if;
 original:=sale;
 -- Same deterministic product/size order as checkout. Restore hidden stock too.
 for item in select product_id,variant_id,size_label,sum(quantity)::integer qty
   from public.pos_sale_items where sale_id=sale.id group by 1,2,3 order by 1,2 loop
   select * into product from public.inventory_products where id=item.product_id for update;
   if not found or product.campus is distinct from sale.campus then raise exception 'Sold product is missing or changed campus; review before reversal'; end if;
   if item.variant_id is not null then
     select * into variant from public.product_variants where id=item.variant_id and product_id=item.product_id for update;
     if not found or variant.size is distinct from item.size_label then raise exception 'Sold size is missing or changed; review before reversal'; end if;
     update public.product_variants set quantity_on_hand=quantity_on_hand+item.qty where id=variant.id;
     stock_changes:=stock_changes||jsonb_build_array(jsonb_build_object('product_id',product.id,'variant_id',variant.id,'size',item.size_label,'quantity',item.qty,'before',variant.quantity_on_hand,'after',variant.quantity_on_hand+item.qty));
   else
     if product.has_variants then raise exception 'Unsized product now has sizes; review stock allocation before reversal'; end if;
     update public.inventory_products set quantity_on_hand=quantity_on_hand+item.qty,updated_at=now() where id=product.id;
     stock_changes:=stock_changes||jsonb_build_array(jsonb_build_object('product_id',product.id,'variant_id',null,'quantity',item.qty,'before',product.quantity_on_hand,'after',product.quantity_on_hand+item.qty));
   end if;
 end loop;
 update public.pos_sales set status='reversed',reversed_at=now(),reversed_by=auth.uid(),reversal_reason=btrim(p_reason)
   where id=sale.id returning * into sale;
 insert into public.financial_events(module,action,record_id,campus,currency,actor_id,actor_name,actor_role,reason,details)
 select 'pos','sale_reversed',sale.id,sale.campus,sale.currency,auth.uid(),p.full_name,coalesce(p.active_role,p.role),sale.reversal_reason,
 jsonb_build_object('before',to_jsonb(original),'after',to_jsonb(sale),'stock_changes',stock_changes,
 'lines',(select jsonb_agg(to_jsonb(l)) from public.pos_sale_items l where l.sale_id=sale.id),
 'settlement','Reversal does not refund money; review settlement separately')
 from public.profiles p where p.id=auth.uid();
 if not found then raise exception 'An authenticated financial actor is required'; end if;
 insert into public.shop_audit(action,details,actor) values('POS_SALE_REVERSED',
 jsonb_build_object('sale_id',sale.id,'receipt_number',sale.receipt_number,'campus',sale.campus,'currency',sale.currency,
 'reason',sale.reversal_reason,'stock_changes',stock_changes,'total',sale.total),auth.uid());
 return sale;
end $$;
revoke all on function public.reverse_pos_sale(uuid,text) from public,anon;
grant execute on function public.reverse_pos_sale(uuid,text) to authenticated;
-- Client updates/deletes must never bypass the controlled reversal function.
revoke insert,update,delete on public.pos_sales,public.pos_sale_items from authenticated,anon;
notify pgrst,'reload schema';


-- All synthetic products, receipts, stock changes and audit events roll back.

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

