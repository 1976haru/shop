@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo ==================================================
echo Commerce Diagnostic Hub - Windows local start
echo ==================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found.
  echo Install Node.js 22.13 or newer, then run this file again.
  echo.
  pause
  exit /b 1
)

for /f "delims=" %%V in ('node -p "process.versions.node"') do set "NODE_VERSION=%%V"
echo [1/4] Node.js %NODE_VERSION%
node -e "const [a,b]=process.versions.node.split('.').map(Number); process.exit(a>22||(a===22&&b>=13)?0:1)"
if errorlevel 1 (
  echo [ERROR] Node.js 22.13 or newer is required.
  echo Current version: %NODE_VERSION%
  echo.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm was not found. Reinstall Node.js including npm.
  pause
  exit /b 1
)

echo [2/4] Installing exact dependencies with npm ci...
call npm ci --ignore-scripts --no-audit --no-fund
if errorlevel 1 (
  echo.
  echo [ERROR] npm ci failed. Check the message above.
  pause
  exit /b 1
)

echo [3/4] Starting the local server in a new window...
start "Commerce Diagnostic Hub Server" cmd /k "cd /d ""%CD%"" && npm start"

echo [4/4] Waiting for http://127.0.0.1:3000 ...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$url='http://127.0.0.1:3000/health/live'; for($i=0;$i -lt 45;$i++){ try { $r=Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 1; if($r.StatusCode -eq 200){ exit 0 } } catch {}; Start-Sleep -Seconds 1 }; exit 1"
if errorlevel 1 (
  echo.
  echo [ERROR] The server did not become ready.
  echo Check the 'Commerce Diagnostic Hub Server' window for details.
  pause
  exit /b 1
)

start "" "http://127.0.0.1:3000"
echo.
echo Browser opened successfully.
echo Keep the server window open while using the app.
echo Close that server window to stop the app.
echo.
pause
