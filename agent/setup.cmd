@echo off
rem PulseDB Agent - one-step setup. Double-click; safe to run again at any time.
rem Installs what is missing (Node.js, SQL Server ODBC driver - via winget),
rem finds SQL Server on this PC, gets/keeps the agent key, starts the agent
rem and makes it start at every sign-in.
setlocal
cd /d "%~dp0"

rem -- Node.js ---------------------------------------------------------------
set "NODE=node"
where node >nul 2>nul && goto :have_node
if exist "%ProgramFiles%\nodejs\node.exe" (set "NODE=%ProgramFiles%\nodejs\node.exe" & goto :have_node)
where winget >nul 2>nul || (echo Node.js 20+ is required and winget is not available: install it from https://nodejs.org, then run setup again. & pause & exit /b 1)
echo ==^> Installing Node.js LTS (winget)
winget install -e --id OpenJS.NodeJS.LTS --silent --accept-source-agreements --accept-package-agreements
if not exist "%ProgramFiles%\nodejs\node.exe" (echo Node.js installation did not complete. & pause & exit /b 1)
set "NODE=%ProgramFiles%\nodejs\node.exe"
:have_node
if exist "%ProgramFiles%\nodejs\npm.cmd" (set "NPM=%ProgramFiles%\nodejs\npm.cmd") else (set "NPM=npm.cmd")

rem -- SQL Server ODBC driver (Windows authentication) ------------------------
reg query "HKLM\SOFTWARE\ODBC\ODBCINST.INI\ODBC Driver 18 for SQL Server" >nul 2>nul && goto :have_odbc
reg query "HKLM\SOFTWARE\ODBC\ODBCINST.INI\ODBC Driver 17 for SQL Server" >nul 2>nul && goto :have_odbc
where winget >nul 2>nul || (echo The Microsoft ODBC Driver 18 for SQL Server is required: https://aka.ms/odbc18 & pause & exit /b 1)
echo ==^> Installing Microsoft ODBC Driver 18 for SQL Server (winget; Windows may ask for permission)
winget install -e --id Microsoft.msodbcsql.18 --silent --accept-source-agreements --accept-package-agreements
:have_odbc

rem -- agent dependencies ----------------------------------------------------
if not exist "node_modules\msnodesqlv8" (
    echo ==^> Installing agent drivers
    call "%NPM%" ci --omit=dev --no-audit --no-fund || (pause & exit /b 1)
)

"%NODE%" setup.mjs %*
if errorlevel 1 pause
endlocal
