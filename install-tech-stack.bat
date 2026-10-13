@echo off
echo === Installing tech stack packages ===

echo.
echo [1/4] @sentry/react (frontend)
cd /d "%~dp0frontend"
call npm install @sentry/react --legacy-peer-deps
if errorlevel 1 (echo FAILED: @sentry/react) else (echo OK: @sentry/react)

echo.
echo [2/4] @sentry/node (backend)
cd /d "%~dp0backend"
call npm install @sentry/node --legacy-peer-deps
if errorlevel 1 (echo FAILED: @sentry/node) else (echo OK: @sentry/node)

echo.
echo [3/4] prisma + @prisma/client (backend)
cd /d "%~dp0backend"
call npm install prisma @prisma/client --legacy-peer-deps
if errorlevel 1 (echo FAILED: prisma) else (echo OK: prisma)

echo.
echo [4/4] Prisma init (creates prisma/schema.prisma if not present)
cd /d "%~dp0backend"
if not exist "prisma\schema.prisma" (
    call npx prisma init --datasource-provider postgresql
    echo Prisma initialized. Set DATABASE_URL in backend/.env then run:
    echo   npx prisma db pull   -- introspects your existing DB
    echo   npx prisma generate  -- generates the client
) else (
    echo prisma/schema.prisma already exists, skipping init
)

echo.
echo === Done. Commit package.json + package-lock.json changes. ===
pause
