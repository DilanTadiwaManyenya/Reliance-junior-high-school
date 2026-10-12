-- Grade 3 to Grade 7 books include an official co-curricular activities line.
alter table public.report_card_comments
  add column if not exists co_curricular_activities text;
