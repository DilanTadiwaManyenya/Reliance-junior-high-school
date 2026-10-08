-- Junior and Senior campuses may reopen on different dates.
alter table public.term_settings
  add column if not exists junior_next_term_begins_on date,
  add column if not exists senior_next_term_begins_on date;

-- Preserve the original school-wide setting as the initial value for both campuses.
update public.term_settings
set junior_next_term_begins_on = coalesce(junior_next_term_begins_on, next_term_begins_on),
    senior_next_term_begins_on = coalesce(senior_next_term_begins_on, next_term_begins_on)
where next_term_begins_on is not null;
