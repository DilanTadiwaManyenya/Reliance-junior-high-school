-- Audit events inherit their campus from the staff profile that performed the
-- action. Campus managers may review only events from their own campus; Main
-- Admin remains able to review the complete school audit trail.

create or replace function public.can_read_audit_log(target_log_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.audit_logs log
    join public.profiles actor on actor.id = log.actor_id
    where log.id = target_log_id
      and public.can_read_school_campus(actor.campus)
  );
$$;

revoke all on function public.can_read_audit_log(uuid) from public;
grant execute on function public.can_read_audit_log(uuid) to authenticated;

drop policy if exists "Admins and principals read audit events" on public.audit_logs;
create policy "Campus managers read audit events" on public.audit_logs
  for select to authenticated
  using (public.can_read_audit_log(id));
