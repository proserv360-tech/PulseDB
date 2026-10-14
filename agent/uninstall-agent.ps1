<#
  PulseDB Agent - remove autostart and stop the agent.
  Leaves this folder and agent.config.json in place.
  Admin rights are only needed if the agent was installed as a scheduled task
  (install-agent.cmd); setup.cmd installs per-user and needs none.
#>
$ErrorActionPreference = 'Stop'
$TaskName = 'PulseDB Agent'
$Root     = Split-Path -Parent $MyInvocation.MyCommand.Path

$startup = Join-Path ([Environment]::GetFolderPath('Startup')) 'PulseDB Agent.vbs'
if (Test-Path $startup) { Remove-Item $startup -Force; Write-Host "Removed autostart ($startup)." }

if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    $principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        Write-Host "The '$TaskName' scheduled task exists; run this as administrator to remove it." -ForegroundColor Yellow
    } else {
        Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
        Write-Host "Removed scheduled task '$TaskName'."
    }
}

# The supervisor first (so it does not restart the agent), then the agent.
Get-CimInstance Win32_Process |
    Where-Object { $_.Name -eq 'cmd.exe' -and $_.CommandLine -like "*$Root\run-agent.cmd*" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force; Write-Host "Stopped agent supervisor $($_.ProcessId)." }
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
    Where-Object { $_.CommandLine -like '*pulsedb-agent.mjs*' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force; Write-Host "Stopped agent process $($_.ProcessId)." }
Write-Host 'Done.'
