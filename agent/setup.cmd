@echo off
rem PulseDB Agent - one-step setup. Double-click; no admin rights needed.
rem Finds SQL Server on this PC, gets an agent key, starts the agent and
rem makes it start at every sign-in. Safe to run again at any time.
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js 20 or newer is required: https://nodejs.org & pause & exit /b 1)
if not exist "node_modules\msnodesqlv8" (
    echo ==^> Installing drivers
    call npm.cmd ci --omit=dev --no-audit --no-fund || (pause & exit /b 1)
)
node setup.mjs %*
if errorlevel 1 pause
