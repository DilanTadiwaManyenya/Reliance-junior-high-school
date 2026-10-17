# Read-only live RPC checks; no identities are printed.
$ErrorActionPreference='Stop'
$cli=Join-Path $PSScriptRoot '../node_modules/.bin/supabase.cmd'
$data=(& $cli db query --linked --output json "select jsonb_build_object('admin',(select id from public.profiles where role='admin' and active_role='admin' and campus='junior' limit 1),'senior_student',(select id from public.students where campus='senior' limit 1)) as ids;" | ConvertFrom-Json).rows[0].ids
if ($LASTEXITCODE -ne 0) { throw 'Cannot load probe scope' }
if (!$data.admin -or !$data.senior_student) { throw 'Junior admin and Senior learner required for the probe' }
$uid=[guid]$data.admin
$student=[guid]$data.senior_student
$prefix="begin read only; select set_config('request.jwt.claim.sub','$uid',true); set local role authenticated; "
$result=(& $cli db query --linked --output json ($prefix+"select count(*) as cross_campus_rows from public.audit_admission_numbers() where campus='senior'; rollback;") | ConvertFrom-Json).rows[0]
if ($LASTEXITCODE -ne 0 -or $null -eq $result) { throw 'Audit probe failed' }
if ($result.cross_campus_rows -ne 0) { throw 'Admission audit leaked Senior learners' }
Write-Output 'PASS Junior admission audit excludes Senior learners'
$output=& $cli db query --linked --output json ($prefix+"select * from public.report_subject_teachers_for_student('$student'); rollback;") 2>&1 | Out-String
if ($LASTEXITCODE -eq 0 -or $output -notmatch 'not allowed to view this learner report') { throw 'Cross-campus report RPC was not denied as expected' }
Write-Output 'PASS Junior admin denied Senior report RPC'
$output=& $cli db query --linked --output json "begin read only; set local role anon; select public.verify_student_admission('no-real-admission',date '1900-01-01'); rollback;" 2>&1 | Out-String
if ($LASTEXITCODE -eq 0 -or $output -notmatch 'permission denied') { throw 'Anonymous internal admission RPC was not denied' }
Write-Output 'PASS anonymous caller denied internal admission RPC'
$global:LASTEXITCODE=0
