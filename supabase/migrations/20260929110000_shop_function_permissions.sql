-- Supabase default privileges can grant EXECUTE directly to anon as well as PUBLIC.
revoke all on function public.complete_pos_sale(jsonb,text,text,uuid,numeric) from public, anon;
revoke all on function public.adjust_shop_stock(uuid,integer,text) from public, anon;
revoke all on function public.audit_shop_change() from public, anon, authenticated;
grant execute on function public.complete_pos_sale(jsonb,text,text,uuid,numeric) to authenticated;
grant execute on function public.adjust_shop_stock(uuid,integer,text) to authenticated;
revoke all on public.shop_audit from anon, authenticated;
grant select on public.shop_audit to authenticated;
revoke all on public.shop_settings from anon, authenticated;
grant select,update on public.shop_settings to authenticated;
