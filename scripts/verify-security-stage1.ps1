# Read-only checks using existing profiles; no account or school-data mutations.
$ErrorActionPreference = 'Stop'
$cli = Join-Path $PSScriptRoot '../node_modules/.bin/supabase.cmd'
$accounts = (& $cli db query --linked --output json "select id,role,active_role,campus from public.profiles where active_role=role and role in ('admin','accountant','teacher','parent','principal') order by role,campus nulls last;" | ConvertFrom-Json).rows
if ($LASTEXITCODE -ne 0) { throw 'Unable to read verification scopes' }
$seen = @{}
foreach ($account in $accounts) {
  $campus = [string]$account.campus
  $label = "$($account.role):$campus"
  if ($seen.ContainsKey($label)) { continue }
  $seen[$label] = $true
  # UUIDs and labels come from typed DB fields; never print personal identities.
  $uid = [guid]$account.id
  $scopeCheck = if ($campus -in @('junior','senior')) { "(select count(*) from public.students where campus is distinct from '$campus')" } elseif ($account.role -in @('admin','accountant') -and $campus -ne 'all') { '(select count(*) from public.students)' } else { '0' }
  $query = "begin read only; select set_config('request.jwt.claim.sub','$uid',true); set local role authenticated; select jsonb_build_object('scope','$label','visible_campuses',(select jsonb_agg(distinct campus) from public.students),'learners',(select count(*) from public.students),'academic_records',(select count(*) from public.academic_records),'fee_balances',(select count(*) from public.fee_balances),'out_of_scope_academic',(select count(*) from public.academic_records a where not exists(select 1 from public.students s where s.id=a.student_id)),'out_of_scope_fees',(select count(*) from public.fee_balances f where not exists(select 1 from public.students s where s.id=f.student_id)),'out_of_scope_learners',$scopeCheck) as probe; rollback;"
  $result = & $cli db query --linked --output json $query | ConvertFrom-Json
  if ($LASTEXITCODE -ne 0) { throw "Scope query failed: $label" }
  $probe = $result.rows[0].probe
  if ($null -eq $probe) { throw "No probe result: $label" }
  if ($probe.out_of_scope_learners -ne 0 -or $probe.out_of_scope_academic -ne 0 -or $probe.out_of_scope_fees -ne 0) { throw "Cross-campus learner access: $label" }
  $probe | ConvertTo-Json -Compress
}
