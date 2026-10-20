# Integration probe: one new private test object; all SQL records roll back.
# Requires the existing Supabase CLI login. Never prints API keys.
param([string]$ProjectRef = 'ejrtmdvnumjwikehzrrk')
$ErrorActionPreference = 'Stop'
if ((Get-Content -Raw supabase/.temp/project-ref).Trim() -ne $ProjectRef) { throw 'Use the linked project for this integration probe.' }
$taskResource = [guid]::NewGuid().ToString()
$taskFile = [guid]::NewGuid().ToString()
$taskPath = "$taskResource/$taskFile.pdf"
$taskBytes = [Text.Encoding]::UTF8.GetBytes('%PDF-1.4 Learning library disposable integration probe %%EOF')
$taskKeys = & .\node_modules\.bin\supabase.cmd projects api-keys --project-ref $ProjectRef --output json | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'Unable to obtain the server test credential.' }
$taskService = ($taskKeys | Where-Object name -eq 'service_role').api_key
if (-not $taskService) { throw 'Server test credential is unavailable.' }
$taskHeaders = @{ apikey = $taskService; Authorization = "Bearer $taskService" }
$taskCreated = $false
$taskSqlPath = Join-Path $PSScriptRoot "artifacts/library-upload-$taskResource.sql"
try {
  $null = Invoke-RestMethod -Method Post -Uri "https://$ProjectRef.supabase.co/storage/v1/object/learning-library/$taskPath" -Headers $taskHeaders -ContentType 'application/pdf' -Body $taskBytes
  $taskCreated = $true
  $taskSql = @'
begin;
do $probe$
declare teacher uuid; allocation public.teacher_class_subject_assignments;
begin
 select a.* into allocation from public.teacher_class_subject_assignments a join public.profiles p on p.id=a.teacher_id
 where a.campus='senior' and p.active_role='teacher' and p.portal_access_enabled is distinct from false
 and exists(select 1 from public.user_roles u where u.user_id=p.id and u.role='teacher') limit 1;
 teacher:=allocation.teacher_id;
 if teacher is null then raise exception 'No allocated teacher for integration probe'; end if;
 perform set_config('request.jwt.claim.sub',teacher::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',teacher,'role','authenticated','aal','aal2')::text,true);
 set local role authenticated;
 insert into public.learning_resources(id,allocation_id,campus,class_level,class_stream,subject,academic_year,term,title)
 values('RESOURCE_UUID',allocation.id,allocation.campus,allocation.class_level,allocation.class_stream,allocation.subject,2026,3,'Disposable physical upload probe');
 insert into public.portal_content_files(id,resource_id,extension,original_name,mime_type,size_bytes)
 values('FILE_UUID','RESOURCE_UUID','pdf','probe.pdf','application/pdf',FILE_SIZE);
 if not public.portal_storage_file_access('learning-library','OBJECT_PATH',true) then raise exception 'Teacher upload policy rejected reserved path'; end if;
 perform public.finalize_portal_content_file('FILE_UUID');
 update public.learning_resources set state='published' where id='RESOURCE_UUID';
 if not exists(select 1 from public.portal_content_files where id='FILE_UUID' and ready and active) then raise exception 'Physical upload did not finalize'; end if;
 if public.portal_storage_file_access('learning-library','OBJECT_PATH',true) then raise exception 'Finalized file is still writable'; end if;
 reset role;
end;
$probe$;
select true as actual_storage_metadata_matches,true as teacher_finalization_and_publish_passed;
rollback;
'@
  $taskSql = $taskSql.Replace('RESOURCE_UUID',$taskResource).Replace('FILE_UUID',$taskFile).Replace('OBJECT_PATH',$taskPath).Replace('FILE_SIZE',[string]$taskBytes.Length)
  $null = New-Item -ItemType Directory -Force (Split-Path $taskSqlPath)
  [IO.File]::WriteAllText($taskSqlPath,$taskSql)
  # Pass a file: Windows cmd wrappers can truncate multiline SQL arguments.
  $taskResult = & .\node_modules\.bin\supabase.cmd db query --linked --file $taskSqlPath
  if ($LASTEXITCODE -ne 0) { Write-Output $taskResult; throw 'Live teacher finalization probe failed; SQL transaction was rolled back.' }
  $taskReport = ($taskResult -join [Environment]::NewLine) | ConvertFrom-Json
  if ($taskReport.rows[0].actual_storage_metadata_matches -ne $true -or $taskReport.rows[0].teacher_finalization_and_publish_passed -ne $true) {
    throw 'Expected integration assertions missing; an empty result is not a passed test.'
  }
  Write-Output $taskResult
} finally {
  if ($taskCreated) {
    $taskDelete = @{ prefixes = @($taskPath) } | ConvertTo-Json -Compress
    $null = Invoke-RestMethod -Method Delete -Uri "https://$ProjectRef.supabase.co/storage/v1/object/learning-library" -Headers $taskHeaders -ContentType 'application/json' -Body $taskDelete
    Write-Output 'PASS: exact disposable test object removed through Storage API.'
  }
  Remove-Variable taskService,taskKeys,taskHeaders -ErrorAction SilentlyContinue
  if (Test-Path -LiteralPath $taskSqlPath) { Remove-Item -LiteralPath $taskSqlPath }
}
