-- The official stamp may only be attached to a report approved by an administrator.
alter table public.report_card_comments
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references public.profiles(id);

create or replace function public.enforce_report_stamp_admin_approval()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT' and (new.approved_at is not null or new.approved_by is not null))
     or (tg_op = 'UPDATE' and (new.approved_at, new.approved_by) is distinct from (old.approved_at, old.approved_by)) then
    if not public.is_admin() then raise exception 'Administrator approval is required to publish an official report stamp'; end if;
    new.approved_at := coalesce(new.approved_at, now());
    new.approved_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists report_stamp_admin_approval on public.report_card_comments;
create trigger report_stamp_admin_approval before insert or update on public.report_card_comments
for each row execute function public.enforce_report_stamp_admin_approval();
