<#
  PulseDB Agent - install / update as a Windows startup task.

  Run from an elevated prompt (or right-click install-agent.cmd > Run as administrator):
    powershell -ExecutionPolicy Bypass -File .\install-agent.ps1

  1. checks Node.js 20+ and agent.config.json
  2. installs the SQL Server driver (npm ci)
  3. registers the "PulseDB Agent" scheduled task (runs at boot) and starts it
#>
$ErrorActionPreference = 'Stop'
$Root     = Split-Path -Parent $MyInvocation.MyCommand.Path
$TaskName = 'PulseDB Agent'

function Fail($msg) { Write-Host "`nERROR: $msg" -ForegroundColor Red; exit 1 }

$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Fail 'Run this from an elevated prompt (right-click install-agent.cmd > Run as administrator).'
}

$nodeCmd = Get-Command node.exe -ErrorAction SilentlyContinue
if (-not $nodeCmd) { Fail 'Node.js is not installed or not on PATH. Install Node.js 20 or 22 LTS from https://nodejs.org.' }
$NodeExe = $nodeCmd.Source
if ([int]((& $NodeExe --version).TrimStart('v').Split('.')[0]) -lt 20) { Fail 'Node.js 20+ is required.' }

$config = Join-Path $Root 'agent.config.json'
if (-not (Test-Path $config)) {
    Copy-Item (Join-Path $Root 'agent.config.example.json') $config
    Fail 'Created agent.config.json from the example. Fill in agentKey and the database (login, or "windowsAuth": true), then re-run.'
}
if ((Get-Content $config -Raw) -match 'CHANGE-ME') { Fail 'agent.config.json still contains CHANGE-ME values.' }

Write-Host "`n==> Installing dependencies" -ForegroundColor Cyan
Push-Location $Root
try {
    & (Join-Path (Split-Path $NodeExe) 'npm.cmd') ci --omit=dev --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { Fail 'npm ci failed.' }
} finally { Pop-Location }

Write-Host "`n==> Registering scheduled task '$TaskName'" -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path (Join-Path $Root 'logs') | Out-Null
if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}
$cmdArgs   = '/c ""' + $NodeExe + '" pulsedb-agent.mjs >> "logs\agent.log" 2>&1"'
$action    = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument $cmdArgs -WorkingDirectory $Root
# Windows authentication connects as the account the agent runs under, so run it
# as the installing user (at their logon) — SYSTEM usually has no SQL Server rights.
# SQL logins don't depend on the account, so those run as SYSTEM at boot.
$usesWindowsAuth = @((Get-Content $config -Raw | ConvertFrom-Json).targets | Where-Object { $_.windowsAuth -eq $true }).Count -gt 0
if ($usesWindowsAuth) {
    $me       = [Security.Principal.WindowsIdentity]::GetCurrent().Name
    $trigger  = New-ScheduledTaskTrigger -AtLogOn -User $me
    $taskUser = New-ScheduledTaskPrincipal -UserId $me -LogonType Interactive -RunLevel Limited
    Write-Host "Windows authentication: the agent will run as $me while you are signed in." -ForegroundColor Cyan
} else {
    $trigger  = New-ScheduledTaskTrigger -AtStartup
    $taskUser = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
}
$settings  = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $taskUser -Settings $settings `
    -Description 'PulseDB Agent: relays PulseDB requests to local databases (outbound HTTPS only).' | Out-Null
Start-ScheduledTask -TaskName $TaskName

Start-Sleep -Seconds 5
$logFile = Join-Path $Root 'logs\agent.log'
if ((Test-Path $logFile) -and (Select-String -Path $logFile -Pattern 'registered with' -Quiet)) {
    Write-Host "`nPulseDB Agent is running and registered. Your databases now appear under Connections in PulseDB." -ForegroundColor Green
} else {
    Write-Host "`nAgent task started. Check $logFile in a few seconds for 'registered with'." -ForegroundColor Yellow
}
