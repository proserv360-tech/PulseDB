@echo off
rem Right-click > Run as administrator.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0uninstall-agent.ps1" %*
pause
