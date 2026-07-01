@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo ==================================================
echo Commerce Diagnostic Hub - verification
echo ==================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found.
  pause
  exit /b 1
)

call npm ci --ignore-scripts --no-audit --no-fund
if errorlevel 1 goto :failed

call npm run typecheck
if errorlevel 1 goto :failed

call npm test
if errorlevel 1 goto :failed

call npm run check
if errorlevel 1 goto :failed

call npm run diagnose -- fixtures/slice0/normal-agri.csv --out tmp/windows-check-report.json
if errorlevel 1 goto :failed

echo.
echo [SUCCESS] All verification steps passed.
echo Report: tmp\windows-check-report.json
echo.
pause
exit /b 0

:failed
echo.
echo [ERROR] Verification failed. Review the output above.
echo.
pause
exit /b 1
