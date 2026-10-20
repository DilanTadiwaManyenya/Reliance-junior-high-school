# Stage 13 — Zimbabwe configuration

## Implemented

- Primary, O Level and A Level bands are already administrator-configurable in `grade_bands`. The live project currently has complete 0–100 coverage: 9 Primary bands, 5 O Level bands and 7 A Level bands.
- Before this stage, the grade-band editor's checker and teacher mark previews used hard-coded thresholds even when the database contained a different configured scale. They now use the configured rows.
- New report-period snapshots now capture the configured grade scale. The 63 existing `report_period_contexts` were not changed. A school-approved correction of a historical class continues to record the selected class and current scale through the existing audited review process.
- Finance policy is USD and ZWG per record with no exchange conversion. The migrations add currency columns (default USD) to learner balances/payments, class fee schedules, report-card term fee schedules, expenses, products, POS sales and uniform orders. Existing amounts remain unchanged and are classified as USD.
- Fee balances and schedules are keyed by currency. The payment RPC and POS checkout persist the selected record currency; a POS sale or parent uniform order cannot mix currencies. Product currency controls future POS and uniform-order prices; saved receipt/order line prices remain historical snapshots.
- Fee, expense, inventory, POS, parent uniform and learner profile screens show currency codes. POS reports filter to one currency at a time, and operations exports group financial totals by currency. ZWG fee bands begin unset and must be entered by Main Admin; no rates or conversion are guessed.
- Both SQL migrations have been applied to Supabase and verified. ZWG class and report-card fee bands begin unset and must be entered by Main Admin; no rates or conversion are guessed.

## Zimbabwe reporting compatibility

The Reserve Bank identifies Zimbabwe Gold (ZiG) with ISO currency code ZWG; its notice says the code replaced ZWL as the currency reference code. ZIMSEC's public systems present national examination results and identify levels such as Grade 7, O Level and A Level. The sources reviewed did not supply the school's official term report-card template or a Ministry-prescribed export schema. The portal must not claim statutory ZIMSEC or Ministry report compatibility until the school provides the templates and approves field mappings.

## Verify

Run against the linked Supabase project:

```sql
select band_group, count(*) as band_count,
       min(minimum_score) as lowest_minimum,
       max(maximum_score) as highest_maximum
from public.grade_bands
group by band_group
order by band_group;

select count(*) as historical_contexts,
       count(*) filter (
         where report_rules->'grading_scale' is distinct from
           public.report_rules_baseline(class_level, class_stream)->'grading_scale'
       ) as contexts_different_from_original_baseline
from public.report_period_contexts;

select jsonb_pretty(public.report_rules_for_new_period('Grade 1', null)->'grading_scale');
select jsonb_pretty(public.report_rules_for_new_period('Form 1', 'Arts')->'grading_scale');

select table_name, column_name, column_default, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in ('fee_structure_mapping','fee_balances','fee_payments','report_term_fee_settings','school_expenses',
                     'inventory_products','pos_sales','parent_uniform_orders')
  and column_name = 'currency'
order by table_name, column_name;

select table_name, constraint_name, check_clause
from information_schema.check_constraints cc
join information_schema.table_constraints tc using (constraint_catalog, constraint_schema, constraint_name)
where tc.table_schema='public'
  and tc.table_name in ('fee_structure_mapping','fee_balances','fee_payments','report_term_fee_settings','school_expenses',
                         'inventory_products','pos_sales','parent_uniform_orders')
  and constraint_name like '%currency%'
order by table_name, constraint_name;

select currency, count(*) as records
from public.fee_balances
group by currency order by currency;

select currency, count(*) as products
from public.inventory_products
group by currency order by currency;

select currency, count(*) as sales, sum(total) as total
from public.pos_sales
group by currency order by currency;

select currency, count(*) as orders, sum(total) as total
from public.parent_uniform_orders
group by currency order by currency;

select band_id, band_name, currency, amount
from public.fee_structure_mapping
order by band_id, currency;

select academic_year,term,class_level,currency,amount
from public.report_term_fee_settings
order by academic_year desc,term,class_level,currency;

select indexname, indexdef
from pg_indexes
where schemaname='public'
  and indexname in ('fee_balances_student_period_currency_unique','fee_structure_mapping_band_currency_unique');

select trigger_name, event_object_table
from information_schema.triggers
where trigger_schema='public'
  and trigger_name in ('fee_payment_currency_guard','uniform_order_currency_guard')
order by event_object_table, trigger_name;
```

The grade-band and historical-report queries remain part of the Stage 13 checks. Do not treat the currency migration as live until all listed columns, constraints, indexes and triggers appear and existing USD amounts match their pre-migration values.

## Source review

- Reserve Bank of Zimbabwe, [Press Statement — Introduction of Zimbabwe Gold (ZiG) Currency Code (ZWG)](https://www.rbz.co.zw/documents/press/2024/July/PRESS_STATEMENT_ON_ZiG_CURRENCY_CODE.pdf).
- ZIMSEC, [Exam Results Portal information](https://www5.zimsec.co.zw/exam-results-information/).

Stage 13 currency implementation is live and verified. Official Ministry or exam-board report compatibility remains unverified until the school supplies and approves the required templates and field mappings. Deploy the frontend before administrators start entering ZWG amounts.
