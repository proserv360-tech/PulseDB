<#
  PulseDB Agent - remove autostart and stop the agent.
  Leaves this folder and agent.config.json in place.
  Admin rights are only needed if the agent runs as the always-on boot task
  (setup.cmd run as administrator, or install-agent.cmd); the sign-in task that
  a normal setup.cmd creates is removed without them.
#>
$ErrorActionPreference = 'Stop'
$TaskName = 'PulseDB Agent'
$Root     = Split-Path -Parent $MyInvocation.MyCommand.Path

$startup = Join-Path ([Environment]::GetFolderPath('Startup')) 'PulseDB Agent.vbs'
if (Test-Path $startup) { Remove-Item $startup -Force; Write-Host "Removed autostart ($startup)." }

if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    try {
        Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
        Write-Host "Removed scheduled task '$TaskName'."
    } catch {
        Write-Host "The '$TaskName' scheduled task runs at boot; run this as administrator to remove it." -ForegroundColor Yellow
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
