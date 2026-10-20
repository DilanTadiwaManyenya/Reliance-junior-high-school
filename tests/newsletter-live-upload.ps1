# One unique private object; SQL changes roll back and the exact object is removed.
param([string]$ProjectRef = 'ejrtmdvnumjwikehzrrk')
$ErrorActionPreference = 'Stop'
if ((Get-Content -Raw supabase/.temp/project-ref).Trim() -ne $ProjectRef) { throw 'Use the linked project.' }
$taskNotice = [guid]::NewGuid().ToString()
$taskFile = [guid]::NewGuid().ToString()
$taskPath = "$taskNotice/$taskFile.pdf"
$taskBytes = [Text.Encoding]::UTF8.GetBytes('%PDF-1.4 Disposable newsletter integration probe %%EOF')
$taskKeys = & .\node_modules\.bin\supabase.cmd projects api-keys --project-ref $ProjectRef --output json | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'Unable to obtain server test credential.' }
$taskService = ($taskKeys | Where-Object name -eq 'service_role').api_key
if (-not $taskService) { throw 'Server test credential unavailable.' }
$taskHeaders = @{ apikey = $taskService; Authorization = "Bearer $taskService" }
$taskCreated = $false
$taskSqlPath = Join-Path $PSScriptRoot "artifacts/newsletter-upload-$taskNotice.sql"
try {
  $null = Invoke-RestMethod -Method Post -Uri "https://$ProjectRef.supabase.co/storage/v1/object/school-newsletters/$taskPath" -Headers $taskHeaders -ContentType 'application/pdf' -Body $taskBytes
  $taskCreated = $true
  $taskSql = @'
begin;
do $probe$
declare adm uuid;
begin
 select id into adm from public.profiles where active_role='admin' and campus='all' and portal_access_enabled is distinct from false limit 1;
 if adm is null then raise exception 'No active Main Admin'; end if;
 perform set_config('request.jwt.claim.sub',adm::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',adm,'role','authenticated','aal','aal2')::text,true);
 set local role authenticated;
 insert into public.announcements(id,campus,title,category) values('NOTICE_UUID','senior','Disposable physical upload probe','newsletter');
 perform public.save_announcement_targets('NOTICE_UUID','[{"campus":"senior","class_level":"","class_stream":""}]');
 insert into public.portal_content_files(id,announcement_id,extension,original_name,mime_type,size_bytes)
 values('FILE_UUID','NOTICE_UUID','pdf','probe.pdf','application/pdf',FILE_SIZE);
 if not public.portal_storage_file_access('school-newsletters','OBJECT_PATH',true) then raise exception 'Admin reserved upload path denied'; end if;
 perform public.finalize_portal_content_file('FILE_UUID');
 update public.announcements set state='published' where id='NOTICE_UUID';
 if not exists(select 1 from public.portal_content_files where id='FILE_UUID' and ready and active) then raise exception 'Physical file did not finalize'; end if;
 if public.portal_storage_file_access('school-newsletters','OBJECT_PATH',true) then raise exception 'Finalized object still writable'; end if;
 reset role;
end;
$probe$;
select true as actual_storage_metadata_matches,true as admin_finalization_and_publish_passed;
rollback;
'@
  $taskSql = $taskSql.Replace('NOTICE_UUID',$taskNotice).Replace('FILE_UUID',$taskFile).Replace('OBJECT_PATH',$taskPath).Replace('FILE_SIZE',[string]$taskBytes.Length)
  $null = New-Item -ItemType Directory -Force (Split-Path $taskSqlPath)
  [IO.File]::WriteAllText($taskSqlPath,$taskSql)
  $taskResult = & .\node_modules\.bin\supabase.cmd db query --linked --file $taskSqlPath
  if ($LASTEXITCODE -ne 0) { Write-Output $taskResult; throw 'Newsletter finalization probe failed.' }
  $taskReport = ($taskResult -join [Environment]::NewLine) | ConvertFrom-Json
  if ($taskReport.rows[0].actual_storage_metadata_matches -ne $true -or $taskReport.rows[0].admin_finalization_and_publish_passed -ne $true) { throw 'Explicit probe assertions missing.' }
  Write-Output $taskResult
} finally {
  if ($taskCreated) {
    $taskDelete = @{ prefixes = @($taskPath) } | ConvertTo-Json -Compress
    $null = Invoke-RestMethod -Method Delete -Uri "https://$ProjectRef.supabase.co/storage/v1/object/school-newsletters" -Headers $taskHeaders -ContentType 'application/json' -Body $taskDelete
    Write-Output 'PASS: exact disposable newsletter object removed through Storage API.'
  }
  Remove-Variable taskService,taskKeys,taskHeaders -ErrorAction SilentlyContinue
  if (Test-Path -LiteralPath $taskSqlPath) { Remove-Item -LiteralPath $taskSqlPath }
}
