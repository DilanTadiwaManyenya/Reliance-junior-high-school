begin;

alter table public.report_term_fee_settings
  add column if not exists currency text not null default 'USD';
alter table public.report_term_fee_settings
  drop constraint if exists report_term_fee_settings_currency_check;
alter table public.report_term_fee_settings
  add constraint report_term_fee_settings_currency_check check (currency in ('USD','ZWG'));

alter table public.report_term_fee_settings
  drop constraint if exists report_term_fee_settings_academic_year_term_class_level_key;
create unique index if not exists report_term_fee_settings_period_class_currency_unique
  on public.report_term_fee_settings(academic_year,term,class_level,currency);

create or replace function public.save_campus_report_term_settings(
  p_academic_year integer,
  p_term integer,
  p_campus text,
  p_next_term_begins_on date,
  p_fees jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_campus text;
  v_allowed_levels text[];
  v_fee jsonb;
  v_level text;
  v_amount numeric;
  v_currency text;
begin
  select campus into v_profile_campus from public.profiles where id = auth.uid();

  if not public.has_active_role('admin')
    or v_profile_campus is null
    or (v_profile_campus <> 'all' and v_profile_campus <> p_campus) then
    raise exception 'You can only manage report settings for your assigned campus';
  end if;

  if p_campus = 'junior' then
    v_allowed_levels := array['ECD A', 'ECD B', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7'];
  elsif p_campus = 'senior' then
    v_allowed_levels := array['Form 1', 'Form 2', 'Form 3', 'Form 4', 'Lower Six', 'Upper Six'];
  else
    raise exception 'A valid campus is required';
  end if;

  if p_academic_year < 2020 or p_term not between 1 and 3 then
    raise exception 'A valid report year and term are required';
  end if;

  insert into public.term_settings (
    academic_year, term, next_term_begins_on,
    junior_next_term_begins_on, senior_next_term_begins_on, updated_at
  ) values (
    p_academic_year, p_term, p_next_term_begins_on,
    case when p_campus = 'junior' then p_next_term_begins_on else null end,
    case when p_campus = 'senior' then p_next_term_begins_on else null end,
    now()
  )
  on conflict (academic_year, term) do update set
    junior_next_term_begins_on = case when p_campus = 'junior' then excluded.junior_next_term_begins_on else public.term_settings.junior_next_term_begins_on end,
    senior_next_term_begins_on = case when p_campus = 'senior' then excluded.senior_next_term_begins_on else public.term_settings.senior_next_term_begins_on end,
    next_term_begins_on = p_next_term_begins_on,
    updated_at = now();

  for v_fee in select value from jsonb_array_elements(coalesce(p_fees, '[]'::jsonb)) loop
    v_level := trim(v_fee ->> 'class_level');
    v_amount := (v_fee ->> 'amount')::numeric;
    v_currency := upper(coalesce(nullif(trim(v_fee ->> 'currency'), ''), 'USD'));
    if v_level is null or not (v_level = any(v_allowed_levels) or (p_campus = 'senior' and v_level in ('Form 5','Form 6'))) or v_amount is null or v_amount < 0 or v_currency not in ('USD','ZWG') then
      raise exception 'Invalid fee setting for this campus or currency';
    end if;

    insert into public.report_term_fee_settings (academic_year, term, class_level, amount, currency, updated_at)
    values (p_academic_year, p_term, v_level, v_amount, v_currency, now())
    on conflict (academic_year, term, class_level, currency) do update set
      amount = excluded.amount,
      updated_at = excluded.updated_at;
  end loop;
end;
$$;

revoke all on function public.save_campus_report_term_settings(integer,integer,text,date,jsonb) from public;
grant execute on function public.save_campus_report_term_settings(integer,integer,text,date,jsonb) to authenticated;

notify pgrst, 'reload schema';
commit;
