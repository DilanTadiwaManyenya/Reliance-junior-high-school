# Stage 13 — Zimbabwe configuration

## Implemented

- Primary, O Level and A Level bands are already administrator-configurable in `grade_bands`. The live project currently has complete 0–100 coverage: 9 Primary bands, 5 O Level bands and 7 A Level bands.
- Before this stage, the grade-band editor's checker and teacher mark previews used hard-coded thresholds even when the database contained a different configured scale. They now use the configured rows.
- New report-period snapshots now capture the configured grade scale. The 63 existing `report_period_contexts` were not changed. A school-approved correction of a historical class continues to record the selected class and current scale through the existing audited review process.
- The database remains USD-only for fees, expenses, POS and uniform orders. The inspected live tables have no currency column. Existing screens and exports explicitly label financial values USD. ZiG/ZWG is therefore not enabled: adding it safely needs per-record currency, currency-aware payment and balance rules, and totals grouped by currency. No exchange rates or reinterpretation of historical USD amounts were introduced.

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

select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and table_name in ('fee_payments','fee_balances','school_expenses','pos_sales',
                     'pos_sale_items','inventory_products','uniform_orders','uniform_order_items')
  and column_name ilike '%curr%'
order by table_name, column_name;
```

The current live project returned 9/5/7 configured bands, all spanning 0–100; 63 existing historical contexts; the helper returned the configured scales; and zero currency columns in the inspected finance tables.

## Source review

- Reserve Bank of Zimbabwe, [Press Statement — Introduction of Zimbabwe Gold (ZiG) Currency Code (ZWG)](https://www.rbz.co.zw/documents/press/2024/July/PRESS_STATEMENT_ON_ZiG_CURRENCY_CODE.pdf).
- ZIMSEC, [Exam Results Portal information](https://www5.zimsec.co.zw/exam-results-information/).

Stage 13 is partial until the school decides whether it wants currency-aware finance records and supplies/approves official Ministry or exam-board report templates. Existing reports, historical financial values, payment calculations and order logic remain unchanged.
