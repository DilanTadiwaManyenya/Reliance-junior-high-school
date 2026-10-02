-- Fee settlement is the sole publication condition for a parent report and its stamp.
drop trigger if exists report_stamp_admin_approval on public.report_card_comments;
drop function if exists public.enforce_report_stamp_admin_approval();
