begin;

-- Reuse the existing active-role and verified parent/student relationship model.
create or replace function public.parent_has_verified_shop_student(requested_student_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select public.has_active_role('parent') and exists(select 1 from public.parent_student ps
   where ps.parent_id=auth.uid() and ps.student_id=requested_student_id and ps.verified_at is not null);
$$;
create or replace function public.parent_shop_student_campus(requested_student_id uuid)
returns text language sql stable security definer set search_path=public as $$
 select s.campus from public.students s where s.id=requested_student_id and s.status='active'
   and s.campus in ('junior','senior') and public.parent_has_verified_shop_student(s.id);
$$;
create or replace function public.parent_can_browse_shop_campus(target_campus text)
returns boolean language sql stable security definer set search_path=public as $$
 select public.has_active_role('parent') and target_campus in ('junior','senior') and exists(
   select 1 from public.parent_student ps join public.students s on s.id=ps.student_id
   where ps.parent_id=auth.uid() and ps.verified_at is not null and s.status='active' and s.campus=target_campus);
$$;
revoke all on function public.parent_has_verified_shop_student(uuid),public.parent_shop_student_campus(uuid),public.parent_can_browse_shop_campus(text) from public,anon;
grant execute on function public.parent_has_verified_shop_student(uuid),public.parent_shop_student_campus(uuid),public.parent_can_browse_shop_campus(text) to authenticated;

drop policy if exists "Parents browse stocked uniform products" on public.inventory_products;
create policy "Parents browse stocked uniform products" on public.inventory_products for select to authenticated
 using(category='Uniforms' and active and public.parent_can_browse_shop_campus(campus));
drop policy if exists "Parents browse active sizes" on public.product_variants;
create policy "Parents browse active sizes" on public.product_variants for select to authenticated
 using(active and exists(select 1 from public.inventory_products p where p.id=product_id and p.category='Uniforms'
   and p.active and public.parent_can_browse_shop_campus(p.campus)));

drop policy if exists "Parents create orders for linked learners" on public.parent_uniform_orders;
create policy "Parents create orders for linked learners" on public.parent_uniform_orders for insert to authenticated
 with check(parent_id=auth.uid() and public.parent_shop_student_campus(student_id) is not null);
drop policy if exists "Parents view their orders" on public.parent_uniform_orders;
create policy "Parents view their orders" on public.parent_uniform_orders for select to authenticated
 using(parent_id=auth.uid() and public.parent_has_verified_shop_student(student_id));

-- Preserve the established staff workflow, but prevent campus accountants from
-- reading or managing another campus's uniform orders through its broad old policy.
drop policy if exists "Staff manage uniform orders" on public.parent_uniform_orders;
drop policy if exists "Main Admin and accountants manage uniform orders" on public.parent_uniform_orders;
drop policy if exists "Scoped staff manage uniform orders" on public.parent_uniform_orders;
create policy "Scoped staff manage uniform orders" on public.parent_uniform_orders for all to authenticated
 using(public.is_main_school_admin() or (public.has_active_role('accountant') and exists(select 1 from public.students s where s.id=student_id and public.can_read_shop_campus(s.campus))))
 with check(public.is_main_school_admin() or (public.has_active_role('accountant') and exists(select 1 from public.students s where s.id=student_id and public.can_read_shop_campus(s.campus))));

create or replace function public.snapshot_parent_catalog_items()
returns trigger language plpgsql security definer set search_path=public as $$
declare line jsonb; p public.inventory_products; v public.product_variants; qty integer;
  snapshot jsonb:='[]'; amount numeric(12,2):=0; size_name text; variant_uuid uuid; learner_campus text;
begin
 if auth.uid() is null then raise exception 'Authentication is required' using errcode='42501'; end if;
 if public.has_active_role('parent') then
   learner_campus:=public.parent_shop_student_campus(new.student_id);
   if new.parent_id is distinct from auth.uid() or learner_campus is null then
     raise exception 'A verified active learner with a campus is required for this parent' using errcode='42501';
   end if;
 else
   select campus into learner_campus from public.students where id=new.student_id and status='active' and campus in ('junior','senior') for share;
   if learner_campus is null or not coalesce(public.is_main_school_admin() or (public.has_active_role('accountant') and public.can_read_shop_campus(learner_campus)),false)
      or not exists(select 1 from public.parent_student ps where ps.parent_id=new.parent_id and ps.student_id=new.student_id and ps.verified_at is not null) then
     raise exception 'Only authorized staff may submit orders for verified learners in their campus' using errcode='42501';
   end if;
 end if;
 if exists(select 1 from jsonb_array_elements(new.items) x where coalesce(x->>'quantity','') !~ '^[1-9][0-9]*$') then raise exception 'Invalid order quantity'; end if;
 for line in select jsonb_build_object('product_id',x->>'product_id','variant_id',x->>'variant_id','quantity',sum((x->>'quantity')::integer))
   from jsonb_array_elements(new.items) x group by x->>'product_id',x->>'variant_id' order by x->>'product_id',x->>'variant_id' loop
   qty:=(line->>'quantity')::integer;
   select * into p from public.inventory_products where id=(line->>'product_id')::uuid and active and category='Uniforms' and campus=learner_campus for share;
   if not found then raise exception 'Uniform product unavailable for this learner’s campus'; end if;
   size_name:=null; variant_uuid:=nullif(line->>'variant_id','')::uuid;
   if p.has_variants then
     select * into v from public.product_variants where id=variant_uuid and product_id=p.id and active for share;
     if not found or v.quantity_on_hand<qty then raise exception 'Size unavailable or insufficient size stock'; end if;
     size_name:=v.size;
   elsif variant_uuid is not null or p.quantity_on_hand<qty then raise exception 'Product unavailable or insufficient stock';
   end if;
   snapshot:=snapshot || jsonb_build_array(jsonb_build_object('product_id',p.id,'variant_id',variant_uuid,'size_label',size_name,
     'name',p.name,'unit_price',p.selling_price,'quantity',qty));
   amount:=amount+p.selling_price*qty;
 end loop;
 new.items:=snapshot; new.total:=amount;
 return new;
end; $$;
revoke all on function public.snapshot_parent_catalog_items() from public;
drop trigger if exists snapshot_parent_catalog_items on public.parent_uniform_orders;
create trigger snapshot_parent_catalog_items before insert on public.parent_uniform_orders for each row execute function public.snapshot_parent_catalog_items();

notify pgrst,'reload schema';
commit;
