create table if not exists public.parent_uniform_orders (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete restrict,
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) > 0),
  total numeric(12,2) not null check (total > 0),
  ecocash_phone text not null,
  ecocash_reference text,
  payment_status text not null default 'pending' check (payment_status in ('pending','verified','rejected')),
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  verified_by uuid references public.profiles(id)
);

alter table public.parent_uniform_orders enable row level security;

create policy "Parents create orders for linked learners" on public.parent_uniform_orders for insert to authenticated
  with check (parent_id = auth.uid() and exists (select 1 from public.parent_student ps where ps.parent_id = auth.uid() and ps.student_id = parent_uniform_orders.student_id and ps.verified_at is not null));
create policy "Parents view their orders" on public.parent_uniform_orders for select to authenticated using (parent_id = auth.uid());
create policy "Staff manage uniform orders" on public.parent_uniform_orders for all to authenticated using (public.is_admin() or public.has_active_role('accountant')) with check (public.is_admin() or public.has_active_role('accountant'));

-- Parents may browse only stocked uniform products; other inventory remains staff-only.
drop policy if exists "Parents browse stocked uniform products" on public.inventory_products;
create policy "Parents browse stocked uniform products" on public.inventory_products for select to authenticated
  using (category = 'Uniforms' and active = true and quantity_on_hand > 0 and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'parent'));
