alter table public.parent_uniform_orders
  add column if not exists payment_method text not null default 'ecocash',
  add column if not exists payer_phone text,
  add column if not exists transaction_reference text;

alter table public.parent_uniform_orders
  alter column ecocash_phone drop not null;

alter table public.parent_uniform_orders
  drop constraint if exists parent_uniform_orders_payment_method_check;

alter table public.parent_uniform_orders
  add constraint parent_uniform_orders_payment_method_check
  check (payment_method in ('ecocash', 'bank_transfer', 'card', 'cash_collection'));

update public.parent_uniform_orders
set payment_method = 'ecocash',
    payer_phone = coalesce(payer_phone, ecocash_phone),
    transaction_reference = coalesce(transaction_reference, ecocash_reference)
where payment_method is null or payment_method = 'ecocash';
