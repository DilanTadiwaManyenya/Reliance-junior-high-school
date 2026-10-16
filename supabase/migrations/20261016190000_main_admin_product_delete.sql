begin;

-- Catalog creation/editing remains campus-scoped; permanent deletion is Main Admin-only.
drop policy if exists "Campus admins manage inventory" on public.inventory_products;
create policy "Campus admins insert inventory" on public.inventory_products for insert to authenticated with check(public.can_manage_shop_campus(campus));
create policy "Campus admins update inventory" on public.inventory_products for update to authenticated using(public.can_manage_shop_campus(campus)) with check(public.can_manage_shop_campus(campus));
create policy "Main Admin deletes inventory" on public.inventory_products for delete to authenticated using(public.is_main_school_admin());

-- Retain only replay-prevention tokens, not deleted receipt/customer history.
create table public.shop_retired_checkout_requests(request_id uuid primary key,retired_at timestamptz not null default now());
alter table public.shop_retired_checkout_requests enable row level security;
revoke all on public.shop_retired_checkout_requests from public,anon,authenticated;
create function public.reject_retired_shop_checkout() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if exists(select 1 from public.shop_retired_checkout_requests where request_id=new.request_id) then
  raise exception 'This test checkout was cleared by Main Admin. Clear the old pending basket and start a new sale.';
 end if;
 return new;
end; $$;
revoke all on function public.reject_retired_shop_checkout() from public,anon,authenticated;
create trigger reject_retired_shop_checkout before insert on public.pos_sales for each row execute function public.reject_retired_shop_checkout();

notify pgrst,'reload schema';
commit;
