@echo off
REM ============================================================
REM  GangNiaga WebBridge - One-Click Setup & Launch v2.5
REM  Run this file to setup and start everything automatically
REM ============================================================

cd /d "%~dp0"

echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║   ⚡ GangNiaga WebBridge Setup ^& Launch ⚡   ║
echo  ╚══════════════════════════════════════════════╝
echo.

REM ---- Step 1: Check Node.js ----
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
  echo ❌ Node.js not found. Download from https://nodejs.org
  pause
  exit /b 1
)
echo ✅ Node.js found

REM ---- Step 2: Install dependencies ----
if not exist "node_modules" (
  echo 📦 Installing dependencies...
  npm install
) else (
  echo ✅ Dependencies installed
)

REM ---- Step 3: Register Native Messaging (one-time) ----
set REG_KEY=HKCU\Software\Google\Chrome\NativeMessagingHosts\com.gangniaga.webbridge
reg query "%REG_KEY%" >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
  echo 🔧 Registering Native Messaging Host...
  reg add "%REG_KEY%" /ve /t REG_SZ /d "%~dp0daemon\com.gangniaga.webbridge.json" /f >nul
  echo ✅ Registry key added
) else (
  echo ✅ Native Messaging already registered
)

REM ---- Step 4: Check Chrome Extension ----
set EXT_DIR=%LOCALAPPDATA%\Google\Chrome\User Data\Default\Extensions\hinhmbbmelmmgiehkfmmkmfndadahmkk
if not exist "%EXT_DIR%" (
  echo.
  echo ⚠️  Chrome extension NOT installed.
  echo    Please install manually:
  echo    1. Open chrome://extensions
  echo    2. Enable Developer mode
  echo    3. Click "Load unpacked"
  echo    4. Select: %~dp0extension
  echo.
  pause
  goto :start_daemon
) else (
  echo ✅ Chrome extension installed
)

:start_daemon
REM ---- Step 5: Kill any existing daemon (safe: only kill node on port 10087) ----
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":10087" ^| findstr "LISTENING"') do (
  echo 🔄 Stopping old daemon [PID %%a]...
  taskkill /F /PID %%a 2>nul
  timeout /t 2 /nobreak >nul
)

REM ---- Step 6: Start Daemon ----
echo.
echo 🚀 Starting WebBridge Daemon...
echo    The daemon will start in a new window.
echo    Keep it running in the background.
echo.
start "GangNiaga WebBridge Daemon" cmd /c "cd /d "%~dp0" && npm run daemon"
timeout /t 3 /nobreak >nul

REM ---- Step 7: Quick health check ----
echo.
echo 🏥 Checking daemon health...
powershell -ExecutionPolicy Bypass -Command "try { $r = Invoke-RestMethod -Uri 'http://127.0.0.1:10087/status' -TimeoutSec 5; Write-Host ('✅ Daemon OK - v' + $r.version + ' - Extension: ' + $r.extension_connected) } catch { Write-Host '⏳ Daemon starting up...' }"

echo.
echo ═══════════════════════════════════════════════
echo  ✅ Setup complete!
echo.
echo  Quick commands:
echo    npm run daemon     - Start/restart daemon
echo    npm run mcp        - Start MCP server
echo    npm test           - Run tests
echo    npm run lint       - Check code quality
echo.
echo  From WSL:
echo    hermes             - Run automated workflow
echo    hermes-i           - Interactive mode
echo ═══════════════════════════════════════════════
