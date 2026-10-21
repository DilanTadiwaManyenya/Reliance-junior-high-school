-- Read-only finance/audit discovery. Returns structure and aggregate counts only.
begin read only;
select 'columns' as section, coalesce(jsonb_agg(jsonb_build_object('table',table_name,'column',column_name,'type',data_type) order by table_name,ordinal_position),'[]') as findings
from information_schema.columns where table_schema='public' and table_name in
('pos_sales','pos_sale_items','fee_payments','fee_balances','finance_audit','shop_audit','audit_logs','school_record_changes','parent_uniform_orders')
union all
select 'triggers' as section, coalesce(jsonb_agg(jsonb_build_object('table',c.relname,'trigger',t.tgname,'definition',pg_get_triggerdef(t.oid)) order by c.relname,t.tgname),'[]') as findings
from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and not t.tgisinternal and c.relname in
('pos_sales','pos_sale_items','inventory_products','product_variants','fee_payments','fee_balances','school_expenses','audit_logs','shop_audit','finance_audit')
union all
select 'policies' as section, coalesce(jsonb_agg(jsonb_build_object('table',tablename,'policy',policyname,'mode',permissive,'command',cmd,'using',qual,'check',with_check) order by tablename,policyname),'[]') as findings
from pg_policies where schemaname='public' and tablename in ('pos_sales','pos_sale_items','fee_payments','fee_balances','school_expenses','audit_logs','shop_audit','finance_audit')
union all
select 'functions' as section, coalesce(jsonb_agg(jsonb_build_object('name',p.proname,'arguments',pg_get_function_identity_arguments(p.oid),'definition',pg_get_functiondef(p.oid)) order by p.proname),'[]') as findings
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and
(p.proname in ('complete_pos_sale','record_learner_fee_payment','audit_shop_change','audit_school_expense','can_read_audit_log','can_read_shop_campus','is_main_school_admin') or p.proname ~ '(reverse|refund|void).*(pos|sale|fee|expense)')
union all
select 'student_role_counts' as section, jsonb_build_object(
 'student_profiles',(select count(*) from public.profiles where role::text='student' or active_role::text='student'),
 'student_memberships',(select count(*) from public.user_roles where role::text='student'),
 'student_activity_events',(select count(*) from public.audit_logs where actor_role::text='student')) as findings
union all
select 'client_table_privileges' as section, jsonb_agg(jsonb_build_object('table',t.name,
 'insert',has_table_privilege('authenticated','public.'||t.name,'INSERT'),
 'update',has_table_privilege('authenticated','public.'||t.name,'UPDATE'),
 'delete',has_table_privilege('authenticated','public.'||t.name,'DELETE')))
from unnest(array['pos_sales','pos_sale_items','fee_payments','fee_balances','audit_logs','shop_audit','finance_audit']) t(name);
commit;
