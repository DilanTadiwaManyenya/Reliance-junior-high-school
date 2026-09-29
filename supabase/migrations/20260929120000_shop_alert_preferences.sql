-- Shop notification preferences. Delivery remains disabled until a WhatsApp provider is connected.
alter table public.shop_settings
  add column if not exists low_stock_alerts_enabled boolean not null default true,
  add column if not exists alert_phone text;

update public.shop_settings
set low_stock_alerts_enabled = coalesce(low_stock_alerts_enabled, true)
where id = true;
