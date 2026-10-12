-- A Junior coursework assessment may feed one named report-book component.
-- Null remains valid for ECD or coursework that should stay informational.
alter table public.coursework_assessments
  add column if not exists report_component text;
