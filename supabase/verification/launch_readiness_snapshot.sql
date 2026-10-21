-- Read-only: actual deployed data, not a synthetic transaction snapshot.
select jsonb_build_object(
 'teachers_missing_verified_initials',(select count(*) from public.profiles where active_role='teacher' and portal_access_enabled is distinct from false and nullif(signature_initials,'') is null),
 'teachers_missing_auth_account',(select count(*) from public.profiles p left join auth.users u on u.id=p.id where p.active_role='teacher' and p.portal_access_enabled is distinct from false and u.id is null),
 'current_periods',(select jsonb_agg(jsonb_build_object('campus',campus,'year',academic_year,'term',term,'state',state)) from public.reporting_periods where is_current)
) as live_snapshot;
