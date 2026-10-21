# No installs, schema deployment, credential changes or content cleanup.
param([switch]$LiveDatabase,[switch]$PhysicalStorage)
$ErrorActionPreference = 'Stop'
if ($PhysicalStorage -and -not $LiveDatabase) { throw 'PhysicalStorage requires LiveDatabase and its linked-project check.' }
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskResults = [Collections.Generic.List[object]]::new()
$taskPassed = $false
Push-Location $taskRoot
function Invoke-LibraryCheck([string]$Label,[string]$Program,[string[]]$Arguments) {
  Write-Output "CHECK: $Label"
  & $Program @Arguments
  $taskCode = $LASTEXITCODE
  $taskResults.Add(@{ check=$Label; passed=($taskCode -eq 0) })
  if ($taskCode -ne 0) { throw "Failed: $Label (exit $taskCode)" }
}
try {
  if (-not $env:PLAYWRIGHT_MODULE) {
    $taskBundled = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
    if (Test-Path -LiteralPath $taskBundled) { $env:PLAYWRIGHT_MODULE = $taskBundled }
  }
  if (-not $env:PLAYWRIGHT_CHANNEL) { $env:PLAYWRIGHT_CHANNEL = 'msedge' }
  Invoke-LibraryCheck 'Content helpers and role routing' 'node' @('--test','tests/learning-library.test.mjs','tests/parent-learning-library.test.mjs','tests/school-newsletters.test.mjs','tests/library-support.test.mjs','tests/portal-render.test.mjs','tests/teacher-access.test.mjs')
  foreach ($taskBrowser in @('learning-library','parent-learning-library','school-newsletters','library-support')) {
    Invoke-LibraryCheck "$taskBrowser browser" 'node' @("tests/$taskBrowser.browser.mjs")
  }
  Invoke-LibraryCheck 'Production build' 'npm.cmd' @('run','build')
  if ($LiveDatabase) {
    if ((Get-Content -Raw supabase/.temp/project-ref).Trim() -ne 'ejrtmdvnumjwikehzrrk') { throw 'Unexpected linked project. No live checks were run.' }
    # Sequential: concurrent CLI queries can rotate the temporary login role password.
    foreach ($taskSql in @('learning_library_stage2_checks','learning_library_stage2_access','library_stage7_create_requests','learning_library_stage4_access','newsletters_stage5_access','library_support_stage6_access','newsletters_stage5_live','library_support_stage6_live','learning_library_retention_review')) {
      Write-Output "CHECK: $taskSql (read-only or rollback-only)"
      $taskRaw = & .\node_modules\.bin\supabase.cmd db query --linked --file "supabase/verification/$taskSql.sql"
      if ($LASTEXITCODE -ne 0) { throw "Database check failed: $taskSql" }
      $taskReport = ($taskRaw -join [Environment]::NewLine) | ConvertFrom-Json
      if (-not $taskReport.rows -or $taskReport.rows.Count -eq 0) { throw "No explicit result rows: $taskSql" }
      foreach ($taskRow in $taskReport.rows) {
        foreach ($taskProperty in $taskRow.PSObject.Properties) {
          if ($taskProperty.Value -is [bool] -and -not $taskProperty.Value) { throw "Failed $taskSql : $($taskProperty.Name)" }
        }
        if ($taskSql -eq 'learning_library_retention_review' -and ($taskRow.finalized_files_missing_objects -gt 0 -or $taskRow.finalized_metadata_mismatches -gt 0)) { throw 'Finalized file integrity needs investigation; no cleanup was attempted.' }
      }
      $taskResults.Add(@{ check=$taskSql; passed=$true; result=$taskReport.rows })
      Write-Output ($taskReport.rows | ConvertTo-Json -Depth 6 -Compress)
    }
    if ($PhysicalStorage) {
      Invoke-LibraryCheck 'Disposable teacher Storage probe' 'powershell.exe' @('-NoProfile','-File','tests/learning-library-live-upload.ps1')
      Invoke-LibraryCheck 'Disposable newsletter Storage probe' 'powershell.exe' @('-NoProfile','-File','tests/newsletter-live-upload.ps1')
    }
  }
  $taskPassed = $true
} finally {
  $null = New-Item -ItemType Directory -Force tests/artifacts
  @{ completed_at=[DateTimeOffset]::UtcNow.ToString('o'); automated_checks_passed=$taskPassed; live_database_requested=[bool]$LiveDatabase; physical_storage_requested=[bool]$PhysicalStorage; production_session_pilot='NOT_RUN_BY_THIS_SCRIPT'; checks=$taskResults } | ConvertTo-Json -Depth 10 | Set-Content tests/artifacts/learning-library-release-checks.json
  Pop-Location
}
if ($taskPassed) { Write-Output 'PASS: requested automated checks. Signed-in production acceptance remains a separate recorded check.' }
