@echo off
rem Right-click > Run as administrator.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-agent.ps1" %*
pause
