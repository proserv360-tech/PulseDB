@echo off
rem Removes autostart and stops the agent (admin only needed for the old scheduled-task install).
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0uninstall-agent.ps1" %*
pause
